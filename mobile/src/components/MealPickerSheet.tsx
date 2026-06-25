import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DAYS } from '../data/seed';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { DayKey, MealSlot } from '../types';

interface Props {
  visible: boolean;
  recipeTitle: string;
  selectedDay: DayKey;
  selectedSlot: MealSlot;
  onClose: () => void;
  onSelectDay: (day: DayKey) => void;
  onSelectSlot: (slot: MealSlot) => void;
  onConfirm: () => void;
}

const SLOTS: MealSlot[] = ['Breakfast', 'SecondBreakfast', 'Lunch', 'Dinner', 'Snack', 'Supper'];

export function MealPickerSheet({
  visible,
  recipeTitle,
  selectedDay,
  selectedSlot,
  onClose,
  onSelectDay,
  onSelectSlot,
  onConfirm,
}: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const dayObj = DAYS.find((d) => d.day === selectedDay);
  const dayLabel = dayObj ? `${dayObj.day} ${dayObj.date}` : selectedDay;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Add to meal plan</Text>
          <Text style={styles.recipe}>{recipeTitle}</Text>

          <Text style={styles.section}>DAY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayRow}>
            {DAYS.map((d) => {
              const on = d.day === selectedDay;
              return (
                <Pressable
                  key={d.day}
                  style={[styles.dayBtn, on && styles.dayBtnOn]}
                  onPress={() => onSelectDay(d.day)}
                >
                  <Text style={[styles.dayLabel, on && styles.dayLabelOn]}>{d.day}</Text>
                  <Text style={[styles.dayDate, on && styles.dayDateOn]}>{d.date}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.section}>MEAL</Text>
          <View style={styles.slotRow}>
            {SLOTS.map((slot) => {
              const on = slot === selectedSlot;
              return (
                <Pressable
                  key={slot}
                  style={[styles.slotBtn, on && styles.slotBtnOn]}
                  onPress={() => onSelectSlot(slot)}
                >
                  <Text style={[styles.slotText, on && styles.slotTextOn]}>{slot}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable style={styles.confirm} onPress={onConfirm}>
            <Text style={styles.confirmText}>Add to {dayLabel}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: c.scrim,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: c.bg,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      paddingHorizontal: 20,
      paddingBottom: 36,
      paddingTop: 12,
    },
    handle: {
      width: 42,
      height: 5,
      borderRadius: 3,
      backgroundColor: c.border,
      alignSelf: 'center',
      marginBottom: 18,
    },
    title: { fontFamily: fonts.display, fontSize: 20, color: c.ink, marginBottom: 3 },
    recipe: { fontSize: 13.5, fontWeight: '600', color: c.ink, marginBottom: 18 },
    section: {
      fontSize: 12,
      fontWeight: '700',
      color: c.grayMid,
      letterSpacing: 0.4,
      marginBottom: 9,
    },
    dayRow: { marginBottom: 18, marginHorizontal: -20, paddingHorizontal: 20 },
    dayBtn: {
      width: 46,
      borderRadius: 13,
      paddingVertical: 10,
      alignItems: 'center',
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      marginRight: 7,
    },
    dayBtnOn: { backgroundColor: c.accent, borderColor: c.accent },
    dayLabel: { fontSize: 11, fontWeight: '700', color: c.grayMid },
    dayLabelOn: { color: 'rgba(255,255,255,0.85)' },
    dayDate: { fontFamily: fonts.display, fontSize: 15, fontWeight: '700', color: c.ink, marginTop: 3 },
    dayDateOn: { color: '#fff' },
    slotRow: { flexDirection: 'row', gap: 8, marginBottom: 22 },
    slotBtn: {
      flex: 1,
      borderRadius: 13,
      paddingVertical: 13,
      alignItems: 'center',
      backgroundColor: c.surfaceAlt,
    },
    slotBtnOn: { backgroundColor: c.accent },
    slotText: { fontSize: 13.5, fontWeight: '700', color: c.ink },
    slotTextOn: { color: '#fff' },
    confirm: {
      backgroundColor: c.accent,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
    },
    confirmText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  });
