import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SLOTS } from '../data/seed';
import { useApp } from '../context/AppContext';
import { MealAddSheet } from '../components/MealAddSheet';
import { CalendarSheet } from '../components/CalendarSheet';
import { WaterCard } from '../components/WaterCard';
import { ReorderableWidgets } from '../components/ReorderableWidgets';
import { addDaysISO, dayOfMonth, isTodayISO, rangeISO, todayISO, weekdayKey } from '../utils/dates';
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
    addWeekToGrocery, addRecipeToGrocery, showToast, water, addWater, weightKg, setWeight,
    mealPlanWidgetOrder, setMealPlanWidgetOrder,
  } = useApp();
  const [selectedDate, setSelectedDate] = useState<string>(todayISO());
  const [addOpen, setAddOpen] = useState(false);
  const [addSlot, setAddSlot] = useState<MealSlot>('Dinner');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [widgetsDragging, setWidgetsDragging] = useState(false);
  const insets = useSafeAreaInsets();

  const stripRef = useRef<FlatList<string>>(null);
  const PILL_W = 58; // pill width (50) + marginRight (8)

  // A wide, continuous strip (≈2 months back, a year ahead) so you can scroll
  // freely in both directions; it extends further if a more distant day is
  // picked from the calendar. Start/end are stable for in-range taps so the
  // list doesn't rebuild on every selection.
  const today = todayISO();
  const backEnd = addDaysISO(today, -60);
  const fwdEnd = addDaysISO(today, 365);
  const start = selectedDate < backEnd ? selectedDate : backEnd;
  const end = selectedDate > fwdEnd ? selectedDate : fwdEnd;
  const days = useMemo(() => rangeISO(start, end), [start, end]);

  // Keep the selected day scrolled into view (centered).
  useEffect(() => {
    const i = days.indexOf(selectedDate);
    if (i < 0) return;
    requestAnimationFrame(() => {
      try { stripRef.current?.scrollToIndex({ index: i, viewPosition: 0.5, animated: true }); } catch {}
    });
  }, [selectedDate, days]);

  const dayPlan = mealPlan[selectedDate] || {};
  const dayHasMeals = (iso: string) => {
    const p = mealPlan[iso];
    return !!p && SLOTS.some((s) => p[s]);
  };
  const dayLabel = `${isTodayISO(selectedDate) ? t('mealplan.today') : t(`day.${weekdayKey(selectedDate)}` as TKey)} ${dayOfMonth(selectedDate)}`;

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
  // Calorie contribution of each macro (4/4/9 kcal per gram) → the split bar.
  const pCal = dayP * 4, cCal = dayC * 4, fCal = dayF * 9;
  const macroCal = pCal + cCal + fCal;
  const macroLegend = [
    { color: c.sage, label: t('recipe.protein'), val: dayP },
    { color: c.gold, label: t('recipe.carbs'), val: dayC },
    { color: c.accent, label: t('recipe.fat'), val: dayF },
  ];

  // Fall back to the default set if the persisted order is missing/stale
  // (e.g. it was saved before a widget existed).
  const DEFAULT_WIDGETS = ['nutrition', 'water', 'slots'];
  const widgetOrder = mealPlanWidgetOrder?.length
    ? DEFAULT_WIDGETS.filter((w) => mealPlanWidgetOrder.includes(w)).length === DEFAULT_WIDGETS.length
      ? mealPlanWidgetOrder
      : [...mealPlanWidgetOrder, ...DEFAULT_WIDGETS.filter((w) => !mealPlanWidgetOrder.includes(w))]
    : DEFAULT_WIDGETS;

  const renderWidget = (key: string, dragHandle: React.ReactNode) => {
    if (key === 'nutrition') {
      return (
        <View style={styles.dayCard}>
          <View style={styles.dayCardTop}>
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.dayCardLabel}>{t('mealplan.dayNutrition')}</Text>
              <Text style={styles.dayCardDay}>{dayLabel}</Text>
            </View>
            <View style={styles.dayCardKcalRow}>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.dayCardKcal}>{dayKcal.toLocaleString()}</Text>
                <Text style={styles.dayCardKcalUnit}>kcal</Text>
              </View>
              {dragHandle}
            </View>
          </View>

          {macroCal > 0 ? (
            <>
              <View style={styles.splitBar}>
                <View style={{ flex: pCal, backgroundColor: c.sage }} />
                <View style={{ flex: cCal, backgroundColor: c.gold }} />
                <View style={{ flex: fCal, backgroundColor: c.accent }} />
              </View>
              <View style={styles.legendRow}>
                {macroLegend.map((m, i) => (
                  <View key={i} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: m.color }]} />
                    <Text style={styles.legendVal}>{m.val}g</Text>
                    <Text style={styles.legendLabel}>{m.label}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <Text style={styles.dayCardEmpty}>{t('mealplan.noMeals')}</Text>
          )}
        </View>
      );
    }
    if (key === 'water') {
      return (
        <WaterCard
          intakeMl={water?.[selectedDate] ?? 0}
          weightKg={weightKg ?? 0}
          onAdd={(ml) => addWater(selectedDate, ml)}
          onSetWeight={setWeight}
          dragHandle={dragHandle}
        />
      );
    }
    if (key === 'slots') {
      return (
        <View>
          <View style={styles.slotsHeader}>
            <Text style={styles.slotsHeaderLabel}>{t('mealplan.mealsLabel' as TKey)}</Text>
            {dragHandle}
          </View>
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
                    onRemove={() => removeMeal(selectedDate, slot)}
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
        </View>
      );
    }
    return null;
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        scrollEnabled={!widgetsDragging}
      >
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('mealplan.title')}</Text>
            <Text style={styles.sub}>{t('mealplan.sub')}</Text>
          </View>
          <Pressable style={styles.calBtn} onPress={() => setCalendarOpen(true)} hitSlop={8}>
            <Icon name="calendar" size={20} color={c.accent} />
          </Pressable>
        </View>

        {/* Day strip — continuous from today's window through the selected day */}
        <FlatList
          ref={stripRef}
          data={days}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.weekRow}
          contentContainerStyle={styles.weekRowContent}
          keyExtractor={(iso) => iso}
          getItemLayout={(_, i) => ({ length: PILL_W, offset: PILL_W * i, index: i })}
          initialScrollIndex={Math.max(0, days.indexOf(selectedDate))}
          onScrollToIndexFailed={() => {}}
          renderItem={({ item: iso }) => {
            const hasAny = dayHasMeals(iso);
            const sel = selectedDate === iso;
            const today = isTodayISO(iso);
            return (
              <Pressable
                style={[styles.dayPill, sel && styles.dayPillOn, today && !sel && styles.dayPillToday]}
                onPress={() => setSelectedDate(iso)}
              >
                <Text style={[styles.dayLabel, sel && styles.dayLabelOn]}>
                  {today ? t('mealplan.today') : t(`day.${weekdayKey(iso)}` as TKey)}
                </Text>
                <Text style={[styles.dayDate, sel && styles.dayDateOn]}>{dayOfMonth(iso)}</Text>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: hasAny ? (sel ? '#fff' : c.accent) : 'transparent' },
                  ]}
                />
              </Pressable>
            );
          }}
        />

        {/* Reorderable widgets: nutrition dashboard + water tracker — drag by
            the grip handle to rearrange, like home-screen widgets. */}
        <View style={styles.widgetsBlock}>
          <ReorderableWidgets
            order={widgetOrder}
            onReorder={setMealPlanWidgetOrder}
            renderItem={renderWidget}
            onDragStateChange={setWidgetsDragging}
          />
        </View>

        <Pressable style={styles.weekBtn} onPress={addWeekToGrocery}>
          <Text style={styles.weekBtnText}>{t('mealplan.addWeek')}</Text>
        </Pressable>
      </ScrollView>

      <MealAddSheet
        visible={addOpen}
        slot={addSlot}
        dayLabel={dayLabel}
        onClose={() => setAddOpen(false)}
        onAdd={(entry) => {
          assignMeal(selectedDate, addSlot, entry);
          setAddOpen(false);
          showToast(t('mealplan.slot.added' as TKey, { slot: t(`slot.${addSlot}` as TKey) }));
        }}
      />

      <CalendarSheet
        visible={calendarOpen}
        selected={selectedDate}
        hasMeals={dayHasMeals}
        onSelect={setSelectedDate}
        onClose={() => setCalendarOpen(false)}
      />
    </>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 130 },
    titleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18 },
    title: { fontFamily: fonts.display, fontSize: 28, color: c.ink },
    sub: { fontSize: 14, fontWeight: '600', color: c.grayMid, marginTop: 4 },
    calBtn: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center', marginTop: 4,
    },
    weekRow: { marginBottom: 22, marginHorizontal: -20 },
    weekRowContent: { paddingHorizontal: 20 },
    dayPill: {
      width: 50, borderRadius: 16, paddingVertical: 12,
      alignItems: 'center', backgroundColor: c.surface, marginRight: 8,
    },
    dayPillOn: { backgroundColor: c.accent },
    dayPillToday: { borderWidth: 1.5, borderColor: c.accent },
    dayLabel: { fontSize: 11.5, fontWeight: '700', color: c.grayMid },
    dayLabelOn: { color: 'rgba(255,255,255,0.85)' },
    dayDate: { fontFamily: fonts.display, fontSize: 17, fontWeight: '700', color: c.ink, marginTop: 6 },
    dayDateOn: { color: '#fff' },
    dot: { width: 5, height: 5, borderRadius: 3, marginTop: 6 },

    slotsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    slotsHeaderLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, color: c.accent, textTransform: 'uppercase' },
    slotBlock: { marginBottom: 14 },
    slotLabel: { fontSize: 13, fontWeight: '700', color: c.grayLight, marginBottom: 9 },

    slotCard: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 13,
      backgroundColor: c.surface, borderRadius: 18, padding: 11,
      borderWidth: 1.5, borderColor: 'transparent',
    },
    slotCardFull: { borderColor: c.successBorder, backgroundColor: c.successBg },
    slotCardPartial: { borderColor: c.gold, backgroundColor: c.warning },

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
    badgePartial: { backgroundColor: c.warning },
    badgeDot: { fontSize: 7, lineHeight: 12 },
    badgeText: { fontSize: 11.5, fontWeight: '700' },
    badgeTextFull: { color: '#15803d' },
    badgeTextPartial: { color: c.warningText },
    badgeArrow: { fontSize: 14, color: c.warningText, lineHeight: 16 },

    remove: {
      width: 30, height: 30, borderRadius: 15,
      backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    },

    addSlot: {
      borderWidth: 1.5, borderColor: c.border, borderStyle: 'dashed',
      borderRadius: 18, paddingVertical: 18, alignItems: 'center',
    },
    addText: { fontSize: 14, fontWeight: '700', color: c.gray },

    dayCard: {
      backgroundColor: c.surface, borderRadius: 18,
      borderWidth: 1, borderColor: c.border,
      padding: 16,
    },
    widgetsBlock: { marginBottom: 22 },
    dayCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
    dayCardKcalRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
    dayCardLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, color: c.accent, textTransform: 'uppercase' },
    dayCardDay: { fontFamily: fonts.display, fontSize: 18, color: c.ink, marginTop: 3 },
    dayCardKcal: { fontFamily: fonts.display, fontSize: 30, fontWeight: '700', color: c.ink },
    dayCardKcalUnit: { fontSize: 12, fontWeight: '700', color: c.grayMid, marginTop: -2 },
    splitBar: {
      flexDirection: 'row', height: 10, borderRadius: 6, overflow: 'hidden',
      backgroundColor: c.surfaceAlt, marginTop: 16, gap: 2,
    },
    legendRow: { flexDirection: 'row', marginTop: 12, gap: 8 },
    legendItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendVal: { fontSize: 14, fontWeight: '700', color: c.ink },
    legendLabel: { fontSize: 12, fontWeight: '600', color: c.grayMid },
    dayCardEmpty: { fontSize: 13, fontWeight: '600', color: c.grayMid, marginTop: 14 },

    weekBtn: { backgroundColor: c.surfaceAlt, borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
    weekBtnText: { fontSize: 15, fontWeight: '700', color: c.grayLight },
  });
