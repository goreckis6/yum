import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { useI18n } from '../i18n/I18nContext';
import type { TKey } from '../i18n/translations';
import { DayKey } from '../types';
import { fromISO, monthGrid, monthLabel, todayISO } from '../utils/dates';

const WEEK_HEADER: DayKey[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Month-grid date picker. Lets the user jump to any day (past or future) — the
// planner keeps history, so past dates are selectable too.
export function CalendarSheet({
  visible,
  selected,
  hasMeals,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: string;
  hasMeals: (iso: string) => boolean;
  onSelect: (iso: string) => void;
  onClose: () => void;
}) {
  const c = useTheme();
  const { t, lang } = useI18n();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();

  const [year, setYear] = useState(() => fromISO(selected).getFullYear());
  const [month0, setMonth0] = useState(() => fromISO(selected).getMonth());

  // Re-open on the selected date's month.
  useEffect(() => {
    if (visible) {
      const d = fromISO(selected);
      setYear(d.getFullYear());
      setMonth0(d.getMonth());
    }
  }, [visible, selected]);

  const cells = useMemo(() => monthGrid(year, month0), [year, month0]);
  const today = todayISO();

  const shift = (delta: number) => {
    const m = month0 + delta;
    setYear((y) => y + Math.floor(m / 12));
    setMonth0(((m % 12) + 12) % 12);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.grabber} />

        <View style={styles.header}>
          <Pressable style={styles.navBtn} onPress={() => shift(-1)} hitSlop={8}>
            <Text style={styles.navIcon}>‹</Text>
          </Pressable>
          <Text style={styles.monthLabel}>{monthLabel(year, month0, lang)}</Text>
          <Pressable style={styles.navBtn} onPress={() => shift(1)} hitSlop={8}>
            <Text style={styles.navIcon}>›</Text>
          </Pressable>
        </View>

        <View style={styles.weekHeader}>
          {WEEK_HEADER.map((d) => (
            <Text key={d} style={styles.weekHeaderText}>
              {t(`day.${d}` as TKey).slice(0, 2)}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {cells.map((iso, i) => {
            if (!iso) return <View key={`b${i}`} style={styles.cell} />;
            const isToday = iso === today;
            const isSel = iso === selected;
            const day = Number(iso.slice(8, 10));
            return (
              <Pressable
                key={iso}
                style={styles.cell}
                onPress={() => {
                  onSelect(iso);
                  onClose();
                }}
              >
                <View style={[styles.dayCircle, isToday && styles.dayCircleToday, isSel && styles.dayCircleSel]}>
                  <Text style={[styles.dayNum, isSel && styles.dayNumSel, isToday && !isSel && styles.dayNumToday]}>
                    {day}
                  </Text>
                </View>
                <View style={[styles.dot, { backgroundColor: hasMeals(iso) ? c.accent : 'transparent' }]} />
              </Pressable>
            );
          })}
        </View>

        <Pressable style={styles.todayBtn} onPress={() => { onSelect(today); onClose(); }}>
          <Text style={styles.todayBtnText}>{t('mealplan.today' as TKey)}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: c.scrim },
    sheet: {
      position: 'absolute', left: 0, right: 0, bottom: 0,
      backgroundColor: c.bg,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      paddingHorizontal: 16, paddingTop: 8,
    },
    grabber: { width: 40, height: 5, borderRadius: 3, backgroundColor: c.border, alignSelf: 'center', marginBottom: 10 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, marginBottom: 14 },
    navBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
    navIcon: { fontSize: 24, color: c.ink, marginTop: -2 },
    monthLabel: { fontFamily: fonts.display, fontSize: 18, color: c.ink },
    weekHeader: { flexDirection: 'row', marginBottom: 6 },
    weekHeaderText: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: c.grayMid },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4 },
    dayCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    dayCircleToday: { borderWidth: 1.5, borderColor: c.accent },
    dayCircleSel: { backgroundColor: c.accent, borderColor: c.accent },
    dayNum: { fontSize: 15, fontWeight: '600', color: c.ink },
    dayNumToday: { color: c.accent, fontWeight: '800' },
    dayNumSel: { color: '#fff', fontWeight: '800' },
    dot: { width: 5, height: 5, borderRadius: 3, marginTop: 3 },
    todayBtn: { marginTop: 12, paddingVertical: 14, borderRadius: 14, backgroundColor: c.surfaceAlt, alignItems: 'center' },
    todayBtnText: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.accent },
  });
