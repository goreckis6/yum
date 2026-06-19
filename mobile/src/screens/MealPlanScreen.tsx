import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DAYS } from '../data/seed';
import { useApp } from '../context/AppContext';
import { useTabNav } from '../navigation/TabContext';
import { MealPickerSheet } from '../components/MealPickerSheet';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { DayKey, MealSlot, TAG_ICON } from '../types';
import { RootStackParamList } from '../navigation/types';

const SLOTS: MealSlot[] = ['Breakfast', 'Lunch', 'Dinner'];

export function MealPlanScreen() {
  const c = useTheme();
  const styles = makeStyles(c);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { setTab } = useTabNav();
  const { mealPlan, getRecipe, assignMeal, removeMeal, addWeekToGrocery, showToast } = useApp();
  const [selectedDay, setSelectedDay] = useState<DayKey>('Wed');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickSlot, setPickSlot] = useState<MealSlot>('Dinner');
  const [pickRecipeId, setPickRecipeId] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const dayPlan = mealPlan[selectedDay] || {};

  let dayKcal = 0;
  let dayP = 0;
  let dayC = 0;
  let dayF = 0;

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>Meal plan</Text>
        <Text style={styles.sub}>Plan breakfast, lunch & dinner for the week</Text>

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
                <Text style={[styles.dayLabel, sel && styles.dayLabelOn]}>{d.day}</Text>
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

        {SLOTS.map((slot) => {
          const rid = dayPlan[slot];
          const rec = rid ? getRecipe(rid) : undefined;
          if (rec) {
            dayKcal += rec.kcal;
            dayP += rec.p;
            dayC += rec.c;
            dayF += rec.f;
          }

          return (
            <View key={slot} style={styles.slotBlock}>
              <Text style={styles.slotLabel}>{slot}</Text>
              {rec ? (
                <Pressable
                  style={styles.slotCard}
                  onPress={() => navigation.navigate('RecipeDetail', { id: rec.id })}
                >
                  <View style={[styles.thumb, { backgroundColor: rec.tint }]}>
                    <Text style={styles.thumbIcon}>{TAG_ICON[rec.tags?.[0] ?? ''] ?? '🍽️'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.slotTitle}>{rec.title}</Text>
                    <Text style={styles.slotMeta}>
                      {rec.time} min · {rec.kcal} kcal
                    </Text>
                  </View>
                  <Pressable style={styles.remove} onPress={() => removeMeal(selectedDay, slot)}>
                    <Text>✕</Text>
                  </Pressable>
                </Pressable>
              ) : (
                <Pressable
                  style={styles.addSlot}
                  onPress={() => {
                    setPickSlot(slot);
                    setPickRecipeId(null);
                    setPickerOpen(true);
                  }}
                >
                  <Text style={styles.addText}>+ Add {slot.toLowerCase()}</Text>
                </Pressable>
              )}
            </View>
          );
        })}

        <View style={styles.totals}>
          <Text style={styles.totalsLabel}>
            {selectedDay} {DAYS.find((d) => d.day === selectedDay)?.date} total
          </Text>
          <Text style={styles.totalsKcal}>{dayKcal.toLocaleString()} kcal</Text>
          <Text style={styles.macros}>
            P {dayP}g · C {dayC}g · F {dayF}g
          </Text>
        </View>

        <Pressable style={styles.weekBtn} onPress={addWeekToGrocery}>
          <Text style={styles.weekBtnText}>Add week to grocery list</Text>
        </Pressable>
      </ScrollView>

      <MealPickerSheet
        visible={pickerOpen}
        recipeTitle={pickRecipeId ? getRecipe(pickRecipeId)?.title ?? 'Pick a recipe' : 'Pick from library'}
        selectedDay={selectedDay}
        selectedSlot={pickSlot}
        onClose={() => setPickerOpen(false)}
        onSelectDay={setSelectedDay}
        onSelectSlot={setPickSlot}
        onConfirm={() => {
          if (pickRecipeId) {
            assignMeal(selectedDay, pickSlot, pickRecipeId);
            setPickerOpen(false);
            showToast(`Added to ${selectedDay}`);
          } else {
            setPickerOpen(false);
            setTab('recipes');
          }
        }}
      />
    </>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 130 },
  title: { fontFamily: fonts.display, fontSize: 28, color: c.ink },
  sub: { fontSize: 14, fontWeight: '600', color: c.grayMid, marginTop: 4, marginBottom: 18 },
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
  dayLabel: { fontSize: 11.5, fontWeight: '700', color: c.grayMid },
  dayLabelOn: { color: 'rgba(255,255,255,0.85)' },
  dayDate: { fontFamily: fonts.display, fontSize: 17, fontWeight: '700', color: c.ink, marginTop: 6 },
  dayDateOn: { color: '#fff' },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 6 },
  slotBlock: { marginBottom: 14 },
  slotLabel: { fontSize: 13, fontWeight: '700', color: c.grayLight, marginBottom: 9 },
  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: c.surface,
    borderRadius: 18,
    padding: 11,
  },
  thumb: { width: 62, height: 62, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  thumbIcon: { fontSize: 26 },
  slotTitle: { fontSize: 15, fontWeight: '700', color: c.ink },
  slotMeta: { fontSize: 12, fontWeight: '600', color: c.grayMid, marginTop: 4 },
  remove: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F3F3F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSlot: {
    borderWidth: 1.5,
    borderColor: '#DADADA',
    borderStyle: 'dashed',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
  },
  addText: { fontSize: 14, fontWeight: '700', color: c.gray },
  totals: {
    backgroundColor: c.surface,
    borderRadius: 18,
    padding: 16,
    marginTop: 6,
    marginBottom: 14,
  },
  totalsLabel: { fontSize: 13, fontWeight: '600', color: c.grayMid },
  totalsKcal: { fontFamily: fonts.display, fontSize: 24, fontWeight: '700', color: c.ink, marginTop: 2 },
  macros: { fontSize: 13, fontWeight: '600', color: c.grayMid, marginTop: 6 },
  weekBtn: {
    backgroundColor: '#EBEBEB',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  weekBtnText: { fontSize: 15, fontWeight: '700', color: '#2A2A2A' },
});
