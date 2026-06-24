import React, { useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { RootStackParamList } from '../navigation/types';
import { useI18n } from '../i18n/I18nContext';
import { Icon } from '../components/Icon';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { uploadBase64Image, uploadImageIfLocal } from '../lib/storage';
import { PantryItem } from '../types';
import { lookupBarcode } from '../api/openfoodfacts';
import { extractNutritionFromLabels, LabelMacros } from '../api/nutritionLabel';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanBarcode'>;
type Mode = 'scanning' | 'loading' | 'result' | 'notfound' | 'capturing' | 'analyzing';

interface Shot {
  uri: string;
  base64: string;
  mimeType: string;
}

// Unified result shown for both an Open Food Facts hit and an AI-read label.
interface Display {
  name: string;
  brand: string;
  imageUrl?: string;
  servingSize?: string;
  basis: '100g' | '100ml';
  per100: LabelMacros;
  perServing?: LabelMacros;
  source: 'off' | 'label';
  barcode?: string;
}

const hasMacros = (m?: LabelMacros) => !!m && (m.kcal > 0 || m.p > 0 || m.c > 0 || m.f > 0);

export function ScanBarcodeScreen({ navigation }: Props) {
  const c = useTheme();
  const { t } = useI18n();
  const styles = makeStyles(c);
  const insets = useSafeAreaInsets();
  const { addPantryItem, showToast } = useApp();
  const { user } = useAuth();
  const userId = user?.id;
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<Mode>('scanning');
  const [display, setDisplay] = useState<Display | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [perServing, setPerServing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const busy = useRef(false);

  const onScan = async ({ data }: { data: string }) => {
    if (busy.current || mode !== 'scanning') return;
    busy.current = true;
    setMode('loading');
    const found = await lookupBarcode(data);
    if (found) {
      setDisplay({
        name: found.name,
        brand: found.brand,
        imageUrl: found.imageUrl,
        servingSize: found.servingSize,
        basis: '100g',
        per100: { kcal: found.kcal, p: found.p, c: found.c, f: found.f },
        source: 'off',
        barcode: data,
      });
      setPerServing(false);
      setSaved(false);
      setMode('result');
    } else {
      setMode('notfound');
    }
  };

  const reset = () => {
    setDisplay(null);
    setShots([]);
    setPerServing(false);
    setError(null);
    setSaved(false);
    setSaving(false);
    setMode('scanning');
    busy.current = false;
  };

  const save = async () => {
    if (!display || saving || saved) return;
    setSaving(true);
    try {
      // Persist the photo: an OFF hit already has a remote URL (passes through);
      // an AI-read label has a local first-shot we upload from its base64.
      let imageUrl = display.imageUrl;
      if (userId) {
        if (display.source === 'label' && shots[0]?.base64) {
          imageUrl = (await uploadBase64Image(shots[0].base64, userId, 'pantry')) ?? imageUrl;
        } else if (imageUrl) {
          imageUrl = await uploadImageIfLocal(imageUrl, userId, 'pantry');
        }
      }
      const item: PantryItem = {
        id: `pn${Date.now()}`,
        name: display.name,
        brand: display.brand || undefined,
        barcode: display.barcode,
        imageUrl,
        servingSize: display.servingSize,
        basis: display.basis,
        per100: display.per100,
        perServing: display.perServing,
        source: display.source,
        createdAt: Date.now(),
      };
      addPantryItem(item);
      setSaved(true);
      showToast(t('barcode.saved'));
    } catch {
      setError(t('barcode.labelError'));
    } finally {
      setSaving(false);
    }
  };

  const addShot = async () => {
    setError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85, base64: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.base64) return;
    const base64 = asset.base64;
    let uri = asset.uri;
    try {
      const dest = `${FileSystem.cacheDirectory}label-${Date.now()}.jpg`;
      await FileSystem.writeAsStringAsync(dest, base64, { encoding: FileSystem.EncodingType.Base64 });
      uri = dest;
    } catch {
      /* keep original uri if writing fails */
    }
    setShots((prev) => [...prev, { uri, base64, mimeType: asset.mimeType ?? 'image/jpeg' }].slice(0, 4));
    setMode('capturing');
  };

  const removeShot = (idx: number) => setShots((prev) => prev.filter((_, i) => i !== idx));

  const analyze = async () => {
    if (!shots.length) return;
    setMode('analyzing');
    setError(null);
    try {
      const { product } = await extractNutritionFromLabels(
        shots.map((s) => ({ base64: s.base64, mimeType: s.mimeType })),
      );
      const next: Display = {
        name: product.name || t('barcode.title'),
        brand: product.brand,
        imageUrl: shots[0]?.uri,
        servingSize: product.servingSize,
        basis: product.basis,
        per100: product.per100,
        perServing: hasMacros(product.perServing) ? product.perServing : undefined,
        source: 'label',
      };
      setDisplay(next);
      setPerServing(!!next.perServing); // prefer per-serving when available
      setSaved(false);
      setMode('result');
    } catch (e: any) {
      setError(e?.message || t('barcode.labelError'));
      setMode('capturing');
    }
  };

  const Header = () => (
    <View style={[styles.header, { top: insets.top + 8 }]}>
      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backIcon}>‹</Text>
      </Pressable>
      <Text style={styles.headerTitle}>{t('barcode.title')}</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  if (!permission) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.center, { paddingHorizontal: 32 }]}>
        <Icon name="barcode" size={48} color={c.grayMid} />
        <Text style={styles.permText}>{t('barcode.permission')}</Text>
        <Pressable style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>{t('barcode.grant')}</Text>
        </Pressable>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.permBack}>{t('receiptDetail.goBack')}</Text>
        </Pressable>
      </View>
    );
  }

  const macros = perServing && display?.perServing ? display.perServing : display?.per100;
  const basisLabel =
    perServing && display?.perServing
      ? t('barcode.perServing')
      : display?.basis === '100ml'
        ? t('barcode.per100ml')
        : t('barcode.per100');

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={mode === 'scanning' ? onScan : undefined}
      />
      <View style={styles.scrim} />
      <Header />

      {mode === 'scanning' && (
        <View style={styles.framing} pointerEvents="none">
          <View style={styles.frame} />
          <Text style={styles.frameHint}>{t('barcode.sub')}</Text>
        </View>
      )}

      {mode !== 'scanning' && (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          {mode === 'loading' && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={c.accent} />
              <Text style={styles.loadingText}>{t('barcode.looking')}</Text>
            </View>
          )}

          {mode === 'analyzing' && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={c.accent} />
              <Text style={styles.loadingText}>{t('barcode.analyzing')}</Text>
            </View>
          )}

          {mode === 'notfound' && (
            <>
              <Text style={styles.nfTitle}>{t('barcode.notFound')}</Text>
              <Text style={styles.nfSub}>{t('barcode.notFoundPhotoSub')}</Text>
              <Pressable style={styles.againBtn} onPress={addShot}>
                <Text style={styles.againText}>{t('barcode.photoLabel')}</Text>
              </Pressable>
              <Pressable style={styles.ghostBtn} onPress={reset}>
                <Text style={styles.ghostText}>{t('barcode.scanAgain')}</Text>
              </Pressable>
            </>
          )}

          {mode === 'capturing' && (
            <>
              <Text style={styles.nfTitle}>{t('barcode.photoLabel')}</Text>
              <Text style={styles.nfSub}>{t('barcode.shotsHint')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow}>
                {shots.map((s, i) => (
                  <View key={s.uri} style={styles.thumbWrap}>
                    <Image source={{ uri: s.uri }} style={styles.thumb} resizeMode="cover" />
                    <Pressable style={styles.thumbX} onPress={() => removeShot(i)} hitSlop={8}>
                      <Text style={styles.thumbXText}>×</Text>
                    </Pressable>
                  </View>
                ))}
                {shots.length < 4 && (
                  <Pressable style={styles.thumbAdd} onPress={addShot}>
                    <Icon name="camera" size={22} color={c.grayMid} />
                  </Pressable>
                )}
              </ScrollView>
              <Text style={styles.shotsCount}>{t('barcode.shotsCount', { n: shots.length })}</Text>
              {error ? <Text style={styles.errText}>{error}</Text> : null}
              <Pressable
                style={[styles.againBtn, !shots.length && styles.btnDisabled]}
                onPress={analyze}
                disabled={!shots.length}
              >
                <Text style={styles.againText}>{t('barcode.analyze')}</Text>
              </Pressable>
              <Pressable style={styles.ghostBtn} onPress={reset}>
                <Text style={styles.ghostText}>{t('barcode.startOver')}</Text>
              </Pressable>
            </>
          )}

          {mode === 'result' && display && macros && (
            <>
              <View style={styles.prodRow}>
                {display.imageUrl ? (
                  <Image source={{ uri: display.imageUrl }} style={styles.prodImg} resizeMode="cover" />
                ) : (
                  <View style={[styles.prodImg, styles.prodImgEmpty]}>
                    <Icon name="barcode" size={22} color={c.gray} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.prodName} numberOfLines={2}>{display.name}</Text>
                  {!!display.brand && <Text style={styles.prodBrand} numberOfLines={1}>{display.brand}</Text>}
                </View>
              </View>

              {display.perServing && (
                <View style={styles.toggle}>
                  <Pressable
                    style={[styles.toggleBtn, !perServing && styles.toggleBtnActive]}
                    onPress={() => setPerServing(false)}
                  >
                    <Text style={[styles.toggleText, !perServing && styles.toggleTextActive]}>
                      {display.basis === '100ml' ? t('barcode.per100ml') : t('barcode.per100')}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.toggleBtn, perServing && styles.toggleBtnActive]}
                    onPress={() => setPerServing(true)}
                  >
                    <Text style={[styles.toggleText, perServing && styles.toggleTextActive]}>
                      {t('barcode.perServing')}
                    </Text>
                  </Pressable>
                </View>
              )}

              <View style={styles.nutHead}>
                <Text style={styles.nutLabel}>{basisLabel}</Text>
                <Text style={styles.nutKcal}>{macros.kcal} kcal</Text>
              </View>
              <View style={styles.macros}>
                {[[macros.p, t('recipe.protein'), c.sage], [macros.c, t('recipe.carbs'), c.gold], [macros.f, t('recipe.fat'), c.accent]].map(
                  ([v, l, col]) => (
                    <View key={l as string} style={styles.macroCol}>
                      <View style={styles.macroDot}><View style={[styles.macroDotFill, { backgroundColor: col as string }]} /></View>
                      <Text style={styles.macroVal}>{v as number}g</Text>
                      <Text style={styles.macroLab}>{l as string}</Text>
                    </View>
                  ),
                )}
              </View>
              {!!display.servingSize && <Text style={styles.serving}>{t('barcode.serving', { s: display.servingSize })}</Text>}
              <Text style={styles.source}>{display.source === 'label' ? t('barcode.labelSource') : t('barcode.source')}</Text>

              <Pressable
                style={[styles.againBtn, (saving || saved) && styles.btnDisabled]}
                onPress={save}
                disabled={saving || saved}
              >
                <Text style={styles.againText}>
                  {saved ? `✓ ${t('barcode.saved')}` : saving ? t('barcode.saving') : t('barcode.save')}
                </Text>
              </Pressable>
              <Pressable style={styles.ghostBtn} onPress={reset}>
                <Text style={styles.ghostText}>{t('barcode.scanAgain')}</Text>
              </Pressable>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    center: { alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: c.bg },
    scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
    header: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 5 },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
    backIcon: { fontSize: 28, color: '#fff', marginTop: -3 },
    headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
    framing: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    frame: { width: 250, height: 160, borderWidth: 3, borderColor: '#fff', borderRadius: 20, backgroundColor: 'transparent' },
    frameHint: { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 20, paddingHorizontal: 40 },
    permText: { fontSize: 15, fontWeight: '600', color: c.ink, textAlign: 'center' },
    permBtn: { backgroundColor: c.accent, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 26 },
    permBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    permBack: { fontSize: 14, fontWeight: '600', color: c.grayMid },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: c.bg,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      padding: 22,
    },
    loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
    loadingText: { fontSize: 15, fontWeight: '700', color: c.ink },
    nfTitle: { fontFamily: fonts.display, fontSize: 20, color: c.ink },
    nfSub: { fontSize: 14, fontWeight: '500', color: c.grayMid, marginTop: 4, marginBottom: 16 },
    thumbRow: { marginBottom: 12 },
    thumbWrap: { width: 76, height: 76, borderRadius: 12, marginRight: 10, overflow: 'visible' },
    thumb: { width: 76, height: 76, borderRadius: 12, backgroundColor: c.surfaceAlt },
    thumbX: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' },
    thumbXText: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: -2 },
    thumbAdd: { width: 76, height: 76, borderRadius: 12, borderWidth: 1.5, borderColor: c.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface },
    shotsCount: { fontSize: 12.5, fontWeight: '600', color: c.grayMid, marginBottom: 4 },
    errText: { fontSize: 13, fontWeight: '600', color: '#DC2626', marginTop: 6 },
    btnDisabled: { opacity: 0.5 },
    prodRow: { flexDirection: 'row', gap: 13, alignItems: 'center', marginBottom: 16 },
    prodImg: { width: 56, height: 56, borderRadius: 12, backgroundColor: c.surfaceAlt },
    prodImgEmpty: { alignItems: 'center', justifyContent: 'center' },
    prodName: { fontFamily: fonts.display, fontSize: 18, color: c.ink },
    prodBrand: { fontSize: 13, fontWeight: '500', color: c.grayMid, marginTop: 2 },
    toggle: { flexDirection: 'row', backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 3, marginBottom: 14 },
    toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
    toggleBtnActive: { backgroundColor: c.accent },
    toggleText: { fontSize: 13, fontWeight: '700', color: c.grayMid },
    toggleTextActive: { color: '#fff' },
    nutHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    nutLabel: { fontSize: 13, fontWeight: '700', color: c.grayMid },
    nutKcal: { fontSize: 18, fontWeight: '800', color: c.accent },
    macros: { flexDirection: 'row', gap: 10 },
    macroCol: { flex: 1, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
    macroDot: { marginBottom: 6 },
    macroDotFill: { width: 10, height: 10, borderRadius: 5 },
    macroVal: { fontFamily: fonts.display, fontSize: 16, fontWeight: '700', color: c.ink },
    macroLab: { fontSize: 11, fontWeight: '600', color: c.grayMid, marginTop: 2 },
    serving: { fontSize: 12.5, fontWeight: '500', color: c.grayMid, marginTop: 12 },
    source: { fontSize: 11, fontWeight: '500', color: c.gray, marginTop: 4 },
    againBtn: { backgroundColor: c.accent, borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 18 },
    againText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    ghostBtn: { paddingVertical: 13, alignItems: 'center', marginTop: 6 },
    ghostText: { color: c.grayMid, fontSize: 14, fontWeight: '700' },
  });
