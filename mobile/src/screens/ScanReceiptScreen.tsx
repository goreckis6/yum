import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { RootStackParamList } from '../navigation/types';
import { Icon } from '../components/Icon';
import { extractReceiptFromImage } from '../api/receipts';
import { Receipt } from '../types';
import { useI18n } from '../i18n/I18nContext';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanReceipt'>;

interface PhotoDraft {
  uri: string;
  base64: string;
  mimeType: string;
}

export function ScanReceiptScreen({ navigation }: Props) {
  const c = useTheme();
  const { t } = useI18n();
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

    // Write the photo to a real file:// path. The picker's own uri can be a
    // ph:// / blob: URI that crashes the native image loader ("No suitable URL
    // request handler for blob") when rendered or read — a plain file is safe.
    let uri = asset.uri;
    try {
      const dest = `${FileSystem.cacheDirectory}receipt-${Date.now()}.jpg`;
      await FileSystem.writeAsStringAsync(dest, asset.base64, { encoding: FileSystem.EncodingType.Base64 });
      uri = dest;
    } catch {
      /* keep the original uri if writing fails */
    }

    setPhoto({ uri, base64: asset.base64, mimeType: asset.mimeType ?? 'image/jpeg' });
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
      navigation.replace('ReviewReceipt', { draft, imageBase64: photo.base64, mimeType: photo.mimeType });
    } catch (e: any) {
      setError(e?.message || t('scanReceipt.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
        <Text style={styles.backIcon}>‹</Text>
      </Pressable>

      <Text style={styles.title}>{t('scanReceipt.title')}</Text>
      <Text style={styles.sub}>{t('scanReceipt.sub')}</Text>

      {photo ? (
        <>
          <View style={styles.previewWrap}>
            <Image source={{ uri: photo.uri }} style={styles.preview} resizeMode="cover" />
            {!busy && (
              <View style={styles.previewActions}>
                <Pressable style={styles.retakeBtn} onPress={() => pickImage(true)}>
                  <Text style={styles.retakeBtnText}>{t('scanReceipt.retake')}</Text>
                </Pressable>
                <Pressable style={styles.retakeBtn} onPress={() => pickImage(false)}>
                  <Text style={styles.retakeBtnText}>{t('scanReceipt.changePhoto')}</Text>
                </Pressable>
              </View>
            )}
            {busy && (
              <View style={styles.busyOverlay}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.busyText}>{t('scanReceipt.reading')}</Text>
              </View>
            )}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={[styles.btnPrimary, busy && styles.btnDisabled]} onPress={submit} disabled={busy}>
            <Text style={styles.btnPrimaryText}>{busy ? t('scanReceipt.reading') : t('scanReceipt.read')}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <View style={styles.placeholder}>
            <Icon name="receipt" size={44} color={c.gray} />
            <Text style={styles.placeholderText}>{t('scanReceipt.none')}</Text>
          </View>
          <Pressable style={styles.btnPrimary} onPress={() => pickImage(true)}>
            <Text style={styles.btnPrimaryText}>{t('scanReceipt.take')}</Text>
          </Pressable>
          <Pressable style={styles.btnSecondary} onPress={() => pickImage(false)}>
            <Text style={styles.btnSecondaryText}>{t('scanReceipt.gallery')}</Text>
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
    error: { fontSize: 13, fontWeight: '600', color: c.dangerText, marginBottom: 12 },
    btnPrimary: { backgroundColor: c.accent, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
    btnDisabled: { opacity: 0.6 },
    btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    btnSecondary: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 24 },
    btnSecondaryText: { color: c.ink, fontSize: 16, fontWeight: '700' },
  });
