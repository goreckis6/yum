import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { RootStackParamList } from '../navigation/types';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { uploadImageIfLocal, uploadBase64Image } from '../lib/storage';
import { RECEIPT_CATEGORIES, Receipt, ReceiptCategory } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'ReviewReceipt'>;

export function ReviewReceiptScreen({ navigation, route }: Props) {
  const c = useTheme();
  const styles = makeStyles(c);
  const insets = useSafeAreaInsets();
  const { addReceipt, showToast } = useApp();
  const { user } = useAuth();
  const userId = user?.id;
  const [draft, setDraft] = useState<Receipt>(route.params.draft);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '').toLowerCase();
    if (!t || draft.tags.includes(t)) {
      setTagInput('');
      return;
    }
    setDraft((d) => ({ ...d, tags: [...d.tags, t] }));
    setTagInput('');
  };

  const removeTag = (t: string) => setDraft((d) => ({ ...d, tags: d.tags.filter((x) => x !== t) }));

  const setNum = (key: 'total' | 'tax' | 'subtotal', text: string) => {
    const v = parseFloat(text.replace(',', '.'));
    setDraft((d) => ({ ...d, [key]: isNaN(v) ? 0 : v }));
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      // Prefer the base64 we already have from the picker (the receipt photo's
      // ph:// uri can't be read by the File API), else fall back to the uri.
      let imageUrl = draft.imageUrl;
      if (userId) {
        if (route.params.imageBase64) {
          imageUrl = (await uploadBase64Image(route.params.imageBase64, userId, 'receipts')) ?? draft.imageUrl;
        } else {
          imageUrl = await uploadImageIfLocal(draft.imageUrl, userId, 'receipts');
        }
      }
      addReceipt({ ...draft, imageUrl });
      showToast('Saved to your receipts');
      navigation.reset({ index: 1, routes: [{ name: 'Main' }, { name: 'Receipts' }] });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backIcon}>‹</Text>
      </Pressable>

      <Text style={styles.eyebrow}>Review receipt</Text>
      <Text style={styles.title}>Check the details</Text>

      {draft.imageUrl ? (
        <Image source={{ uri: draft.imageUrl }} style={styles.photo} resizeMode="cover" />
      ) : null}

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>TOTAL</Text>
        <View style={styles.totalRow}>
          <TextInput
            style={styles.currencyInput}
            value={draft.currency}
            onChangeText={(currency) => setDraft((d) => ({ ...d, currency: currency.toUpperCase().slice(0, 3) }))}
            autoCapitalize="characters"
            maxLength={3}
          />
          <TextInput
            style={styles.totalInput}
            value={String(draft.total)}
            onChangeText={(t) => setNum('total', t)}
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      <Text style={styles.label}>Merchant</Text>
      <TextInput
        style={styles.field}
        value={draft.merchant}
        onChangeText={(merchant) => setDraft((d) => ({ ...d, merchant }))}
      />

      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.label}>Date</Text>
          <TextInput
            style={styles.field}
            value={draft.date}
            onChangeText={(date) => setDraft((d) => ({ ...d, date }))}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={c.gray}
          />
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>Tax</Text>
          <TextInput
            style={styles.field}
            value={String(draft.tax)}
            onChangeText={(t) => setNum('tax', t)}
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      <Text style={styles.label}>Category</Text>
      <View style={styles.chips}>
        {RECEIPT_CATEGORIES.map((cat) => {
          const on = draft.category === cat;
          return (
            <Pressable
              key={cat}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => setDraft((d) => ({ ...d, category: cat as ReceiptCategory }))}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{cat}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Tags</Text>
      <View style={styles.tagWrap}>
        {draft.tags.map((t) => (
          <Pressable key={t} style={styles.tagChip} onPress={() => removeTag(t)}>
            <Text style={styles.tagText}>#{t}</Text>
            <Text style={styles.tagX}>✕</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.tagInputRow}>
        <Text style={styles.tagHash}>#</Text>
        <TextInput
          style={styles.tagInput}
          value={tagInput}
          onChangeText={setTagInput}
          placeholder="add a tag (e.g. family, trip-nyc)"
          placeholderTextColor={c.gray}
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={addTag}
          returnKeyType="done"
        />
        <Pressable style={styles.tagAddBtn} onPress={addTag}>
          <Text style={styles.tagAddText}>Add</Text>
        </Pressable>
      </View>

      {draft.items?.length ? (
        <>
          <Text style={styles.label}>Items</Text>
          <View style={styles.itemsCard}>
            {draft.items.map((it, i) => (
              <View key={i} style={[styles.itemRow, i === draft.items.length - 1 && styles.itemRowLast]}>
                <Text style={styles.itemName}>{it.n}</Text>
                <Text style={styles.itemPrice}>{it.p.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <Pressable style={[styles.saveBtn, saving && styles.saveDisabled]} onPress={save} disabled={saving}>
        <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save to my receipts'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 60 },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    backIcon: { fontSize: 28, color: c.ink },
    eyebrow: { fontSize: 12, fontWeight: '700', color: c.accent, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4 },
    title: { fontFamily: fonts.display, fontSize: 27, color: c.ink, letterSpacing: -0.5, marginBottom: 16 },
    photo: { width: '100%', height: 200, borderRadius: 16, marginBottom: 18, backgroundColor: c.surfaceAlt },
    totalCard: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 18,
      padding: 18,
      marginBottom: 18,
    },
    totalLabel: { fontSize: 12, fontWeight: '700', color: c.grayMid, letterSpacing: 0.5, marginBottom: 6 },
    totalRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    currencyInput: { fontFamily: fonts.display, fontSize: 20, fontWeight: '700', color: c.grayMid, minWidth: 44 },
    totalInput: { flex: 1, fontFamily: fonts.displayExtra, fontSize: 36, color: c.ink, padding: 0 },
    label: { fontSize: 12, fontWeight: '700', color: c.grayMid, marginBottom: 6, marginTop: 4 },
    field: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      padding: 14,
      fontSize: 15,
      fontWeight: '600',
      color: c.ink,
      marginBottom: 14,
    },
    row: { flexDirection: 'row', gap: 12 },
    half: { flex: 1 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    chip: {
      paddingVertical: 9,
      paddingHorizontal: 15,
      borderRadius: 999,
      backgroundColor: c.surfaceAlt,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    chipOn: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { fontSize: 13.5, fontWeight: '700', color: c.grayMid },
    chipTextOn: { color: '#fff' },
    tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    tagChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.accentSoft,
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 999,
    },
    tagText: { fontSize: 13, fontWeight: '700', color: c.accent },
    tagX: { fontSize: 11, fontWeight: '700', color: c.accent },
    tagInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
    tagHash: { fontSize: 16, fontWeight: '700', color: c.grayMid },
    tagInput: {
      flex: 1,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14.5,
      fontWeight: '600',
      color: c.ink,
    },
    tagAddBtn: { backgroundColor: c.surfaceAlt, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
    tagAddText: { fontSize: 14, fontWeight: '700', color: c.ink },
    itemsCard: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      marginBottom: 18,
    },
    itemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    itemRowLast: { borderBottomWidth: 0 },
    itemName: { fontSize: 14, fontWeight: '500', color: c.ink, flex: 1 },
    itemPrice: { fontSize: 14, fontWeight: '700', color: c.ink },
    saveBtn: { backgroundColor: c.accent, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
    saveDisabled: { opacity: 0.6 },
    saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  });
