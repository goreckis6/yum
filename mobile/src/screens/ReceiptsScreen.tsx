import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { RootStackParamList } from '../navigation/types';
import { useApp } from '../context/AppContext';
import { ActionSheet, SheetOption } from '../components/ActionSheet';
import { Icon } from '../components/Icon';
import { exportReceipts } from '../api/receipts';
import { RECEIPT_CATEGORIES, Receipt } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Receipts'>;

const FILTERS = ['All', ...RECEIPT_CATEGORIES] as const;

function fmtMoney(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ReceiptsScreen({ navigation }: Props) {
  const c = useTheme();
  const styles = makeStyles(c);
  const insets = useSafeAreaInsets();
  const { receipts, removeReceipt, showToast } = useApp();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('All');
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv');
  const [includePhotos, setIncludePhotos] = useState(false);
  const [rowTarget, setRowTarget] = useState<Receipt | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (receipts ?? [])
      .filter((r) => (filter === 'All' ? true : r.category === filter))
      .filter((r) => !q || r.merchant.toLowerCase().includes(q))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [receipts, search, filter]);

  const total = useMemo(() => filtered.reduce((n, r) => n + (Number(r.total) || 0), 0), [filtered]);
  const currency = filtered[0]?.currency || '';

  const photoCount = useMemo(() => filtered.filter((r) => !!r.imageUrl).length, [filtered]);

  const doExport = async () => {
    if (!filtered.length || busy) return;
    setBusy(true);
    try {
      const usePhotos = exportFormat === 'pdf' && includePhotos;
      const file = await exportReceipts(filtered, exportFormat, usePhotos);
      const uri = `${FileSystem.cacheDirectory}${file.filename}`;
      await FileSystem.writeAsStringAsync(uri, file.base64, { encoding: FileSystem.EncodingType.Base64 });
      setExportOpen(false);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: file.mimeType,
          UTI: exportFormat === 'pdf' ? 'com.adobe.pdf' : 'public.comma-separated-values-text',
        });
      } else {
        showToast('Sharing not available on this device');
      }
    } catch (e: any) {
      showToast(e?.message || 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  const rowOptions: SheetOption[] = rowTarget
    ? [
        {
          label: 'Delete receipt',
          destructive: true,
          onPress: () => {
            removeReceipt(rowTarget.id);
            showToast('Receipt deleted');
          },
        },
      ]
    : [];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          {filtered.length > 0 && (
            <Pressable style={styles.exportBtn} onPress={() => setExportOpen(true)}>
              <Text style={styles.exportText}>Export</Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.title}>Receipts</Text>

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>{filter === 'All' ? 'TOTAL' : `${filter.toUpperCase()} TOTAL`}</Text>
          <Text style={styles.totalValue}>
            {currency ? `${currency} ` : ''}
            {fmtMoney(total)}
          </Text>
          <Text style={styles.totalSub}>{filtered.length} receipt{filtered.length === 1 ? '' : 's'}</Text>
        </View>

        <View style={styles.searchBox}>
          <Icon name="search" size={18} color={c.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by merchant"
            placeholderTextColor={c.gray}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {FILTERS.map((f) => (
            <Pressable key={f} style={[styles.chip, filter === f && styles.chipOn]} onPress={() => setFilter(f)}>
              <Text style={[styles.chipText, filter === f && styles.chipTextOn]}>{f}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="receipt" size={42} color={c.gray} />
            <Text style={styles.emptyTitle}>No receipts yet</Text>
            <Text style={styles.emptySub}>Tap Capture to scan your first receipt</Text>
          </View>
        ) : (
          filtered.map((r) => (
            <Pressable key={r.id} style={styles.row} onLongPress={() => setRowTarget(r)}>
              <View style={styles.rowIcon}>
                <Icon name="receipt" size={20} color={c.accent} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowMerchant} numberOfLines={1}>{r.merchant}</Text>
                <Text style={styles.rowMeta}>{fmtDate(r.date)} · {r.category}</Text>
              </View>
              <Text style={styles.rowTotal}>{r.currency ? `${r.currency} ` : ''}{fmtMoney(r.total)}</Text>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Pressable
        style={[styles.capture, { bottom: insets.bottom + 18 }]}
        onPress={() => navigation.navigate('ScanReceipt')}
      >
        <Icon name="camera" size={20} color="#fff" />
        <Text style={styles.captureText}>Capture</Text>
      </Pressable>

      <Modal visible={exportOpen} transparent animationType="slide" onRequestClose={() => setExportOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => !busy && setExportOpen(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Export</Text>
            <Text style={styles.sheetSub}>
              {filtered.length} receipt{filtered.length === 1 ? '' : 's'} · {currency} {fmtMoney(total)}
            </Text>

            <Text style={styles.sheetLabel}>FORMAT</Text>
            <Pressable
              style={[styles.fmtCard, exportFormat === 'csv' && styles.fmtCardOn]}
              onPress={() => setExportFormat('csv')}
            >
              <View style={styles.fmtIcon}>
                <Icon name="receipt" size={20} color={c.accent} />
              </View>
              <View style={styles.fmtBody}>
                <Text style={styles.fmtTitle}>CSV <Text style={styles.fmtExt}>.csv</Text></Text>
                <Text style={styles.fmtDesc}>Opens in Numbers, Excel or Google Sheets</Text>
              </View>
              <View style={[styles.radio, exportFormat === 'csv' && styles.radioOn]}>
                {exportFormat === 'csv' && <Text style={styles.radioTick}>✓</Text>}
              </View>
            </Pressable>

            <Pressable
              style={[styles.fmtCard, exportFormat === 'pdf' && styles.fmtCardOn]}
              onPress={() => setExportFormat('pdf')}
            >
              <View style={styles.fmtIcon}>
                <Icon name="receipt" size={20} color={c.accent} />
              </View>
              <View style={styles.fmtBody}>
                <Text style={styles.fmtTitle}>PDF <Text style={styles.fmtExt}>.pdf</Text></Text>
                <Text style={styles.fmtDesc}>Printable summary — for a client or your records</Text>
              </View>
              <View style={[styles.radio, exportFormat === 'pdf' && styles.radioOn]}>
                {exportFormat === 'pdf' && <Text style={styles.radioTick}>✓</Text>}
              </View>
            </Pressable>

            <Text style={styles.sheetLabel}>RECEIPT IMAGES</Text>
            <View style={[styles.photoRow, exportFormat !== 'pdf' && styles.photoRowDim]}>
              <View style={styles.fmtBody}>
                <Text style={styles.fmtTitle}>Include receipt photos</Text>
                <Text style={styles.fmtDesc}>
                  {exportFormat !== 'pdf'
                    ? 'Only available in PDF export'
                    : photoCount > 0
                    ? `${photoCount} photo${photoCount === 1 ? '' : 's'} attached in this range`
                    : 'No photos attached in this range'}
                </Text>
              </View>
              <Switch
                value={exportFormat === 'pdf' && includePhotos}
                disabled={exportFormat !== 'pdf' || photoCount === 0}
                onValueChange={setIncludePhotos}
                trackColor={{ true: c.accent, false: c.border }}
                thumbColor="#fff"
              />
            </View>

            <Pressable style={[styles.shareBtn, busy && styles.shareDisabled]} onPress={doExport} disabled={busy}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Icon name="link" size={17} color="#fff" />
                  <Text style={styles.shareText}>Share {exportFormat.toUpperCase()}</Text>
                </>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <ActionSheet
        visible={!!rowTarget}
        title={rowTarget?.merchant ?? 'Receipt'}
        message={rowTarget ? `${rowTarget.currency} ${fmtMoney(rowTarget.total)} · ${fmtDate(rowTarget.date)}` : undefined}
        options={rowOptions}
        onClose={() => setRowTarget(null)}
      />
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 110 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backIcon: { fontSize: 28, color: c.ink },
    exportBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 999,
    },
    exportText: { fontSize: 14, fontWeight: '700', color: c.ink },
    title: { fontFamily: fonts.display, fontSize: 30, color: c.ink, letterSpacing: -0.6, marginBottom: 16 },
    totalCard: {
      backgroundColor: c.accentSoft,
      borderRadius: 20,
      padding: 20,
      marginBottom: 16,
    },
    totalLabel: { fontSize: 12, fontWeight: '700', color: c.accent, letterSpacing: 0.5, marginBottom: 6 },
    totalValue: { fontFamily: fonts.displayExtra, fontSize: 36, color: c.ink, letterSpacing: -1 },
    totalSub: { fontSize: 13, fontWeight: '600', color: c.grayMid, marginTop: 4 },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      paddingHorizontal: 15,
      paddingVertical: 13,
      marginBottom: 14,
    },
    searchInput: { flex: 1, fontSize: 15, fontWeight: '500', color: c.ink },
    chipRow: { marginBottom: 18, marginHorizontal: -20, paddingHorizontal: 20 },
    chip: {
      paddingVertical: 9,
      paddingHorizontal: 15,
      borderRadius: 999,
      backgroundColor: c.surfaceAlt,
      marginRight: 8,
    },
    chipOn: { backgroundColor: c.accent },
    chipText: { fontSize: 13.5, fontWeight: '600', color: c.grayMid },
    chipTextOn: { color: '#fff' },
    empty: { alignItems: 'center', paddingVertical: 70, gap: 10 },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: c.ink },
    emptySub: { fontSize: 14, fontWeight: '500', color: c.grayMid },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      padding: 13,
      marginBottom: 10,
    },
    rowIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: c.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowBody: { flex: 1 },
    rowMerchant: { fontSize: 15, fontWeight: '700', color: c.ink },
    rowMeta: { fontSize: 12.5, fontWeight: '500', color: c.grayMid, marginTop: 2 },
    rowTotal: { fontFamily: fonts.display, fontSize: 16, fontWeight: '700', color: c.ink },
    capture: {
      position: 'absolute',
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.accent,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 999,
      shadowColor: c.accent,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.35,
      shadowRadius: 18,
      elevation: 6,
    },
    captureText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    sheetBackdrop: { flex: 1, backgroundColor: c.scrim, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: c.bg,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    sheetHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: c.border, alignSelf: 'center', marginBottom: 16 },
    sheetTitle: { fontFamily: fonts.display, fontSize: 22, color: c.ink, textAlign: 'center' },
    sheetSub: { fontSize: 13, fontWeight: '600', color: c.grayMid, textAlign: 'center', marginTop: 2, marginBottom: 18 },
    sheetLabel: { fontSize: 11, fontWeight: '700', color: c.grayMid, letterSpacing: 0.5, marginBottom: 8, marginTop: 6 },
    fmtCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 16,
      padding: 14,
      marginBottom: 10,
    },
    fmtCardOn: { borderColor: c.accent, backgroundColor: c.accentSoft },
    fmtIcon: {
      width: 40,
      height: 40,
      borderRadius: 11,
      backgroundColor: c.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fmtBody: { flex: 1 },
    fmtTitle: { fontSize: 15.5, fontWeight: '700', color: c.ink },
    fmtExt: { fontSize: 12, fontWeight: '600', color: c.grayMid },
    fmtDesc: { fontSize: 12, fontWeight: '500', color: c.grayMid, marginTop: 2 },
    radio: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOn: { backgroundColor: c.accent, borderColor: c.accent },
    radioTick: { color: '#fff', fontSize: 13, fontWeight: '700' },
    photoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      padding: 14,
      marginBottom: 18,
    },
    photoRowDim: { opacity: 0.55 },
    shareBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.accent,
      borderRadius: 16,
      paddingVertical: 16,
      marginTop: 4,
    },
    shareDisabled: { opacity: 0.7 },
    shareText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  });
