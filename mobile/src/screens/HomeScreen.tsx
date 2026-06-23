import React, { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RecipeCard } from '../components/RecipeCard';
import { CoverArt, COVER_PRESETS } from '../components/CoverArt';
import { ActionSheet, PromptModal, SheetOption } from '../components/ActionSheet';
import { DAYS } from '../data/seed';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { uploadImageIfLocal } from '../lib/storage';
import { useTabNav } from '../navigation/TabContext';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { useI18n } from '../i18n/I18nContext';
import { DayKey, FilterChip, HomeTab, MealSlot, TAG_ICON } from '../types';
import { RootStackParamList } from '../navigation/types';
import { Icon } from '../components/Icon';

const CHIPS: FilterChip[] = ['All', 'Favorites', 'Quick', 'Dinner', 'Breakfast', 'Lunch', 'Vegetarian', 'High-protein'];
const HOME_TABS: { key: HomeTab; label: string }[] = [
  { key: 'organize', label: 'Organize' },
  { key: 'plan', label: 'Plan' },
  { key: 'cook', label: 'Cook' },
  { key: 'track', label: 'Track' },
];

function greetingKey(): 'home.greetingMorning' | 'home.greetingAfternoon' | 'home.greetingEvening' {
  const h = new Date().getHours();
  if (h < 12) return 'home.greetingMorning';
  if (h < 17) return 'home.greetingAfternoon';
  return 'home.greetingEvening';
}

export function HomeScreen() {
  const c = useTheme();
  const { t } = useI18n();
  const styles = makeStyles(c);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { setTab } = useTabNav();
  const {
    recipes,
    favorites,
    mealPlan,
    showToast,
    addWeekToGrocery,
    removeMeal,
    getRecipe,
    cookbookCovers,
    setCookbookCover,
    customCookbooks,
    createCookbook,
    deleteCookbook,
  } = useApp();
  const { user } = useAuth();
  const userId = user?.id;
  const [homeTab, setHomeTab] = useState<HomeTab>('organize');
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [chip, setChip] = useState<FilterChip>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'az' | 'rating'>('newest');
  const [sortOpen, setSortOpen] = useState(false);
  const [showAllCookbooks, setShowAllCookbooks] = useState(false);
  const SORT_LABEL = {
    newest: t('home.sort.newest'),
    oldest: t('home.sort.oldest'),
    az: t('home.sort.az'),
    rating: t('home.sort.rating'),
  } as const;
  const [activeCookbook, setActiveCookbook] = useState<string | null>(null);
  const [coverTarget, setCoverTarget] = useState<{ key: string; hasCover: boolean; isCustom: boolean; title: string } | null>(null);
  const [colorTarget, setColorTarget] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DayKey>('Wed');
  const [handsFree, setHandsFree] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const book = activeCookbook ? customCookbooks.find((cb) => cb.id === activeCookbook) : null;
    const list = recipes.filter((r) => {
      const matchSearch =
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.ingredients.some((i) => i.n.toLowerCase().includes(q));
      if (book) return matchSearch && book.recipeIds.includes(r.id);
      let matchChip = true;
      if (chip === 'Favorites') matchChip = !!favorites[r.id];
      else if (chip === 'Quick') matchChip = r.time <= 20;
      else if (chip !== 'All') matchChip = r.tags?.includes(chip) ?? false;
      return matchSearch && matchChip;
    });
    // Imported/scanned ids embed a Date.now() timestamp for recency ordering.
    const ts = (id: string) => {
      const m = id.match(/(\d{6,})/);
      return m ? Number(m[1]) : 0;
    };
    return list.sort((a, b) => {
      if (sortBy === 'oldest') return ts(a.id) - ts(b.id);
      if (sortBy === 'az') return a.title.localeCompare(b.title);
      if (sortBy === 'rating') return (Number(b.rating) || 0) - (Number(a.rating) || 0);
      return ts(b.id) - ts(a.id); // newest
    });
  }, [recipes, favorites, search, chip, activeCookbook, customCookbooks, sortBy]);

  // Autocomplete suggestions: matching recipe titles, then ingredient names.
  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    const add = (s?: string) => {
      const v = s?.trim();
      if (!v) return;
      const lc = v.toLowerCase();
      if (lc.includes(q) && lc !== q && !seen.has(lc)) {
        seen.add(lc);
        out.push(v);
      }
    };
    recipes.forEach((r) => add(r.title));
    recipes.forEach((r) => r.ingredients.forEach((i) => add(i.n)));
    return out.slice(0, 6);
  }, [recipes, search]);

  // Cookbooks built from the user's own recipes — one per category that has
  // recipes. A manual cover (cookbookCovers[tag]) wins; otherwise we pick a
  // distinct photo per cookbook so two cookbooks don't show the same image.
  const cookbooks = useMemo(() => {
    const cats: { tag: string; title: string }[] = [
      { tag: 'Dinner', title: 'Dinners' },
      { tag: 'Quick', title: 'Quick & easy' },
      { tag: 'Breakfast', title: 'Breakfast' },
      { tag: 'Lunch', title: 'Lunch' },
      { tag: 'Vegetarian', title: 'Vegetarian' },
      { tag: 'High-protein', title: 'High protein' },
    ];
    const used = new Set<string>();
    const pickCover = (key: string, members: typeof recipes) => {
      let imageUrl: string | undefined;
      let coverPreset: string | undefined;
      let tint = c.surfaceAlt;
      const custom = cookbookCovers[key];
      if (custom?.imageUrl) {
        imageUrl = custom.imageUrl;
      } else if (custom?.cover) {
        coverPreset = custom.cover;
      } else {
        const fresh = members.find((r) => r.imageUrl && !used.has(r.imageUrl));
        const textCover = members.find((r) => r.cover);
        const anyPhoto = members.find((r) => r.imageUrl);
        if (fresh?.imageUrl) {
          imageUrl = fresh.imageUrl;
          used.add(fresh.imageUrl);
        } else if (textCover?.cover) {
          coverPreset = textCover.cover;
        } else if (anyPhoto?.imageUrl) {
          imageUrl = anyPhoto.imageUrl;
        } else {
          tint = members[0]?.tint ?? c.surfaceAlt;
        }
      }
      return { imageUrl, coverPreset, tint, hasCover: !!custom };
    };

    const categoryBooks = cats
      .map(({ tag, title }) => {
        const inCat = recipes.filter((r) =>
          tag === 'Quick' ? r.time <= 20 || r.tags?.includes('Quick') : r.tags?.includes(tag),
        );
        return { key: tag, title, count: inCat.length, isCustom: false, ...pickCover(tag, inCat) };
      })
      .filter((cb) => cb.count > 0);

    const userBooks = customCookbooks.map((cb) => {
      const members = recipes.filter((r) => cb.recipeIds.includes(r.id));
      return { key: cb.id, title: cb.title, count: members.length, isCustom: true, ...pickCover(cb.id, members) };
    });

    return [...categoryBooks, ...userBooks];
  }, [recipes, cookbookCovers, customCookbooks]);

  const pickCookbookPhoto = async (tag: string, fromCamera: boolean) => {
    // The camera genuinely needs permission; the photo library uses the system
    // picker (PHPicker on iOS) which works without one, so we only gate camera.
    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (result.canceled || !result.assets[0]) return;
    const uri = userId ? await uploadImageIfLocal(result.assets[0].uri, userId) : result.assets[0].uri;
    setCookbookCover(tag, { imageUrl: uri });
  };

  const coverOptions: SheetOption[] = coverTarget
    ? [
        { label: 'Choose photo', onPress: () => pickCookbookPhoto(coverTarget.key, false) },
        { label: 'Take photo', onPress: () => pickCookbookPhoto(coverTarget.key, true) },
        { label: 'Colour cover', onPress: () => setColorTarget(coverTarget.key) },
        ...(coverTarget.hasCover
          ? [{ label: 'Reset cover', destructive: true, onPress: () => setCookbookCover(coverTarget.key, null) }]
          : []),
        ...(coverTarget.isCustom
          ? [{
              label: 'Delete cookbook',
              destructive: true,
              onPress: () => {
                if (activeCookbook === coverTarget.key) setActiveCookbook(null);
                deleteCookbook(coverTarget.key);
                showToast('Cookbook deleted');
              },
            }]
          : []),
      ]
    : [];

  const colorOptions: SheetOption[] = colorTarget
    ? COVER_PRESETS.map((p) => ({
        label: p.id.charAt(0).toUpperCase() + p.id.slice(1),
        onPress: () => setCookbookCover(colorTarget, { cover: p.id }),
      }))
    : [];

  const selPlan = mealPlan[selectedDay] || {};
  const slots = (['Breakfast', 'Lunch', 'Dinner'] as MealSlot[]).map((slot) => {
    const rid = selPlan[slot];
    const rec = rid ? getRecipe(rid) : undefined;
    return { slot, rec };
  });

  let dayKcal = 0;
  let dayP = 0;
  let dayC = 0;
  let dayF = 0;
  slots.forEach(({ rec }) => {
    if (rec) {
      dayKcal += rec.kcal;
      dayP += rec.p;
      dayC += rec.c;
      dayF += rec.f;
    }
  });

  const totalPlanned = Object.values(mealPlan).reduce(
    (n, day) => n + Object.values(day || {}).filter(Boolean).length,
    0,
  );

  const cookbookCards = () => (
    <>
      {cookbooks.map((cb) => (
        <Pressable
          key={cb.key}
          style={styles.cookbook}
          onPress={() => {
            setSearch('');
            if (cb.isCustom) {
              setActiveCookbook(cb.key);
              setChip('All');
            } else {
              setActiveCookbook(null);
              setChip(cb.key as FilterChip);
            }
          }}
          onLongPress={() => setCoverTarget({ key: cb.key, hasCover: cb.hasCover, isCustom: cb.isCustom, title: cb.title })}
        >
          <View style={[styles.cookbookCover, { backgroundColor: cb.tint }]}>
            {cb.imageUrl ? (
              <Image source={{ uri: cb.imageUrl }} style={styles.cookbookImg} resizeMode="cover" />
            ) : cb.coverPreset ? (
              <CoverArt cover={cb.coverPreset} title="" />
            ) : null}
            <View style={styles.cookbookOverlay} />
            <Pressable
              style={styles.cookbookEdit}
              hitSlop={8}
              onPress={() => setCoverTarget({ key: cb.key, hasCover: cb.hasCover, isCustom: cb.isCustom, title: cb.title })}
            >
              <Icon name="camera" size={14} color="#fff" />
            </Pressable>
            <Text style={styles.cookbookTitle} numberOfLines={2}>{cb.title}</Text>
          </View>
          <Text style={styles.cookbookCount}>{t('home.recipesCount', { n: cb.count })}</Text>
        </Pressable>
      ))}

      <Pressable key="__new_cookbook__" style={styles.cookbook} onPress={() => setNewOpen(true)}>
        <View style={styles.cookbookAdd}>
          <Icon name="plus" size={24} color={c.grayMid} />
          <Text style={styles.cookbookAddText}>{t('home.newCookbook')}</Text>
        </View>
      </Pressable>
    </>
  );

  const renderOrganize = () => (
    <>
      <Text style={styles.headline}>
        {t(greetingKey())},{'\n'}{t('home.whatsCooking')}
      </Text>

      <View style={styles.searchBox}>
        <Icon name="search" size={18} color={c.gray} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('home.searchPlaceholder')}
          placeholderTextColor={c.gray}
          value={search}
          onChangeText={setSearch}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Text style={styles.searchClear}>✕</Text>
          </Pressable>
        )}
      </View>

      {searchFocused && suggestions.length > 0 && (
        <View style={styles.suggestBox}>
          {suggestions.map((s, i) => (
            <Pressable
              key={s}
              style={[styles.suggestRow, i === suggestions.length - 1 && styles.suggestRowLast]}
              onPress={() => {
                setSearch(s);
                setSearchFocused(false);
              }}
            >
              <Icon name="search" size={15} color={c.gray} />
              <Text style={styles.suggestText} numberOfLines={1}>{s}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <Pressable style={styles.importPrimary} onPress={() => navigation.navigate('ImportUrl')}>
        <View style={styles.importIconLight}>
          <Icon name="link" size={20} color="#fff" />
        </View>
        <View style={styles.importTextWrap}>
          <Text style={styles.importTitle}>{t('home.pasteLink')}</Text>
          <Text style={styles.importSub}>{t('home.pasteLinkSub')}</Text>
        </View>
        <Text style={styles.importChevron}>›</Text>
      </Pressable>

      <View style={styles.scanRow}>
        <Pressable style={styles.scanCard} onPress={() => navigation.navigate('ScanRecipe')}>
          <View style={styles.scanIconSage}>
            <Icon name="scan" size={22} color={c.sage} />
          </View>
          <Text style={styles.scanTitle}>{t('home.addRecipe')}</Text>
          <Text style={styles.scanSub}>{t('home.addRecipeSub')}</Text>
        </Pressable>
        <Pressable style={styles.scanCard} onPress={() => navigation.navigate('Receipts')}>
          <View style={styles.scanIconGold}>
            <Icon name="receipt" size={22} color={c.gold} />
          </View>
          <Text style={styles.scanTitle}>{t('home.trackSpending')}</Text>
          <Text style={styles.scanSub}>{t('home.trackSpendingSub')}</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {CHIPS.map((c) => (
          <Pressable
            key={c}
            style={[styles.chip, chip === c && !activeCookbook && styles.chipOn]}
            onPress={() => {
              setChip(c);
              setActiveCookbook(null);
            }}
          >
            <Text style={[styles.chipText, chip === c && styles.chipTextOn]}>
              {TAG_ICON[c] ? `${TAG_ICON[c]} ${c}` : c}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('home.yourCookbooks')}</Text>
        <Pressable onPress={() => setShowAllCookbooks((v) => !v)} hitSlop={8}>
          <Text style={styles.sectionLink}>{showAllCookbooks ? t('common.showLess') : t('common.seeAll')}</Text>
        </Pressable>
      </View>
      {showAllCookbooks ? (
        <View style={styles.cookbookGrid}>{cookbookCards()}</View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cookbookRow}>
          {cookbookCards()}
        </ScrollView>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {activeCookbook
            ? customCookbooks.find((cb) => cb.id === activeCookbook)?.title ?? 'Cookbook'
            : chip === 'All' && !search
            ? t('home.allRecipes')
            : t('home.results')}
        </Text>
        {activeCookbook ? (
          <Pressable onPress={() => setActiveCookbook(null)}>
            <Text style={styles.sectionLink}>{t('common.done')}</Text>
          </Pressable>
        ) : (
          <View style={styles.sortRow}>
            <Text style={styles.countLabel}>{t('home.recipesCount', { n: filtered.length })}</Text>
            <Pressable style={styles.sortBtn} onPress={() => setSortOpen(true)} hitSlop={8}>
              <Text style={styles.sortText}>{SORT_LABEL[sortBy]}</Text>
              <Icon name="chevron-down" size={13} color={c.grayMid} />
            </Pressable>
          </View>
        )}
      </View>

      {filtered.length === 0 ? (
        <Text style={styles.empty}>
          {activeCookbook ? t('home.emptyCookbook') : t('home.noResults')}
        </Text>
      ) : (
        <View style={styles.grid}>
          {filtered.map((r, idx) => (
            <View key={r.id || `r${idx}`} style={styles.gridItem}>
              <RecipeCard
                title={r.title}
                rating={r.rating}
                timeStr={`${r.time} min`}
                sourceApp={r.app}
                tint={r.tint}
                imageUrl={r.imageUrl}
                cover={r.cover}
                onPress={() => navigation.navigate('RecipeDetail', { id: r.id })}
              />
            </View>
          ))}
        </View>
      )}
    </>
  );

  const renderPlan = () => (
    <>
      <Text style={styles.planTitle}>This week</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekRow}>
        {DAYS.map((d) => {
          const plan = mealPlan[d.day] || {};
          const hasAny = ['Breakfast', 'Lunch', 'Dinner'].some((s) => plan[s as MealSlot]);
          const sel = selectedDay === d.day;
          return (
            <Pressable
              key={d.day}
              style={[styles.dayPill, sel && styles.dayPillOn]}
              onPress={() => setSelectedDay(d.day)}
            >
              <Text style={[styles.dayPillLabel, sel && styles.dayPillLabelOn]}>{d.day}</Text>
              <Text style={[styles.dayPillDate, sel && styles.dayPillDateOn]}>{d.date}</Text>
              <View style={[styles.dayDot, { backgroundColor: hasAny ? (sel ? '#fff' : c.accent) : 'transparent' }]} />
            </Pressable>
          );
        })}
      </ScrollView>

      {slots.map(({ slot, rec }) => (
        <View key={slot} style={styles.slotBlock}>
          <Text style={styles.slotLabel}>{slot}</Text>
          {rec ? (
            <Pressable
              style={styles.slotCard}
              onPress={() => navigation.navigate('RecipeDetail', { id: rec.id })}
            >
              <View style={[styles.slotThumb, { backgroundColor: rec.tint }]}>
                <Text style={styles.slotThumbIcon}>{TAG_ICON[rec.tags?.[0] ?? ''] ?? '🍽️'}</Text>
              </View>
              <View style={styles.slotInfo}>
                <Text style={styles.slotTitle}>{rec.title}</Text>
                {rec.c > 55 && (
                  <Pressable style={styles.highGi} onPress={() => showToast('AI Sugar Swap — optimising…')}>
                    <Text style={styles.highGiText}>⚠ High GI · AI Swap</Text>
                  </Pressable>
                )}
                <Text style={styles.slotMeta}>
                  {rec.time} min · {rec.kcal} kcal
                </Text>
              </View>
              <Pressable style={styles.removeBtn} onPress={() => removeMeal(selectedDay, slot)}>
                <Text style={styles.removeText}>✕</Text>
              </Pressable>
            </Pressable>
          ) : (
            <Pressable
              style={styles.addSlot}
              onPress={() => setTab('mealplan')}
            >
              <Text style={styles.addSlotText}>+ Add {slot.toLowerCase()}</Text>
            </Pressable>
          )}
        </View>
      ))}

      <View style={styles.dayTotal}>
        <View>
          <Text style={styles.dayTotalLabel}>
            {selectedDay} {DAYS.find((d) => d.day === selectedDay)?.date} total
          </Text>
          <Text style={styles.dayTotalKcal}>
            {dayKcal.toLocaleString()} <Text style={styles.kcalUnit}>kcal</Text>
          </Text>
        </View>
        <View style={styles.macroRow}>
          <Text style={styles.macro}>P {dayP}g</Text>
          <Text style={styles.macro}>C {dayC}g</Text>
          <Text style={styles.macro}>F {dayF}g</Text>
        </View>
      </View>

      <Pressable style={styles.weekGroceryBtn} onPress={addWeekToGrocery}>
        <Icon name="cart" size={18} color="#2A2A2A" />
        <Text style={styles.weekGroceryText}>Add week to grocery list</Text>
      </Pressable>
    </>
  );

  const renderCook = () => (
    <>
      <View style={styles.cookHeader}>
        <Text style={styles.planTitle}>Today's menu</Text>
        <Pressable style={styles.handsFreeBtn} onPress={() => setHandsFree(!handsFree)}>
          {handsFree ? <View style={styles.listeningDot} /> : <Icon name="mic" size={16} color="#fff" />}
          <Text style={styles.handsFreeText}>{handsFree ? 'Listening…' : 'Hands-free'}</Text>
        </Pressable>
      </View>

      {slots
        .filter(({ rec }) => rec)
        .map(({ slot, rec }) =>
          rec ? (
            <View key={slot} style={styles.cookCard}>
              <View style={[styles.slotThumb, { backgroundColor: rec.tint }]}>
                <Text style={styles.slotThumbIcon}>{TAG_ICON[rec.tags?.[0] ?? ''] ?? '🍽️'}</Text>
              </View>
              <View style={styles.slotInfo}>
                <Text style={styles.slotLabel}>{slot}</Text>
                <Text style={styles.slotTitle}>{rec.title}</Text>
                <Text style={styles.slotMeta}>
                  {rec.time} min · {rec.kcal} kcal
                </Text>
              </View>
              <Pressable
                style={styles.cookBtn}
                onPress={() => navigation.navigate('RecipeDetail', { id: rec.id })}
              >
                <Text style={styles.cookBtnText}>Cook →</Text>
              </Pressable>
            </View>
          ) : null,
        )}

      <View style={styles.exchangeCard}>
        <Text style={styles.exchangeLabel}>EXCHANGE UNITS — TODAY</Text>
        <View style={styles.exchangeRow}>
          <View style={styles.exchangeCol}>
            <Text style={styles.exchangeNum}>{(dayC / 10).toFixed(1)}</Text>
            <Text style={styles.exchangeType}>WW</Text>
            <Text style={styles.exchangeSub}>Carb units</Text>
          </View>
          <View style={styles.exchangeDivider} />
          <View style={styles.exchangeCol}>
            <Text style={styles.exchangeNum}>{((dayP + dayF) / 10).toFixed(1)}</Text>
            <Text style={styles.exchangeType}>WBT</Text>
            <Text style={styles.exchangeSub}>Protein–fat units</Text>
          </View>
        </View>
      </View>

      <View style={styles.tipCard}>
        <View style={styles.tipIcon}>
          <Icon name="bulb" size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.tipTitle}>Food sequencing tip</Text>
          <Text style={styles.tipBody}>
            Eat vegetables first → protein → carbs. Reduces blood sugar spikes by up to 40%.
          </Text>
        </View>
      </View>
    </>
  );

  const renderTrack = () => (
    <>
      <View style={styles.statsRow}>
        <View style={styles.statDark}>
          <Text style={styles.statNumLight}>7</Text>
          <Text style={styles.statLabelLight}>day streak</Text>
        </View>
        <View style={styles.statLight}>
          <Text style={styles.statNum}>{recipes.length}</Text>
          <Text style={styles.statLabel}>recipes saved</Text>
        </View>
        <View style={styles.statLight}>
          <Text style={styles.statNum}>{totalPlanned}</Text>
          <Text style={styles.statLabel}>meals planned</Text>
        </View>
      </View>

      <Text style={styles.achieveTitle}>Achievements</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.badgeRow}>
        {[
          { label: 'Vege Explorer', icon: '🌱', earned: true },
          { label: 'Budget Pro', icon: '💰', earned: true },
          { label: 'Zero Waste', icon: '♻️', earned: true },
          { label: 'CGM Master', icon: '📈', earned: false },
        ].map((b) => (
          <View key={b.label} style={styles.badge}>
            <View style={[styles.badgeIcon, !b.earned && styles.badgeIconOff]}>
              <Text style={[styles.badgeEmoji, !b.earned && styles.badgeEmojiOff]}>{b.icon}</Text>
            </View>
            <Text style={[styles.badgeLabel, !b.earned && styles.badgeLabelOff]}>{b.label}</Text>
          </View>
        ))}
      </ScrollView>

      <Text style={styles.achieveTitle}>Glucose data</Text>
      <View style={styles.healthCard}>
        <Text style={styles.healthTitle}>Apple Health / Google Health</Text>
        <Text style={styles.healthBody}>
          Connect a data source to see how each recipe affects your glucose curve.
        </Text>
        <Pressable style={styles.healthBtn} onPress={() => showToast('Coming in a later phase')}>
          <Text style={styles.healthBtnText}>Allow Health data access</Text>
        </Pressable>
      </View>
    </>
  );

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <Image source={require('../../assets/logo-mark.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.brandName}>YumiShare</Text>
        </View>
      </View>

      {renderOrganize()}
    </ScrollView>

    <ActionSheet
      visible={!!coverTarget}
      title={coverTarget?.title ?? 'Cookbook'}
      message="Edit this cookbook"
      options={coverOptions}
      onClose={() => setCoverTarget(null)}
    />
    <ActionSheet
      visible={!!colorTarget}
      title="Pick a colour"
      options={colorOptions}
      onClose={() => setColorTarget(null)}
    />
    <ActionSheet
      visible={sortOpen}
      title={t('home.sortTitle')}
      options={[
        { label: t('home.sort.newest'), onPress: () => setSortBy('newest') },
        { label: t('home.sort.oldest'), onPress: () => setSortBy('oldest') },
        { label: t('home.sort.az'), onPress: () => setSortBy('az') },
        { label: t('home.sort.rating'), onPress: () => setSortBy('rating') },
      ]}
      onClose={() => setSortOpen(false)}
    />
    <PromptModal
      visible={newOpen}
      title={t('home.newCookbook')}
      placeholder="Cookbook name"
      onCancel={() => setNewOpen(false)}
      onConfirm={(title) => {
        setNewOpen(false);
        const id = createCookbook(title);
        setActiveCookbook(id);
        setChip('All');
        setSearch('');
        showToast(`Created “${title}”`);
      }}
    />
    </>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  content: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 130 }, // paddingTop overridden inline with insets
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  logo: { width: 36, height: 36 },
  logoIcon: { color: '#fff', fontSize: 16 },
  brandName: { fontFamily: fonts.displayExtra, fontSize: 23, color: c.ink, letterSpacing: -0.5 },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.surface,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  syncDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.sage },
  syncText: { fontSize: 12, fontWeight: '600', color: c.grayLight },
  homeTabs: { marginBottom: 20, marginHorizontal: -20, paddingHorizontal: 20 },
  homeTab: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: c.surfaceAlt,
    marginRight: 6,
  },
  homeTabOn: { backgroundColor: c.accent },
  homeTabText: { fontSize: 13.5, fontWeight: '700', color: c.grayLight },
  homeTabTextOn: { color: '#fff' },
  headline: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 34,
    color: c.ink,
    letterSpacing: -0.8,
    marginBottom: 16,
  },
  importPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: c.accent,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    shadowColor: c.accent,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 22,
    elevation: 4,
  },
  importTextWrap: { flex: 1 },
  importChevron: { color: 'rgba(255,255,255,0.85)', fontSize: 24, fontWeight: '400' },
  scanRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  scanCard: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: c.border,
    shadowColor: '#211C18',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  scanIconSage: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: c.sageSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 11,
  },
  scanIconGold: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: c.warning,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 11,
  },
  scanTitle: { fontSize: 14.5, fontWeight: '700', color: c.ink, marginBottom: 1 },
  scanSub: { fontSize: 11.5, fontWeight: '500', color: c.grayMid },
  importSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: c.surface,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: c.border,
    shadowColor: '#211C18',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 2,
  },
  importIconLight: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  importIconDark: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: c.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 2 },
  importTitleDark: { fontSize: 13.5, fontWeight: '700', color: c.ink },
  importSub: { fontSize: 12.5, fontWeight: '500', color: 'rgba(255,255,255,0.78)' },
  importSubGray: { fontSize: 11, fontWeight: '500', color: c.grayMid, marginTop: 2 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: c.surface,
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 13,
    marginBottom: 16,
    shadowColor: '#211C18',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '500', color: c.ink },
  searchClear: { fontSize: 14, fontWeight: '700', color: c.grayMid, paddingHorizontal: 2 },
  suggestBox: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 14,
    marginTop: -8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  suggestRowLast: { borderBottomWidth: 0 },
  suggestText: { flex: 1, fontSize: 14.5, fontWeight: '600', color: c.ink },
  chipRow: { marginBottom: 22, marginHorizontal: -20, paddingHorizontal: 20 },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 15,
    borderRadius: 999,
    backgroundColor: c.surfaceAlt,
    marginRight: 8,
  },
  chipOn: { backgroundColor: c.accent },
  chipText: { fontSize: 13.5, fontWeight: '600', color: c.ink },
  chipTextOn: { color: '#fff' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: { fontFamily: fonts.display, fontSize: 18, color: c.ink },
  sectionLink: { fontSize: 13, fontWeight: '600', color: c.ink },
  countLabel: { fontSize: 13, fontWeight: '600', color: c.grayMid },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.surfaceAlt,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 999,
  },
  sortText: { fontSize: 12.5, fontWeight: '700', color: c.ink },
  cookbookRow: { marginBottom: 26, marginHorizontal: -20, paddingHorizontal: 20 },
  cookbookGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 },
  cookbook: { width: 142, marginRight: 12 },
  cookbookCover: {
    height: 96,
    borderRadius: 18,
    justifyContent: 'flex-end',
    padding: 12,
    overflow: 'hidden',
  },
  cookbookAdd: {
    height: 96,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: c.border,
    borderStyle: 'dashed',
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cookbookAddText: { fontSize: 12.5, fontWeight: '700', color: c.grayMid },
  cookbookImg: { ...StyleSheet.absoluteFillObject },
  cookbookOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.32)' },
  cookbookEdit: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cookbookTitle: { color: '#fff', fontWeight: '700', fontSize: 14.5 },
  cookbookCount: { fontSize: 12.5, fontWeight: '600', color: c.grayMid, marginTop: 7 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -7 },
  gridItem: { width: '50%', paddingHorizontal: 7 },
  empty: { textAlign: 'center', paddingVertical: 40, fontSize: 15, fontWeight: '600', color: c.grayMid },
  planTitle: { fontFamily: fonts.display, fontSize: 26, color: c.ink, marginBottom: 18 },
  weekRow: { marginBottom: 22, marginHorizontal: -20, paddingHorizontal: 20 },
  dayPill: {
    width: 50,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: c.surface,
    marginRight: 8,
  },
  dayPillOn: { backgroundColor: c.accent },
  dayPillLabel: { fontSize: 11.5, fontWeight: '700', color: c.grayMid },
  dayPillLabelOn: { color: 'rgba(255,255,255,0.85)' },
  dayPillDate: { fontFamily: fonts.display, fontSize: 17, fontWeight: '700', color: c.ink, marginTop: 6 },
  dayPillDateOn: { color: '#fff' },
  dayDot: { width: 5, height: 5, borderRadius: 3, marginTop: 6 },
  slotBlock: { marginBottom: 14 },
  slotLabel: { fontSize: 13, fontWeight: '700', color: c.grayLight, marginBottom: 9, paddingLeft: 2 },
  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: c.surface,
    borderRadius: 18,
    padding: 11,
  },
  slotThumb: { width: 62, height: 62, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  slotThumbIcon: { fontSize: 26 },
  slotInfo: { flex: 1 },
  slotTitle: { fontSize: 15, fontWeight: '700', color: c.ink },
  slotMeta: { fontSize: 12, fontWeight: '600', color: c.grayMid, marginTop: 4 },
  highGi: {
    alignSelf: 'flex-start',
    backgroundColor: c.warning,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginVertical: 4,
  },
  highGiText: { fontSize: 11, fontWeight: '700', color: c.warningText },
  removeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F3F3F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: c.gray, fontSize: 14 },
  addSlot: {
    borderWidth: 1.5,
    borderColor: '#DADADA',
    borderStyle: 'dashed',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
  },
  addSlotText: { fontSize: 14, fontWeight: '700', color: c.gray },
  dayTotal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.surface,
    borderRadius: 18,
    padding: 16,
    marginTop: 6,
  },
  dayTotalLabel: { fontSize: 13, fontWeight: '600', color: c.grayMid },
  dayTotalKcal: { fontFamily: fonts.display, fontSize: 24, fontWeight: '700', color: c.ink, marginTop: 2 },
  kcalUnit: { fontSize: 14, fontWeight: '600', color: c.grayMid },
  macroRow: { flexDirection: 'row', gap: 16 },
  macro: { fontSize: 14, fontWeight: '700', color: c.ink },
  weekGroceryBtn: {
    backgroundColor: '#EBEBEB',
    borderRadius: 16,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  weekGroceryText: { fontSize: 15, fontWeight: '700', color: '#2A2A2A' },
  cookHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  handsFreeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: c.accent,
    paddingVertical: 9,
    paddingHorizontal: 15,
    borderRadius: 999,
  },
  listeningDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80' },
  handsFreeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  cookCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: c.surface,
    borderRadius: 18,
    padding: 11,
    marginBottom: 10,
  },
  cookBtn: {
    backgroundColor: c.accent,
    paddingVertical: 9,
    paddingHorizontal: 15,
    borderRadius: 999,
  },
  cookBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  exchangeCard: {
    backgroundColor: c.surface,
    borderRadius: 18,
    padding: 16,
    marginTop: 12,
    marginBottom: 14,
  },
  exchangeLabel: { fontSize: 12, fontWeight: '700', color: c.grayMid, marginBottom: 12 },
  exchangeRow: { flexDirection: 'row' },
  exchangeCol: { flex: 1, alignItems: 'center' },
  exchangeDivider: { width: 1, backgroundColor: '#F0F0EE' },
  exchangeNum: { fontFamily: fonts.displayExtra, fontSize: 32, color: c.ink },
  exchangeType: { fontSize: 12, fontWeight: '700', color: c.grayLight, marginTop: 2 },
  exchangeSub: { fontSize: 11, fontWeight: '500', color: '#BEBEBE', marginTop: 2 },
  tipCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: c.surfaceAlt,
    borderRadius: 16,
    padding: 14,
  },
  tipIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipTitle: { fontSize: 13, fontWeight: '700', color: c.ink, marginBottom: 3 },
  tipBody: { fontSize: 12.5, fontWeight: '500', color: c.grayLight, lineHeight: 18 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statDark: {
    flex: 1,
    backgroundColor: c.accent,
    borderRadius: 18,
    padding: 14,
    alignItems: 'center',
  },
  statLight: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: 18,
    padding: 14,
    alignItems: 'center',
  },
  statNumLight: { fontFamily: fonts.displayExtra, fontSize: 28, color: '#fff' },
  statNum: { fontFamily: fonts.displayExtra, fontSize: 28, color: c.ink },
  statLabelLight: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.55)', marginTop: 3 },
  statLabel: { fontSize: 11, fontWeight: '700', color: c.grayMid, marginTop: 3 },
  achieveTitle: { fontFamily: fonts.display, fontSize: 17, color: c.ink, marginBottom: 12 },
  badgeRow: { marginBottom: 22, marginHorizontal: -20, paddingHorizontal: 20 },
  badge: { width: 90, alignItems: 'center', marginRight: 10 },
  badgeIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  badgeIconOff: { backgroundColor: c.surfaceAlt, borderWidth: 1.5, borderColor: '#DADADA', borderStyle: 'dashed' },
  badgeEmoji: { fontSize: 24 },
  badgeEmojiOff: { opacity: 0.35 },
  badgeLabel: { fontSize: 11, fontWeight: '700', color: c.ink, textAlign: 'center' },
  badgeLabelOff: { color: '#BEBEBE' },
  healthCard: {
    backgroundColor: c.surface,
    borderRadius: 18,
    padding: 15,
    marginBottom: 14,
  },
  healthTitle: { fontSize: 14.5, fontWeight: '700', color: c.ink, marginBottom: 8 },
  healthBody: { fontSize: 12.5, fontWeight: '500', color: c.grayLight, lineHeight: 18, marginBottom: 12 },
  healthBtn: {
    backgroundColor: c.accent,
    borderRadius: 13,
    paddingVertical: 13,
    alignItems: 'center',
  },
  healthBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
