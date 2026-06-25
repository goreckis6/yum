import React, { useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DAYS, SLOTS } from '../data/seed';
import { useApp } from '../context/AppContext';
import { MealAddSheet } from '../components/MealAddSheet';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { DayKey, MealEntry, MealSlot, Recipe, TAG_ICON } from '../types';
import { RootStackParamList } from '../navigation/types';
import { useI18n } from '../i18n/I18nContext';
import type { TKey } from '../i18n/translations';
import { matchIngredients, MatchResult } from '../lib/ingredientMatch';
import { Icon } from '../components/Icon';

const ADD_SLOT: Record<MealSlot, TKey> = {
  Breakfast: 'slot.addBreakfast',
  SecondBreakfast: 'slot.addSecondBreakfast',
  Lunch: 'slot.addLunch',
  Dinner: 'slot.addDinner',
  Snack: 'slot.addSnack',
  Supper: 'slot.addSupper',
};

/* ─── MatchBadge ─────────────────────────────────────────────── */

function MatchBadge({
  match, recipe, styles, t, onAddMissing,
}: {
  match: MatchResult;
  recipe: Recipe;
  styles: ReturnType<typeof makeStyles>;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
  onAddMissing: (missing: string[], recipe: Recipe) => void;
}) {
  if (match.total === 0) return null;

  const isFull = match.missing.length === 0;
  const count = match.missing.length;

  if (isFull) {
    return (
      <View style={[styles.badge, styles.badgeFull]}>
        <Text style={styles.badgeDot}>●</Text>
        <Text style={[styles.badgeText, styles.badgeTextFull]}>
          {t('mealplan.match.full')}
        </Text>
      </View>
    );
  }

  const label = count === 1
    ? t('mealplan.match.partial', { count })
    : t('mealplan.match.partialPlural', { count });

  return (
    <Pressable
      style={[styles.badge, styles.badgePartial]}
      onPress={() => onAddMissing(match.missing, recipe)}
      hitSlop={6}
    >
      <Text style={styles.badgeDot}>●</Text>
      <Text style={[styles.badgeText, styles.badgeTextPartial]}>{label}</Text>
      <Text style={styles.badgeArrow}>›</Text>
    </Pressable>
  );
}

/* ─── SlotEntryCard ──────────────────────────────────────────── */

function SlotEntryCard({
  entry, match, getRecipe, getPantryItem, styles, t, onRemove, onPressRecipe, onAddMissing,
}: {
  entry: MealEntry;
  match?: MatchResult;
  getRecipe: (id: string) => Recipe | undefined;
  getPantryItem: (id: string) => import('../types').PantryItem | undefined;
  styles: ReturnType<typeof makeStyles>;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
  onRemove: () => void;
  onPressRecipe: (id: string) => void;
  onAddMissing: (missing: string[], recipe: Recipe) => void;
}) {
  if (entry.type === 'recipe') {
    const rec = getRecipe(entry.recipeId);
    if (!rec) return null;
    return (
      <Pressable
        style={[
          styles.slotCard,
          match && match.missing.length === 0 && styles.slotCardFull,
          match && match.missing.length > 0 && styles.slotCardPartial,
        ]}
        onPress={() => onPressRecipe(rec.id)}
      >
        {rec.imageUrl ? (
          <Image source={{ uri: rec.imageUrl }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, { backgroundColor: rec.tint }]}>
            <Text style={styles.thumbIcon}>{TAG_ICON[rec.tags?.[0] ?? ''] ?? '🍽️'}</Text>
          </View>
        )}
        <View style={styles.cardBody}>
          <Text style={styles.slotTitle}>{rec.title}</Text>
          <Text style={styles.slotMeta}>{rec.time} min · {rec.kcal} kcal</Text>
          {match && (
            <MatchBadge match={match} recipe={rec} styles={styles} t={t} onAddMissing={onAddMissing} />
          )}
        </View>
        <Pressable style={styles.remove} onPress={onRemove}><Text>✕</Text></Pressable>
      </Pressable>
    );
  }

  const isPantry = entry.type === 'pantry';
  const tint = isPantry ? '#dcfce7' : '#dbeafe';
  const brand = entry.type === 'food' ? entry.brand : undefined;
  const pantryImg = isPantry ? getPantryItem((entry as any).pantryId)?.imageUrl : undefined;
  const foodImg = entry.type === 'food' ? entry.imageUrl : undefined;
  const thumbImg = pantryImg || foodImg;

  return (
    <View style={styles.slotCard}>
      {thumbImg ? (
        <Image source={{ uri: thumbImg }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, { backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }]}>
          <Icon name={isPantry ? 'barcode' : 'link'} size={22} color={isPantry ? '#15803d' : '#1d4ed8'} />
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.slotTitle}>{entry.name}</Text>
        {brand ? <Text style={styles.slotMeta}>{brand}</Text> : null}
        <Text style={styles.slotMeta}>
          {t('mealplan.entry.grams' as TKey, { g: entry.grams, kcal: entry.kcal })}
        </Text>
      </View>
      <Pressable style={styles.remove} onPress={onRemove}><Text>✕</Text></Pressable>
    </View>
  );
}

/* ─── Screen ─────────────────────────────────────────────────── */

export function MealPlanScreen() {
  const c = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    mealPlan, pantry, getRecipe, getPantryItem, assignMeal, removeMeal,
    addWeekToGrocery, addRecipeToGrocery, showToast,
  } = useApp();
  const [selectedDay, setSelectedDay] = useState<DayKey>('Wed');
  const [addOpen, setAddOpen] = useState(false);
  const [addSlot, setAddSlot] = useState<MealSlot>('Dinner');
  const insets = useSafeAreaInsets();

  const dayPlan = mealPlan[selectedDay] || {};

  // Pre-compute pantry match only for recipe entries
  const matches = useMemo(() => {
    const pantryItems = pantry ?? [];
    const result: Partial<Record<MealSlot, MatchResult>> = {};
    for (const slot of SLOTS) {
      const entry = dayPlan[slot];
      if (!entry || entry.type !== 'recipe') continue;
      const rec = getRecipe(entry.recipeId);
      if (rec && rec.ingredients.length > 0) {
        result[slot] = matchIngredients(rec.ingredients, pantryItems);
      }
    }
    return result;
  }, [dayPlan, pantry, getRecipe]);

  const handleAddMissing = (missing: string[], recipe: Recipe) => {
    Alert.alert(
      t('mealplan.match.addMissing' as TKey),
      missing.slice(0, 6).join('\n') + (missing.length > 6 ? `\n+${missing.length - 6}…` : ''),
      [
        { text: t('common.cancel' as TKey), style: 'cancel' },
        {
          text: t('mealplan.match.addBtn' as TKey),
          onPress: () => {
            addRecipeToGrocery(recipe.id);
            showToast(t('mealplan.match.addBtn' as TKey));
          },
        },
      ],
    );
  };

  let dayKcal = 0, dayP = 0, dayC = 0, dayF = 0;
  for (const slot of SLOTS) {
    const entry = dayPlan[slot];
    if (!entry) continue;
    if (entry.type === 'recipe') {
      const rec = getRecipe(entry.recipeId);
      if (rec) { dayKcal += rec.kcal; dayP += rec.p; dayC += rec.c; dayF += rec.f; }
    } else {
      dayKcal += entry.kcal; dayP += entry.p; dayC += entry.c; dayF += entry.f;
    }
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      >
        <Text style={styles.title}>{t('mealplan.title')}</Text>
        <Text style={styles.sub}>{t('mealplan.sub')}</Text>

        {/* Day strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekRow}>
          {DAYS.map((d) => {
            const plan = mealPlan[d.day] || {};
            const hasAny = SLOTS.some((s) => plan[s]);
            const sel = selectedDay === d.day;
            return (
              <Pressable
                key={d.day}
                style={[styles.dayPill, sel && styles.dayPillOn]}
                onPress={() => setSelectedDay(d.day)}
              >
                <Text style={[styles.dayLabel, sel && styles.dayLabelOn]}>
                  {t(`day.${d.day}` as TKey)}
                </Text>
                <Text style={[styles.dayDate, sel && styles.dayDateOn]}>{d.date}</Text>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: hasAny ? (sel ? '#fff' : c.accent) : 'transparent' },
                  ]}
                />
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Slots */}
        {SLOTS.map((slot) => {
          const entry = dayPlan[slot];
          const match = matches[slot];

          return (
            <View key={slot} style={styles.slotBlock}>
              <Text style={styles.slotLabel}>{t(`slot.${slot}` as TKey)}</Text>
              {entry ? (
                <SlotEntryCard
                  entry={entry}
                  match={match}
                  getRecipe={getRecipe}
                  getPantryItem={getPantryItem}
                  styles={styles}
                  t={t}
                  onRemove={() => removeMeal(selectedDay, slot)}
                  onPressRecipe={(id) => navigation.navigate('RecipeDetail', { id })}
                  onAddMissing={handleAddMissing}
                />
              ) : (
                <Pressable
                  style={styles.addSlot}
                  onPress={() => { setAddSlot(slot); setAddOpen(true); }}
                >
                  <Text style={styles.addText}>{t(ADD_SLOT[slot])}</Text>
                </Pressable>
              )}
            </View>
          );
        })}

        {/* Daily totals */}
        <View style={styles.totals}>
          <Text style={styles.totalsLabel}>
            {t('mealplan.dayTotal', {
              day: t(`day.${selectedDay}` as TKey),
              date: DAYS.find((d) => d.day === selectedDay)?.date ?? '',
            })}
          </Text>
          <Text style={styles.totalsKcal}>{dayKcal.toLocaleString()} kcal</Text>
          <Text style={styles.macros}>P {dayP}g · C {dayC}g · F {dayF}g</Text>
        </View>

        <Pressable style={styles.weekBtn} onPress={addWeekToGrocery}>
          <Text style={styles.weekBtnText}>{t('mealplan.addWeek')}</Text>
        </Pressable>
      </ScrollView>

      <MealAddSheet
        visible={addOpen}
        slot={addSlot}
        day={selectedDay}
        onClose={() => setAddOpen(false)}
        onAdd={(entry) => {
          assignMeal(selectedDay, addSlot, entry);
          setAddOpen(false);
          showToast(t('mealplan.slot.added' as TKey, { slot: t(`slot.${addSlot}` as TKey) }));
        }}
      />
    </>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 130 },
    title: { fontFamily: fonts.display, fontSize: 28, color: c.ink },
    sub: { fontSize: 14, fontWeight: '600', color: c.grayMid, marginTop: 4, marginBottom: 18 },
    weekRow: { marginBottom: 22, marginHorizontal: -20, paddingHorizontal: 20 },
    dayPill: {
      width: 50, borderRadius: 16, paddingVertical: 12,
      alignItems: 'center', backgroundColor: c.surface, marginRight: 8,
    },
    dayPillOn: { backgroundColor: c.accent },
    dayLabel: { fontSize: 11.5, fontWeight: '700', color: c.grayMid },
    dayLabelOn: { color: 'rgba(255,255,255,0.85)' },
    dayDate: { fontFamily: fonts.display, fontSize: 17, fontWeight: '700', color: c.ink, marginTop: 6 },
    dayDateOn: { color: '#fff' },
    dot: { width: 5, height: 5, borderRadius: 3, marginTop: 6 },

    slotBlock: { marginBottom: 14 },
    slotLabel: { fontSize: 13, fontWeight: '700', color: c.grayLight, marginBottom: 9 },

    slotCard: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 13,
      backgroundColor: c.surface, borderRadius: 18, padding: 11,
      borderWidth: 1.5, borderColor: 'transparent',
    },
    slotCardFull: { borderColor: '#86efac', backgroundColor: '#f0fdf4' },
    slotCardPartial: { borderColor: '#fde68a', backgroundColor: '#fffbeb' },

    thumb: {
      width: 62, height: 62, borderRadius: 13,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      overflow: 'hidden',
    },
    thumbIcon: { fontSize: 26 },
    cardBody: { flex: 1 },
    slotTitle: { fontSize: 15, fontWeight: '700', color: c.ink },
    slotMeta: { fontSize: 12, fontWeight: '600', color: c.grayMid, marginTop: 4 },

    /* Match badge */
    badge: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4,
      alignSelf: 'flex-start', marginTop: 7,
    },
    badgeFull: { backgroundColor: '#dcfce7' },
    badgePartial: { backgroundColor: '#fef3c7' },
    badgeDot: { fontSize: 7, lineHeight: 12 },
    badgeText: { fontSize: 11.5, fontWeight: '700' },
    badgeTextFull: { color: '#15803d' },
    badgeTextPartial: { color: '#92400e' },
    badgeArrow: { fontSize: 14, color: '#92400e', lineHeight: 16 },

    remove: {
      width: 30, height: 30, borderRadius: 15,
      backgroundColor: '#F3F3F3', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    },

    addSlot: {
      borderWidth: 1.5, borderColor: '#DADADA', borderStyle: 'dashed',
      borderRadius: 18, paddingVertical: 18, alignItems: 'center',
    },
    addText: { fontSize: 14, fontWeight: '700', color: c.gray },

    totals: {
      backgroundColor: c.surface, borderRadius: 18,
      padding: 16, marginTop: 6, marginBottom: 14,
    },
    totalsLabel: { fontSize: 13, fontWeight: '600', color: c.grayMid },
    totalsKcal: { fontFamily: fonts.display, fontSize: 24, fontWeight: '700', color: c.ink, marginTop: 2 },
    macros: { fontSize: 13, fontWeight: '600', color: c.grayMid, marginTop: 6 },

    weekBtn: { backgroundColor: '#EBEBEB', borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
    weekBtnText: { fontSize: 15, fontWeight: '700', color: '#2A2A2A' },
  });
