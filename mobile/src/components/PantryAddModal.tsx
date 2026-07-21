import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { useI18n } from '../i18n/I18nContext';
import { searchProducts, OFFSearchResult } from '../api/openfoodfacts';
import { PantryItem } from '../types';

export type PantryAddMode = 'search' | 'manual';

// Two ways to add a pantry product without the camera: search the Open Food
// Facts database by name, or type the macros in by hand. Barcode scanning has
// its own screen. Emits a ready-to-store PantryItem via onAdd.
export function PantryAddModal({
  visible,
  mode,
  onClose,
  onAdd,
}: {
  visible: boolean;
  mode: PantryAddMode;
  onClose: () => void;
  onAdd: (item: PantryItem) => void;
}) {
  const c = useTheme();
  const { t } = useI18n();
  const styles = makeStyles(c);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OFFSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [p, setP] = useState('');
  const [carb, setCarb] = useState('');
  const [fat, setFat] = useState('');

  useEffect(() => {
    if (!visible) {
      setQuery(''); setResults([]); setLoading(false);
      setName(''); setKcal(''); setP(''); setCarb(''); setFat('');
    }
  }, [visible]);

  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!visible || mode !== 'search') return;
    const q = query.trim();
    if (q.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      ctrl.current?.abort();
      ctrl.current = new AbortController();
      try {
        setResults(await searchProducts(q, ctrl.current.signal));
      } catch {
        /* aborted or network error — keep prior results */
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query, mode, visible]);

  const addFromOff = (r: OFFSearchResult) => {
    onAdd({
      id: `pty${Date.now()}`,
      name: r.name,
      brand: r.brand || undefined,
      barcode: r.code || undefined,
      imageUrl: r.imageUrl,
      basis: '100g',
      per100: { kcal: r.kcal, p: r.p, c: r.c, f: r.f },
      source: 'off',
      createdAt: Date.now(),
    });
    onClose();
  };

  const num = (s: string) => Math.max(0, Math.round(Number(s.replace(',', '.')) || 0));
  const addManual = () => {
    const nm = name.trim();
    if (!nm) return;
    onAdd({
      id: `pty${Date.now()}`,
      name: nm,
      basis: '100g',
      per100: { kcal: num(kcal), p: num(p), c: num(carb), f: num(fat) },
      source: 'manual',
      createdAt: Date.now(),
    });
    onClose();
  };

  const macros: { v: string; set: (s: string) => void; label: string }[] = [
    { v: kcal, set: setKcal, label: 'kcal' },
    { v: p, set: setP, label: 'P' },
    { v: carb, set: setCarb, label: 'C' },
    { v: fat, set: setFat, label: 'F' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.handle} />
          <Text style={styles.title}>{mode === 'search' ? t('pantry.searchTitle') : t('pantry.manualTitle')}</Text>

          {mode === 'search' ? (
            <>
              <TextInput
                style={styles.input}
                value={query}
                onChangeText={setQuery}
                placeholder={t('pantry.searchPlaceholder')}
                placeholderTextColor={c.gray}
                autoFocus
                autoCorrect={false}
                returnKeyType="search"
              />
              <ScrollView style={styles.results} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {loading && <Text style={styles.hint}>{t('pantry.searching')}</Text>}
                {!loading && query.trim().length < 2 && <Text style={styles.hint}>{t('pantry.searchHint')}</Text>}
                {!loading && query.trim().length >= 2 && results.length === 0 && (
                  <Text style={styles.hint}>{t('pantry.searchEmpty')}</Text>
                )}
                {results.map((r) => (
                  <Pressable key={r.code} style={styles.resultRow} onPress={() => addFromOff(r)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultName} numberOfLines={1}>{r.name}</Text>
                      {!!r.brand && <Text style={styles.resultBrand} numberOfLines={1}>{r.brand}</Text>}
                      <Text style={styles.resultMacro}>{r.kcal} kcal · {r.p}P · {r.c}C · {r.f}F · /100g</Text>
                    </View>
                    <Text style={styles.plus}>+</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : (
            <>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder={t('pantry.manualName')}
                placeholderTextColor={c.gray}
                autoFocus
              />
              <Text style={styles.per100}>{t('pantry.manualPer100')}</Text>
              <View style={styles.macroRow}>
                {macros.map((m) => (
                  <View key={m.label} style={styles.macroCell}>
                    <TextInput
                      style={styles.macroInput}
                      value={m.v}
                      onChangeText={m.set}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={c.gray}
                    />
                    <Text style={styles.macroLabel}>{m.label}</Text>
                  </View>
                ))}
              </View>
              <Pressable
                style={[styles.saveBtn, !name.trim() && styles.saveBtnDisabled]}
                onPress={addManual}
                disabled={!name.trim()}
              >
                <Text style={styles.saveText}>{t('pantry.saveManual')}</Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: c.scrim, justifyContent: 'flex-end' },
    card: {
      backgroundColor: c.bg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 28,
      maxHeight: '82%',
    },
    handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: c.border, marginBottom: 14 },
    title: { fontFamily: fonts.display, fontSize: 20, color: c.ink, marginBottom: 14 },
    input: {
      backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border,
      paddingVertical: 14, paddingHorizontal: 14, fontSize: 15, fontWeight: '500', color: c.ink,
    },
    results: { marginTop: 12 },
    hint: { fontSize: 14, fontWeight: '500', color: c.grayMid, textAlign: 'center', paddingVertical: 24 },
    resultRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border,
    },
    resultName: { fontSize: 15, fontWeight: '700', color: c.ink },
    resultBrand: { fontSize: 12.5, fontWeight: '500', color: c.grayMid, marginTop: 1 },
    resultMacro: { fontSize: 12, fontWeight: '600', color: c.grayLight, marginTop: 3 },
    plus: { fontSize: 24, fontWeight: '700', color: c.accent, paddingHorizontal: 4 },

    per100: { fontSize: 12.5, fontWeight: '700', color: c.grayMid, marginTop: 16, marginBottom: 8 },
    macroRow: { flexDirection: 'row', gap: 10 },
    macroCell: { flex: 1, alignItems: 'center' },
    macroInput: {
      alignSelf: 'stretch', textAlign: 'center',
      backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border,
      paddingVertical: 12, fontSize: 16, fontWeight: '700', color: c.ink,
    },
    macroLabel: { fontSize: 12, fontWeight: '700', color: c.grayMid, marginTop: 5 },
    saveBtn: { backgroundColor: c.accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 22 },
    saveBtnDisabled: { backgroundColor: c.border },
    saveText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  });
