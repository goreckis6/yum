import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { RootStackParamList } from '../navigation/types';
import { Icon } from '../components/Icon';
import { extractReceiptFromImage } from '../api/receipts';
import { Receipt } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanReceipt'>;

interface PhotoDraft {
  uri: string;
  base64: string;
  mimeType: string;
}

export function ScanReceiptScreen({ navigation }: Props) {
  const c = useTheme();
  const styles = makeStyles(c);
  const insets = useSafeAreaInsets();
  const [photo, setPhoto] = useState<PhotoDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickImage = async (fromCamera: boolean) => {
    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, base64: true });

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) return;
    setError(null);
    setPhoto({ uri: asset.uri, base64: asset.base64, mimeType: asset.mimeType ?? 'image/jpeg' });
  };

  const submit = async () => {
    if (!photo || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { receipt } = await extractReceiptFromImage(photo.base64, photo.mimeType);
      const draft: Receipt = {
        id: `rcp${Date.now()}`,
        merchant: receipt.merchant,
        date: receipt.date,
        total: receipt.total,
        subtotal: receipt.subtotal,
        tax: receipt.tax,
        currency: receipt.currency,
        category: receipt.category,
        paymentMethod: receipt.paymentMethod,
        tags: [],
        items: receipt.items,
        imageUrl: photo.uri, // original photo (local uri, uploaded on save)
        createdAt: Date.now(),
      };
      navigation.replace('ReviewReceipt', { draft });
    } catch (e: any) {
      setError(e?.message || 'Could not read the receipt. Try a clearer photo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backIcon}>‹</Text>
      </Pressable>

      <Text style={styles.title}>Scan receipt</Text>
      <Text style={styles.sub}>
        Snap the whole receipt — we read the merchant, date, total and tax, and keep the original photo.
      </Text>

      {photo ? (
        <>
          <View style={styles.previewWrap}>
            <Image source={{ uri: photo.uri }} style={styles.preview} resizeMode="cover" />
            {!busy && (
              <View style={styles.previewActions}>
                <Pressable style={styles.retakeBtn} onPress={() => pickImage(true)}>
                  <Text style={styles.retakeBtnText}>Retake</Text>
                </Pressable>
                <Pressable style={styles.retakeBtn} onPress={() => pickImage(false)}>
                  <Text style={styles.retakeBtnText}>Change photo</Text>
                </Pressable>
              </View>
            )}
            {busy && (
              <View style={styles.busyOverlay}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.busyText}>Reading the receipt…</Text>
              </View>
            )}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={[styles.btnPrimary, busy && styles.btnDisabled]} onPress={submit} disabled={busy}>
            <Text style={styles.btnPrimaryText}>{busy ? 'Reading…' : 'Read receipt'}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <View style={styles.placeholder}>
            <Icon name="receipt" size={44} color={c.gray} />
            <Text style={styles.placeholderText}>No receipt selected</Text>
          </View>
          <Pressable style={styles.btnPrimary} onPress={() => pickImage(true)}>
            <Text style={styles.btnPrimaryText}>Take photo</Text>
          </Pressable>
          <Pressable style={styles.btnSecondary} onPress={() => pickImage(false)}>
            <Text style={styles.btnSecondaryText}>Choose from gallery</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingHorizontal: 20, paddingTop: 16 },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 22,
    },
    backIcon: { fontSize: 28, color: c.ink },
    title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, color: c.ink, letterSpacing: -0.6, marginBottom: 8 },
    sub: { fontSize: 15, fontWeight: '500', color: c.grayMuted, lineHeight: 22, marginBottom: 24 },
    placeholder: {
      flex: 1,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
      gap: 12,
    },
    placeholderText: { fontSize: 14, fontWeight: '600', color: c.grayMid },
    previewWrap: { flex: 1, borderRadius: 20, overflow: 'hidden', marginBottom: 16, backgroundColor: c.surface },
    preview: { flex: 1 },
    previewActions: { position: 'absolute', bottom: 12, left: 12, right: 12, flexDirection: 'row', gap: 8 },
    retakeBtn: {
      flex: 1,
      backgroundColor: 'rgba(255,255,255,0.92)',
      borderRadius: 14,
      paddingVertical: 11,
      alignItems: 'center',
    },
    retakeBtnText: { fontSize: 13, fontWeight: '700', color: '#241B12' },
    busyOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(27,23,18,0.55)', alignItems: 'center', justifyContent: 'center', gap: 12 },
    busyText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    error: { fontSize: 13, fontWeight: '600', color: '#DC2626', marginBottom: 12 },
    btnPrimary: { backgroundColor: c.accent, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
    btnDisabled: { opacity: 0.6 },
    btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    btnSecondary: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 24 },
    btnSecondaryText: { color: c.ink, fontSize: 16, fontWeight: '700' },
  });
