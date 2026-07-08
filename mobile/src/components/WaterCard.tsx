import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { useI18n } from '../i18n/I18nContext';
import type { TKey } from '../i18n/translations';
import { Icon } from './Icon';
import { PromptModal } from './ActionSheet';
import { getCurrentTemp, waterGoalMl, CurrentTemp } from '../lib/weather';

const CUP_ML = 200;

// Daily water tracker: tap cups (200 ml each) toward a suggested goal that's
// personalised by body weight (~33 ml/kg) and nudged up by the local weather.
export function WaterCard({
  intakeMl,
  weightKg,
  onAdd,
  onSetWeight,
}: {
  intakeMl: number;
  weightKg: number;
  onAdd: (deltaMl: number) => void;
  onSetWeight: (kg: number) => void;
}) {
  const c = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [temp, setTemp] = useState<CurrentTemp | null>(null);
  const [weightOpen, setWeightOpen] = useState(false);
  useEffect(() => {
    let active = true;
    getCurrentTemp().then((r) => { if (active) setTemp(r); });
    return () => { active = false; };
  }, []);

  const goal = waterGoalMl(temp?.tempC, weightKg);
  const goalCups = Math.max(6, Math.round(goal / CUP_ML));
  const cups = Math.round(intakeMl / CUP_ML);
  const pct = Math.min(100, Math.round((intakeMl / goal) * 100));
  const setCups = (n: number) => onAdd(n * CUP_ML - intakeMl);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Icon name="droplet" size={18} color={c.water} fill />
          <Text style={styles.title}>{t('water.title' as TKey)}</Text>
        </View>
        <Text style={styles.amount}>
          {intakeMl}<Text style={styles.amountGoal}> / {goal} ml</Text>
        </Text>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>

      <View style={styles.cupsRow}>
        {Array.from({ length: goalCups }).map((_, i) => {
          const filled = i < cups;
          return (
            <Pressable
              key={i}
              hitSlop={4}
              onPress={() => setCups(filled && i === cups - 1 ? i : i + 1)}
            >
              <Icon name="droplet" size={24} color={filled ? c.water : c.border} fill={filled} />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Text style={styles.recText}>
          {temp?.source === 'weather' && typeof temp.tempC === 'number'
            ? t('water.rec' as TKey, { temp: Math.round(temp.tempC), ml: goal })
            : t('water.recDefault' as TKey, { ml: goal })}
        </Text>
        <Pressable style={styles.addBtn} onPress={() => onAdd(CUP_ML)}>
          <Text style={styles.addText}>+ {t('water.cup' as TKey)}</Text>
        </Pressable>
      </View>

      <Pressable style={styles.weightRow} onPress={() => setWeightOpen(true)} hitSlop={6}>
        <Text style={styles.weightText}>
          {weightKg > 0 ? t('water.weightSet' as TKey, { kg: weightKg }) : t('water.setWeight' as TKey)}
        </Text>
        <Text style={styles.weightEdit}>{t('common.change' as TKey)}</Text>
      </Pressable>

      <PromptModal
        visible={weightOpen}
        title={t('water.weightPrompt' as TKey)}
        placeholder="kg"
        confirmLabel={t('common.save' as TKey)}
        keyboardType="number-pad"
        initialValue={weightKg > 0 ? String(weightKg) : ''}
        onCancel={() => setWeightOpen(false)}
        onConfirm={(v) => {
          const kg = parseInt(v.replace(',', '.'), 10);
          if (!isNaN(kg)) onSetWeight(kg);
          setWeightOpen(false);
        }}
      />
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface, borderRadius: 18,
      borderWidth: 1, borderColor: c.border, padding: 16, marginBottom: 22,
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { fontFamily: fonts.display, fontSize: 17, color: c.ink },
    amount: { fontFamily: fonts.display, fontSize: 18, fontWeight: '700', color: c.ink },
    amountGoal: { fontFamily: fonts.body, fontSize: 13, color: c.grayMid, fontWeight: '600' },
    track: { height: 8, borderRadius: 5, backgroundColor: c.surfaceAlt, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 5, backgroundColor: c.water },
    cupsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14 },
    recText: { flex: 1, fontSize: 12.5, fontWeight: '600', color: c.grayLight, lineHeight: 17 },
    addBtn: { backgroundColor: c.waterSoft, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 16 },
    addText: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.water },
    weightRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderTopWidth: 1, borderTopColor: c.border, marginTop: 14, paddingTop: 12,
    },
    weightText: { fontSize: 13, fontWeight: '600', color: c.grayMid },
    weightEdit: { fontSize: 12.5, fontWeight: '700', color: c.accent },
  });
