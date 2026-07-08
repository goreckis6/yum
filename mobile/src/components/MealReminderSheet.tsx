import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { useI18n } from '../i18n/I18nContext';
import type { TKey } from '../i18n/translations';
import { parseTimeStr } from '../lib/notifications';

// Lets the user override the reminder for one specific meal entry: a custom
// time instead of the slot's default, or muting it entirely — regardless of
// whether the meal was added from Pantry, My recipes or the Food DB.
export function MealReminderSheet({
  visible,
  defaultTime,
  initialEnabled,
  initialTime,
  onClose,
  onSave,
}: {
  visible: boolean;
  defaultTime: string; // "HH:MM", the slot's built-in default
  initialEnabled: boolean;
  initialTime?: string;
  onClose: () => void;
  onSave: (enabled: boolean, time?: string) => void;
}) {
  const c = useTheme();
  const { t } = useI18n();
  const styles = makeStyles(c);

  const [enabled, setEnabled] = useState(initialEnabled);
  const [time, setTime] = useState(initialTime ?? '');

  useEffect(() => {
    if (visible) {
      setEnabled(initialEnabled);
      setTime(initialTime ?? '');
    }
  }, [visible, initialEnabled, initialTime]);

  const trimmed = time.trim();
  const valid = trimmed === '' || !!parseTimeStr(trimmed);

  const save = () => {
    if (!valid) return;
    onSave(enabled, trimmed === '' ? undefined : trimmed);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{t('reminder.mealTitle' as TKey)}</Text>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{t('reminder.mealEnabled' as TKey)}</Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ true: c.accent, false: c.border }}
              thumbColor="#fff"
            />
          </View>

          {enabled && (
            <View style={styles.timeBlock}>
              <Text style={styles.rowLabel}>{t('reminder.mealTime' as TKey)}</Text>
              <TextInput
                style={[styles.input, !valid && styles.inputError]}
                placeholder={defaultTime}
                placeholderTextColor={c.gray}
                value={time}
                onChangeText={setTime}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
              <Text style={styles.hint}>
                {t('reminder.mealTimeHint' as TKey, { time: defaultTime })}
              </Text>
            </View>
          )}

          <Pressable style={[styles.confirm, !valid && styles.confirmDisabled]} onPress={save} disabled={!valid}>
            <Text style={styles.confirmText}>{t('common.save' as TKey)}</Text>
          </Pressable>
          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>{t('common.cancel' as TKey)}</Text>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: c.scrim, justifyContent: 'flex-end', padding: 14 },
    card: {
      backgroundColor: c.bg, borderRadius: 20, padding: 16, marginBottom: 8,
      borderWidth: 1, borderColor: c.border,
    },
    title: { fontFamily: fonts.display, fontSize: 18, color: c.ink, marginBottom: 12, textAlign: 'center' },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
    rowLabel: { fontSize: 14.5, fontWeight: '700', color: c.ink },
    timeBlock: { marginTop: 4, marginBottom: 6 },
    input: {
      backgroundColor: c.surface, borderRadius: 12, padding: 14,
      fontSize: 15, fontWeight: '600', color: c.ink, marginTop: 8,
      borderWidth: 1, borderColor: c.border,
    },
    inputError: { borderColor: c.dangerText },
    hint: { fontSize: 12, fontWeight: '500', color: c.grayMid, marginTop: 6 },
    confirm: { backgroundColor: c.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
    confirmDisabled: { backgroundColor: c.gray },
    confirmText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    cancel: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
    cancelText: { fontSize: 15, fontWeight: '700', color: c.grayMid },
  });
