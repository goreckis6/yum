import React, { useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { RootStackParamList } from '../navigation/types';
import { useI18n } from '../i18n/I18nContext';
import { Icon } from '../components/Icon';
import { FoodProduct, lookupBarcode } from '../api/openfoodfacts';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanBarcode'>;
type Mode = 'scanning' | 'loading' | 'result' | 'notfound';

export function ScanBarcodeScreen({ navigation }: Props) {
  const c = useTheme();
  const { t } = useI18n();
  const styles = makeStyles(c);
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<Mode>('scanning');
  const [product, setProduct] = useState<FoodProduct | null>(null);
  const busy = useRef(false);

  const onScan = async ({ data }: { data: string }) => {
    if (busy.current || mode !== 'scanning') return;
    busy.current = true;
    setMode('loading');
    const found = await lookupBarcode(data);
    setProduct(found);
    setMode(found ? 'result' : 'notfound');
  };

  const scanAgain = () => {
    setProduct(null);
    setMode('scanning');
    busy.current = false;
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

          {mode === 'notfound' && (
            <>
              <Text style={styles.nfTitle}>{t('barcode.notFound')}</Text>
              <Text style={styles.nfSub}>{t('barcode.notFoundSub')}</Text>
              <Pressable style={styles.againBtn} onPress={scanAgain}>
                <Text style={styles.againText}>{t('barcode.scanAgain')}</Text>
              </Pressable>
            </>
          )}

          {mode === 'result' && product && (
            <>
              <View style={styles.prodRow}>
                {product.imageUrl ? (
                  <Image source={{ uri: product.imageUrl }} style={styles.prodImg} resizeMode="cover" />
                ) : (
                  <View style={[styles.prodImg, styles.prodImgEmpty]}>
                    <Icon name="barcode" size={22} color={c.gray} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.prodName} numberOfLines={2}>{product.name}</Text>
                  {!!product.brand && <Text style={styles.prodBrand} numberOfLines={1}>{product.brand}</Text>}
                </View>
              </View>

              <View style={styles.nutHead}>
                <Text style={styles.nutLabel}>{t('barcode.per100')}</Text>
                <Text style={styles.nutKcal}>{product.kcal} kcal</Text>
              </View>
              <View style={styles.macros}>
                {[[product.p, t('recipe.protein'), c.sage], [product.c, t('recipe.carbs'), c.gold], [product.f, t('recipe.fat'), c.accent]].map(
                  ([v, l, col]) => (
                    <View key={l as string} style={styles.macroCol}>
                      <View style={styles.macroDot}><View style={[styles.macroDotFill, { backgroundColor: col as string }]} /></View>
                      <Text style={styles.macroVal}>{v as number}g</Text>
                      <Text style={styles.macroLab}>{l as string}</Text>
                    </View>
                  ),
                )}
              </View>
              {!!product.servingSize && <Text style={styles.serving}>{t('barcode.serving', { s: product.servingSize })}</Text>}
              <Text style={styles.source}>{t('barcode.source')}</Text>

              <Pressable style={styles.againBtn} onPress={scanAgain}>
                <Text style={styles.againText}>{t('barcode.scanAgain')}</Text>
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
    prodRow: { flexDirection: 'row', gap: 13, alignItems: 'center', marginBottom: 16 },
    prodImg: { width: 56, height: 56, borderRadius: 12, backgroundColor: c.surfaceAlt },
    prodImgEmpty: { alignItems: 'center', justifyContent: 'center' },
    prodName: { fontFamily: fonts.display, fontSize: 18, color: c.ink },
    prodBrand: { fontSize: 13, fontWeight: '500', color: c.grayMid, marginTop: 2 },
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
  });
