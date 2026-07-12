import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, FlatList, Image, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SLOTS } from '../data/seed';
import { useApp } from '../context/AppContext';
import { MealAddSheet } from '../components/MealAddSheet';
import { CalendarSheet } from '../components/CalendarSheet';
import { WaterCard } from '../components/WaterCard';
import { ReorderableWidgets } from '../components/ReorderableWidgets';
import { addDaysISO, dayOfMonth, isTodayISO, monthLabelForISO, rangeISO, todayISO, weekdayKey } from '../utils/dates';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { centeredContent } from '../theme/layout';
import { DayKey, MealEntry, MealSlot, Recipe, TAG_ICON } from '../types';
import { RootStackParamList } from '../navigation/types';
import { useI18n } from '../i18n/I18nContext';
import type { TKey } from '../i18n/translations';
import { matchIngredients, MatchResult } from '../lib/ingredientMatch';
import { Icon } from '../components/Icon';
import { MealReminderSheet } from '../components/MealReminderSheet';
import { defaultSlotTime } from '../lib/notifications';

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
  entry, match, getRecipe, getPantryItem, styles, t, onRemove, onPressRecipe, onAddMissing, onEditReminder, hasReminderOverride, c, dragHandlers,
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
  onEditReminder: () => void;
  hasReminderOverride: boolean;
  c: ThemeColors;
  dragHandlers?: object;
}) {
  const actions = (
    <View style={styles.entryActions}>
      {dragHandlers && (
        <View {...dragHandlers} style={styles.reminderBtn} hitSlop={6}>
          <Icon name="grip" size={15} color={c.grayMid} />
        </View>
      )}
      <Pressable style={styles.reminderBtn} onPress={onEditReminder} hitSlop={6}>
        <Icon name="clock" size={15} color={hasReminderOverride ? c.accent : c.grayMid} />
      </Pressable>
      <Pressable style={styles.remove} onPress={onRemove}><Text>✕</Text></Pressable>
    </View>
  );

  if (entry.type === 'recipe') {
    const rec = getRecipe(entry.recipeId);
    if (!rec) return null;
    return (
      <View
        style={[
          styles.slotCard,
          match && match.missing.length === 0 && styles.slotCardFull,
          match && match.missing.length > 0 && styles.slotCardPartial,
        ]}
      >
        <Pressable style={styles.slotCardTouchable} onPress={() => onPressRecipe(rec.id)}>
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
        </Pressable>
        {actions}
      </View>
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
      {actions}
    </View>
  );
}

/* ─── Screen ─────────────────────────────────────────────────── */

export function MealPlanScreen() {
  const c = useTheme();
  const { t, lang } = useI18n();
  const styles = useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    mealPlan, pantry, getRecipe, getPantryItem, assignMeal, removeMeal, copyDayMeals,
    addWeekToGrocery, addRecipeToGrocery, showToast, water, addWater, weightKg, setWeight,
    mealPlanWidgetOrder, setMealPlanWidgetOrder,
    mealReminderOverrides, setMealReminderOverride,
  } = useApp();
  const [selectedDate, setSelectedDate] = useState<string>(todayISO());
  const [addOpen, setAddOpen] = useState(false);
  const [reminderSlot, setReminderSlot] = useState<MealSlot | null>(null);
  const [addSlot, setAddSlot] = useState<MealSlot>('Dinner');
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Drag a meal entry from one slot to another (within the meals list only).
  // The per-slot PanResponders are memoized (stable across re-renders) so the
  // grip's touch handlers never change mid-gesture — otherwise a re-render
  // during the drag would swap the responder and the ScrollView could reclaim
  // the touch, which read as a jump. Because they're memoized, everything they
  // read at gesture time comes from refs, not the render-time closure.
  const [dragSlot, setDragSlot] = useState<MealSlot | null>(null);
  const [hoverSlot, setHoverSlot] = useState<MealSlot | null>(null);
  const dragSlotRef = useRef<MealSlot | null>(null);
  const hoverSlotRef = useRef<MealSlot | null>(null);
  // Row heights (label + card), measured via onLayout. Heights are stable
  // regardless of scroll — unlike absolute screen coords — so the target-slot
  // maths below never drifts when the planner is scrolled.
  const slotHeights = useRef<Partial<Record<MealSlot, number>>>({}).current;
  const slotPanRef = useRef<Partial<Record<MealSlot, ReturnType<typeof PanResponder.create>>>>({}).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const [widgetsDragging, setWidgetsDragging] = useState(false);
  const insets = useSafeAreaInsets();

  const stripRef = useRef<FlatList<string>>(null);
  const PILL_W = 58; // pill width (50) + marginRight (8)
  const [stripMonthIso, setStripMonthIso] = useState(selectedDate);

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
    setStripMonthIso(selectedDate);
  }, [selectedDate, days]);

  // The month label above the strip tracks whatever's leading the visible
  // window as you scroll, not just the selected day — otherwise it goes
  // stale the moment you swipe away from the selection.
  const onStripScroll = (x: number) => {
    const i = Math.round(x / PILL_W);
    const iso = days[Math.max(0, Math.min(days.length - 1, i))];
    if (iso) setStripMonthIso(iso);
  };

  const dayPlan = mealPlan[selectedDate] || {};
  // Mirrored for the memoized slot PanResponders to read the current day/plan.
  const dayPlanRef = useRef(dayPlan);
  dayPlanRef.current = dayPlan;
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
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

  // Duplicate every filled slot of the selected day onto the next day, in one
  // tap. Only filled slots are copied; the next day's other slots are kept.
  const nextDay = addDaysISO(selectedDate, 1);
  const filledCount = SLOTS.filter((s) => dayPlan[s]).length;
  const handleCopyNextDay = () => {
    const nextLabel = `${t(`day.${weekdayKey(nextDay)}` as TKey)} ${dayOfMonth(nextDay)}`;
    const copied = copyDayMeals(selectedDate, nextDay);
    if (copied === 0) {
      showToast(t('mealplan.copyNextDay.empty' as TKey));
      return;
    }
    showToast(
      copied === 1
        ? t('mealplan.copyNextDay.doneOne' as TKey, { day: nextLabel })
        : t('mealplan.copyNextDay.done' as TKey, { count: copied, day: nextLabel }),
    );
  };

  const setDrag = (s: MealSlot | null) => { dragSlotRef.current = s; setDragSlot(s); };
  const setHover = (s: MealSlot | null) => { hoverSlotRef.current = s; setHoverSlot(s); };

  // Move (or swap, if the target already has something) a meal entry from one
  // slot to another on the same day. Reads the plan/date from refs so it stays
  // correct inside the memoized responders.
  const onMoveEntry = (from: MealSlot, to: MealSlot) => {
    const plan = dayPlanRef.current;
    const date = selectedDateRef.current;
    const fromEntry = plan[from];
    if (!fromEntry) return;
    const toEntry = plan[to];
    assignMeal(date, to, fromEntry);
    if (toEntry) assignMeal(date, from, toEntry);
    else removeMeal(date, from);
  };

  // Which slot the finger is currently over, derived purely from how far the
  // card has been dragged (dy) and the measured row heights — no absolute
  // screen coords, so scrolling never throws it off.
  const targetSlotFor = (dragSlot: MealSlot, dy: number): MealSlot => {
    const tops: number[] = [];
    let top = 0;
    for (const s of SLOTS) { tops.push(top); top += slotHeights[s] ?? 0; }
    const di = SLOTS.indexOf(dragSlot);
    const center = tops[di] + (slotHeights[dragSlot] ?? 0) / 2 + dy;
    for (let i = 0; i < SLOTS.length; i++) {
      if (center < tops[i] + (slotHeights[SLOTS[i]] ?? 0)) return SLOTS[i];
    }
    return SLOTS[SLOTS.length - 1];
  };

  // Created once per slot and cached — never rebuilt across renders, so the
  // grip's touch handlers are stable for the whole gesture.
  const getSlotPan = (slot: MealSlot) => {
    if (slotPanRef[slot]) return slotPanRef[slot]!;
    const pan = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragY.setValue(0);
        setDrag(slot);
        setHover(slot);
      },
      onPanResponderMove: (_, gesture) => {
        dragY.setValue(gesture.dy);
        const target = targetSlotFor(slot, gesture.dy);
        if (target !== hoverSlotRef.current) setHover(target);
      },
      onPanResponderRelease: () => {
        const from = dragSlotRef.current;
        const to = hoverSlotRef.current;
        if (from && to && to !== from) onMoveEntry(from, to);
        setDrag(null);
        setHover(null);
        dragY.setValue(0);
      },
      onPanResponderTerminate: () => {
        setDrag(null);
        setHover(null);
        dragY.setValue(0);
      },
    });
    slotPanRef[slot] = pan;
    return pan;
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
  const DEFAULT_WIDGETS = ['nutrition', 'water'];
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
    return null;
  };

  // The meals section itself is fixed (not part of the nutrition/water widget
  // stack above) — each category label (Breakfast, Lunch, …) always stays in
  // place. Only the meal entry underneath it can be dragged onto another
  // category to move (or swap) it there.
  const renderSlots = () => (
    <View>
      <Text style={styles.slotsHeaderLabel}>{t('mealplan.mealsLabel' as TKey)}</Text>
      {SLOTS.map((slot) => {
        const entry = dayPlan[slot];
        const match = matches[slot];
        const isDragging = dragSlot === slot;
        const isHoverTarget = hoverSlot === slot && dragSlot !== null && dragSlot !== slot;

        return (
          <View
            key={slot}
            style={[styles.slotBlock, isHoverTarget && styles.slotBlockHover]}
            onLayout={(e) => { slotHeights[slot] = e.nativeEvent.layout.height; }}
          >
            <Text style={styles.slotLabel}>{t(`slot.${slot}` as TKey)}</Text>
            {entry ? (
              <Animated.View
                style={isDragging ? { transform: [{ translateY: dragY }], zIndex: 10, elevation: 6 } : undefined}
              >
                <SlotEntryCard
                  entry={entry}
                  match={match}
                  getRecipe={getRecipe}
                  getPantryItem={getPantryItem}
                  styles={styles}
                  t={t}
                  c={c}
                  onRemove={() => removeMeal(selectedDate, slot)}
                  onPressRecipe={(id) => navigation.navigate('RecipeDetail', { id })}
                  onAddMissing={handleAddMissing}
                  onEditReminder={() => setReminderSlot(slot)}
                  hasReminderOverride={!!mealReminderOverrides?.[`${selectedDate}|${slot}`]}
                  dragHandlers={getSlotPan(slot).panHandlers}
                />
              </Animated.View>
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

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        scrollEnabled={!widgetsDragging && !dragSlot}
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
        <Text style={styles.stripMonth}>{monthLabelForISO(stripMonthIso, lang)}</Text>
        <FlatList
          ref={stripRef}
          data={days}
          horizontal
          showsHorizontalScrollIndicator={false}
          onScroll={(e) => onStripScroll(e.nativeEvent.contentOffset.x)}
          scrollEventThrottle={32}
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

        {renderSlots()}

        {filledCount > 0 && (
          <Pressable style={styles.copyBtn} onPress={handleCopyNextDay}>
            <Icon name="calendar" size={16} color={c.accent} />
            <Text style={styles.copyBtnText}>{t('mealplan.copyNextDay' as TKey)}</Text>
          </Pressable>
        )}

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

      {reminderSlot && (
        <MealReminderSheet
          visible={!!reminderSlot}
          defaultTime={defaultSlotTime(reminderSlot)}
          initialEnabled={mealReminderOverrides?.[`${selectedDate}|${reminderSlot}`]?.enabled ?? true}
          initialTime={mealReminderOverrides?.[`${selectedDate}|${reminderSlot}`]?.time}
          onClose={() => setReminderSlot(null)}
          onSave={(enabled, time) => {
            const isDefault = enabled && !time;
            setMealReminderOverride(selectedDate, reminderSlot, isDefault ? null : { enabled, time });
          }}
        />
      )}
    </>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { ...centeredContent, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 130 },
    titleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18 },
    title: { fontFamily: fonts.display, fontSize: 28, color: c.ink },
    sub: { fontSize: 14, fontWeight: '600', color: c.grayMid, marginTop: 4 },
    calBtn: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center', marginTop: 4,
    },
    stripMonth: { fontSize: 12.5, fontWeight: '700', color: c.grayMid, marginBottom: 8 },
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

    slotsHeaderLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, color: c.accent, textTransform: 'uppercase', marginBottom: 12 },
    slotBlock: { marginBottom: 14, borderRadius: 18 },
    slotBlockHover: { backgroundColor: c.accentSoft },
    slotLabel: { fontSize: 13, fontWeight: '700', color: c.grayLight, marginBottom: 9 },

    slotCard: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 13,
      backgroundColor: c.surface, borderRadius: 18, padding: 11,
      borderWidth: 1.5, borderColor: 'transparent',
    },
    slotCardTouchable: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
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

    entryActions: { alignItems: 'center', gap: 6, flexShrink: 0 },
    reminderBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
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

    copyBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: c.accentSoft, borderRadius: 16, paddingVertical: 15, marginBottom: 12,
    },
    copyBtnText: { fontSize: 15, fontWeight: '700', color: c.accent },
    weekBtn: { backgroundColor: c.surfaceAlt, borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
    weekBtnText: { fontSize: 15, fontWeight: '700', color: c.grayLight },
  });
