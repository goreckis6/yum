import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
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
import { useI18n } from '../i18n/I18nContext';
import type { TKey } from '../i18n/translations';
import { formatDateNum, toISO } from '../utils/dates';
import type { DateFormat } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Receipts'>;
type DateRange = 'all' | 'month' | '30d' | 'year';

const FILTERS = ['All', ...RECEIPT_CATEGORIES] as const;
const RANGE_KEY: Record<DateRange, TKey> = {
  all: 'receipts.allDates',
  month: 'receipts.thisMonth',
  '30d': 'receipts.last30',
  year: 'receipts.thisYear',
};

// Only http(s)/file URIs are safe for <Image>; ph:// or blob: crash the native
// image loader on iOS ("No suitable URL request handler for blob").
function isSafeImg(uri?: string): boolean {
  return !!uri && /^(https?|file):/i.test(uri);
}

function fmtMoney(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string, fmt: DateFormat) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return formatDateNum(toISO(d), fmt);
}

function fmtDayHeader(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function inRange(iso: string, range: DateRange) {
  if (range === 'all') return true;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return true;
  const now = new Date();
  if (range === 'month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  if (range === 'year') return d.getFullYear() === now.getFullYear();
  if (range === '30d') {
    const diff = (now.getTime() - d.getTime()) / 86400000;
    return diff <= 30 && diff >= -1;
  }
  return true;
}

export function ReceiptsScreen({ navigation }: Props) {
  const c = useTheme();
  const { t } = useI18n();
  const styles = makeStyles(c);
  const insets = useSafeAreaInsets();
  const { receipts, removeReceipt, showToast, dateFormat } = useApp();
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [filter, setFilter] = useState<string>('All');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [range, setRange] = useState<DateRange>('all');
  const [rangeOpen, setRangeOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv');
  const [includePhotos, setIncludePhotos] = useState(false);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (receipts ?? [])
      .filter((r) => (filter === 'All' ? true : r.category === filter))
      .filter((r) => (tagFilter ? (r.tags ?? []).includes(tagFilter) : true))
      .filter((r) => inRange(r.date, range))
      .filter((r) => !q || r.merchant.toLowerCase().includes(q))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
  }, [receipts, search, filter, tagFilter, range]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    (receipts ?? []).forEach((r) => (r.tags ?? []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [receipts]);

  // Sum per currency so mixed-currency totals are never added together.
  const byCurrency = useMemo(() => {
    const m = new Map<string, { currency: string; total: number; tax: number; count: number }>();
    filtered.forEach((r) => {
      const cur = r.currency || '—';
      const e = m.get(cur) ?? { currency: cur, total: 0, tax: 0, count: 0 };
      e.total += Number(r.total) || 0;
      e.tax += Number(r.tax) || 0;
      e.count += 1;
      m.set(cur, e);
    });
    return Array.from(m.values()).sort((a, b) => b.total - a.total);
  }, [filtered]);
  const primary = byCurrency[0];
  const total = primary?.total ?? 0;
  const currency = primary?.currency ?? '';
  const needsReview = useMemo(() => filtered.filter((r) => !r.total || !r.merchant).length, [filtered]);

  // Group the filtered receipts by day for the sectioned list.
  const groups = useMemo(() => {
    const map = new Map<string, Receipt[]>();
    filtered.forEach((r) => {
      const arr = map.get(r.date) ?? [];
      arr.push(r);
      map.set(r.date, arr);
    });
    return Array.from(map.entries()).map(([date, items]) => ({
      date,
      items,
      subtotal: items.reduce((n, r) => n + (Number(r.total) || 0), 0),
    }));
  }, [filtered]);

  const photoCount = useMemo(() => filtered.filter((r) => !!r.imageUrl).length, [filtered]);

  // Merchant autocomplete suggestions for the search box.
  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    (receipts ?? []).forEach((r) => {
      const m = r.merchant?.trim();
      if (!m) return;
      const lc = m.toLowerCase();
      if (lc.includes(q) && lc !== q && !seen.has(lc)) {
        seen.add(lc);
        out.push(m);
      }
    });
    return out.slice(0, 6);
  }, [receipts, search]);

  const doExport = async () => {
    if (!filtered.length || busy) return;
    setBusy(true);
    try {
      const usePhotos = exportFormat === 'pdf' && includePhotos;
      const file = await exportReceipts(filtered, exportFormat, usePhotos);
      const uri = `${FileSystem.cacheDirectory}${file.filename}`;
      await FileSystem.writeAsStringAsync(uri, file.base64, { encoding: FileSystem.EncodingType.Base64 });
      // Present the share sheet BEFORE closing our modal — closing first makes
      // iOS refuse to present the share sheet while the modal is dismissing.
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: file.mimeType,
          UTI: exportFormat === 'pdf' ? 'com.adobe.pdf' : 'public.comma-separated-values-text',
        });
      } else {
        showToast('Sharing not available on this device');
      }
      setExportOpen(false);
    } catch (e: any) {
      showToast(e?.message || t('export.failed'));
    } finally {
      setBusy(false);
    }
  };

  const rangeOptions: SheetOption[] = (Object.keys(RANGE_KEY) as DateRange[]).map((key) => ({
    label: t(RANGE_KEY[key]),
    onPress: () => setRange(key),
  }));

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <Text style={styles.brand}>{t('receipts.title')}</Text>
          {filtered.length > 0 ? (
            <Pressable style={styles.exportBtn} onPress={() => setExportOpen(true)}>
              <Icon name="link" size={15} color={c.ink} />
              <Text style={styles.exportText}>{t('receipts.export')}</Text>
            </Pressable>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        <View style={styles.totalCard}>
          <View style={styles.totalTop}>
            <Text style={styles.totalLabel}>{filter === 'All' ? t('receipts.total') : `${filter.toUpperCase()} ${t('receipts.total')}`}</Text>
            <Text style={styles.totalCount}>{t('receipts.receiptsCount', { n: filtered.length })}</Text>
          </View>
          {byCurrency.length === 0 ? (
            <Text style={styles.totalValue}>0.00</Text>
          ) : (
            byCurrency.map((e, i) => (
              <View key={e.currency} style={styles.totalLine}>
                <Text style={i === 0 ? styles.totalValue : styles.totalValueAlt}>
                  {e.currency} {fmtMoney(e.total)}
                </Text>
                {byCurrency.length > 1 && (
                  <Text style={styles.totalLineMeta}>
                    {e.count} · tax {fmtMoney(e.tax)}
                  </Text>
                )}
              </View>
            ))
          )}
          <Text style={styles.totalSub}>
            {byCurrency.length <= 1 && primary ? `Tax ${currency} ${fmtMoney(primary.tax)}  ·  ` : ''}
            {t(RANGE_KEY[range])}
          </Text>
        </View>

        <View style={styles.searchBox}>
          <Icon name="search" size={18} color={c.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('receipts.searchPlaceholder')}
            placeholderTextColor={c.gray}
            value={search}
            onChangeText={setSearch}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Text style={styles.searchClear}>✕</Text>
            </Pressable>
          )}
        </View>

        {searchFocused && suggestions.length > 0 && (
          <View style={styles.suggestBox}>
            {suggestions.map((m, i) => (
              <Pressable
                key={m}
                style={[styles.suggestRow, i === suggestions.length - 1 && styles.suggestRowLast]}
                onPress={() => {
                  setSearch(m);
                  setSearchFocused(false);
                }}
              >
                <Icon name="search" size={15} color={c.gray} />
                <Text style={styles.suggestText} numberOfLines={1}>{m}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          <Pressable style={[styles.chip, range !== 'all' && styles.chipOn]} onPress={() => setRangeOpen(true)}>
            <Text style={[styles.chipText, range !== 'all' && styles.chipTextOn]}>{t(RANGE_KEY[range])} ▾</Text>
          </Pressable>
          {allTags.map((t) => {
            const on = tagFilter === t;
            return (
              <Pressable
                key={`tag-${t}`}
                style={[styles.chip, styles.tagChip, on && styles.tagChipOn]}
                onPress={() => setTagFilter(on ? null : t)}
              >
                <Text style={[styles.tagChipText, on && styles.chipTextOn]}>#{t}</Text>
              </Pressable>
            );
          })}
          {FILTERS.map((f) => (
            <Pressable key={f} style={[styles.chip, filter === f && styles.chipOn]} onPress={() => setFilter(f)}>
              <Text style={[styles.chipText, filter === f && styles.chipTextOn]}>{f}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {needsReview > 0 && (
          <Text style={styles.reviewNote}>
            ● {needsReview === 1 ? t('receipts.needsReview1') : t('receipts.needsReview', { n: needsReview })}
          </Text>
        )}

        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="receipt" size={42} color={c.gray} />
            <Text style={styles.emptyTitle}>{t('receipts.empty')}</Text>
            <Text style={styles.emptySub}>{t('receipts.emptySub')}</Text>
          </View>
        ) : (
          groups.map((g) => (
            <View key={g.date} style={styles.group}>
              <View style={styles.groupHead}>
                <Text style={styles.groupDate}>{fmtDayHeader(g.date)} · {g.items.length}</Text>
                <Text style={styles.groupSub}>{g.items[0]?.currency} {fmtMoney(g.subtotal)}</Text>
              </View>
              {g.items.map((r) => (
                <Pressable key={r.id} style={styles.row} onPress={() => navigation.navigate('ReceiptDetail', { id: r.id })}>
                  {isSafeImg(r.imageUrl) ? (
                    <Image source={{ uri: r.imageUrl }} style={styles.rowThumb} resizeMode="cover" />
                  ) : (
                    <View style={styles.rowIcon}>
                      <Icon name="receipt" size={20} color={c.accent} />
                    </View>
                  )}
                  <View style={styles.rowBody}>
                    <View style={styles.rowTitleLine}>
                      <Text style={styles.rowMerchant} numberOfLines={1}>{r.merchant}</Text>
                      {(!r.total || !r.merchant) && <View style={styles.reviewDot} />}
                    </View>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {fmtDate(r.date, dateFormat)} · {r.category}
                      {r.tags?.length ? `  ${r.tags.map((t) => `#${t}`).join(' ')}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.rowTotal}>{r.currency ? `${r.currency} ` : ''}{fmtMoney(r.total)}</Text>
                </Pressable>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <Pressable
        style={[styles.capture, { bottom: insets.bottom + 18 }]}
        onPress={() => navigation.navigate('ScanReceipt')}
      >
        <Icon name="camera" size={20} color="#fff" />
        <Text style={styles.captureText}>{t('receipts.capture')}</Text>
      </Pressable>

      <Modal visible={exportOpen} transparent animationType="slide" onRequestClose={() => setExportOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => !busy && setExportOpen(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{t('export.title')}</Text>
              <Pressable style={styles.closeBtn} onPress={() => !busy && setExportOpen(false)}>
                <Text style={styles.closeIcon}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetLabel}>{t('export.scope')}</Text>
              <View style={styles.scopeCard}>
                <Pressable style={styles.scopeRow} onPress={() => setRangeOpen(true)}>
                  <Icon name="calendar" size={18} color={c.grayMid} />
                  <Text style={styles.scopeLabel}>{t('receipts.dateRange')}</Text>
                  <Text style={styles.scopeValue}>{t(RANGE_KEY[range])} ›</Text>
                </Pressable>
                <View style={styles.scopeDivider} />
                <View style={styles.scopeRow}>
                  <Icon name="grid" size={18} color={c.grayMid} />
                  <Text style={styles.scopeLabel}>{t('export.categories')}</Text>
                  <Text style={styles.scopeValue}>{filter === 'All' ? t('export.allCategories') : filter}</Text>
                </View>
              </View>

              <Text style={styles.sheetLabel}>{t('export.format')}</Text>
              <Pressable style={[styles.fmtCard, exportFormat === 'csv' && styles.fmtCardOn]} onPress={() => setExportFormat('csv')}>
                <View style={styles.fmtIcon}><Icon name="receipt" size={20} color={c.accent} /></View>
                <View style={styles.fmtBody}>
                  <Text style={styles.fmtTitle}>CSV <Text style={styles.fmtExt}>.csv</Text></Text>
                  <Text style={styles.fmtDesc}>{t('export.csvDesc')}</Text>
                </View>
                <View style={[styles.radio, exportFormat === 'csv' && styles.radioOn]}>
                  {exportFormat === 'csv' && <Text style={styles.radioTick}>✓</Text>}
                </View>
              </Pressable>

              <Pressable style={[styles.fmtCard, exportFormat === 'pdf' && styles.fmtCardOn]} onPress={() => setExportFormat('pdf')}>
                <View style={styles.fmtIcon}><Icon name="receipt" size={20} color={c.accent} /></View>
                <View style={styles.fmtBody}>
                  <Text style={styles.fmtTitle}>PDF <Text style={styles.fmtExt}>.pdf</Text></Text>
                  <Text style={styles.fmtDesc}>{t('export.pdfDesc')}</Text>
                </View>
                <View style={[styles.radio, exportFormat === 'pdf' && styles.radioOn]}>
                  {exportFormat === 'pdf' && <Text style={styles.radioTick}>✓</Text>}
                </View>
              </Pressable>

              <Text style={styles.sheetLabel}>{t('export.receiptImages')}</Text>
              <View style={[styles.photoRow, exportFormat !== 'pdf' && styles.photoRowDim]}>
                <View style={styles.fmtBody}>
                  <Text style={styles.fmtTitle}>{t('export.includePhotos')}</Text>
                  <Text style={styles.fmtDesc}>
                    {exportFormat !== 'pdf'
                      ? t('export.onlyPdf')
                      : photoCount > 0
                      ? t('export.photosAttached', { n: photoCount })
                      : t('export.noPhotos')}
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

              <Text style={styles.sheetLabel}>{t('export.preview', { n: filtered.length })}</Text>
              <View style={styles.previewCard}>
                <View style={styles.previewHead}>
                  <Text style={[styles.previewHeadCell, styles.previewMerchant]}>{t('export.merchant')}</Text>
                  <Text style={[styles.previewHeadCell, styles.previewDate]}>{t('export.date')}</Text>
                  <Text style={[styles.previewHeadCell, styles.previewTotal]}>{t('export.totalCol')}</Text>
                </View>
                {filtered.slice(0, 4).map((r) => (
                  <View key={r.id} style={styles.previewRow}>
                    <Text style={[styles.previewMerchant, styles.previewVal]} numberOfLines={1}>{r.merchant}</Text>
                    <Text style={[styles.previewDate, styles.previewMeta]}>{fmtDate(r.date, dateFormat)}</Text>
                    <Text style={[styles.previewTotal, styles.previewVal]}>{r.currency} {fmtMoney(r.total)}</Text>
                  </View>
                ))}
                <View style={styles.previewFootRow}>
                  <Text style={styles.previewMore}>
                    {filtered.length > 4
                      ? t('export.more', { n: filtered.length - 4, total: filtered.length })
                      : t('export.rows', { n: filtered.length })}
                  </Text>
                  <Text style={styles.previewGrand}>{currency} {fmtMoney(total)}</Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.btnRow}>
              <Pressable style={[styles.shareBtn, busy && styles.shareDisabled]} onPress={doExport} disabled={busy}>
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Icon name="link" size={17} color="#fff" />
                    <Text style={styles.shareText}>{t('export.share')}</Text>
                  </>
                )}
              </Pressable>
              <Pressable style={[styles.saveBtn, busy && styles.shareDisabled]} onPress={doExport} disabled={busy}>
                <Icon name="grid" size={17} color={c.ink} />
                <Text style={styles.saveText}>{t('export.saveToFiles')}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <ActionSheet
        visible={rangeOpen}
        title={t('receipts.dateRange')}
        options={rangeOptions}
        onClose={() => setRangeOpen(false)}
      />
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 110 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
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
    brand: { fontFamily: fonts.display, fontSize: 20, color: c.ink },
    exportBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 999,
    },
    exportText: { fontSize: 13.5, fontWeight: '700', color: c.ink },
    totalCard: { backgroundColor: c.accentSoft, borderRadius: 20, padding: 20, marginBottom: 16 },
    totalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    totalLabel: { fontSize: 12, fontWeight: '700', color: c.accent, letterSpacing: 0.5 },
    totalCount: { fontSize: 13, fontWeight: '600', color: c.grayMid },
    totalValue: { fontFamily: fonts.displayExtra, fontSize: 38, color: c.ink, letterSpacing: -1 },
    totalValueAlt: { fontFamily: fonts.display, fontSize: 22, fontWeight: '700', color: c.ink },
    totalLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
    totalLineMeta: { fontSize: 12, fontWeight: '600', color: c.grayMid },
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
    searchClear: { fontSize: 14, fontWeight: '700', color: c.grayMid, paddingHorizontal: 2 },
    suggestBox: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      marginTop: -6,
      marginBottom: 14,
      overflow: 'hidden',
    },
    suggestRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 15,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    suggestRowLast: { borderBottomWidth: 0 },
    suggestText: { flex: 1, fontSize: 14.5, fontWeight: '600', color: c.ink },
    chipRow: { marginBottom: 14, marginHorizontal: -20, paddingHorizontal: 20 },
    chip: { paddingVertical: 9, paddingHorizontal: 15, borderRadius: 999, backgroundColor: c.surfaceAlt, marginRight: 8 },
    chipOn: { backgroundColor: c.accent },
    chipText: { fontSize: 13.5, fontWeight: '600', color: c.grayMid },
    chipTextOn: { color: '#fff' },
    tagChip: { backgroundColor: c.sageSoft },
    tagChipOn: { backgroundColor: c.sage },
    tagChipText: { fontSize: 13.5, fontWeight: '700', color: c.sage },
    reviewNote: { fontSize: 12.5, fontWeight: '600', color: c.gold, marginBottom: 12 },
    empty: { alignItems: 'center', paddingVertical: 70, gap: 10 },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: c.ink },
    emptySub: { fontSize: 14, fontWeight: '500', color: c.grayMid },
    group: { marginBottom: 8 },
    groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, marginTop: 6 },
    groupDate: { fontSize: 13, fontWeight: '700', color: c.grayLight },
    groupSub: { fontSize: 13, fontWeight: '600', color: c.grayMid },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      padding: 11,
      marginBottom: 10,
    },
    rowThumb: { width: 46, height: 46, borderRadius: 12, backgroundColor: c.surfaceAlt },
    rowIcon: { width: 46, height: 46, borderRadius: 12, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' },
    rowBody: { flex: 1 },
    rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    rowMerchant: { fontSize: 15, fontWeight: '700', color: c.ink, flexShrink: 1 },
    reviewDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.gold },
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
      maxHeight: '90%',
    },
    sheetHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: c.border, alignSelf: 'center', marginBottom: 12 },
    sheetHead: { height: 36, justifyContent: 'center', marginBottom: 6 },
    sheetTitle: { fontFamily: fonts.display, fontSize: 22, color: c.ink, textAlign: 'center' },
    closeBtn: {
      position: 'absolute',
      right: 0,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeIcon: { fontSize: 15, fontWeight: '700', color: c.grayMid },
    sheetScroll: { marginBottom: 12 },
    sheetLabel: { fontSize: 11, fontWeight: '700', color: c.grayMid, letterSpacing: 0.5, marginBottom: 8, marginTop: 6 },
    scopeCard: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingHorizontal: 14, marginBottom: 6 },
    scopeRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 14 },
    scopeDivider: { height: 1, backgroundColor: c.border },
    scopeLabel: { flex: 1, fontSize: 14.5, fontWeight: '600', color: c.ink },
    scopeValue: { fontSize: 14, fontWeight: '600', color: c.grayMid },
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
    fmtIcon: { width: 40, height: 40, borderRadius: 11, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' },
    fmtBody: { flex: 1 },
    fmtTitle: { fontSize: 15.5, fontWeight: '700', color: c.ink },
    fmtExt: { fontSize: 12, fontWeight: '600', color: c.grayMid },
    fmtDesc: { fontSize: 12, fontWeight: '500', color: c.grayMid, marginTop: 2 },
    radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
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
      marginBottom: 6,
    },
    photoRowDim: { opacity: 0.55 },
    previewCard: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 6 },
    previewHead: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border },
    previewHeadCell: { fontSize: 10, fontWeight: '700', color: c.grayMid, letterSpacing: 0.4 },
    previewRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
    previewMerchant: { flex: 1 },
    previewDate: { width: 70, textAlign: 'right' },
    previewTotal: { width: 86, textAlign: 'right' },
    previewVal: { fontSize: 13, fontWeight: '700', color: c.ink },
    previewMeta: { fontSize: 12, fontWeight: '500', color: c.grayMid },
    previewFootRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.border, marginTop: 2 },
    previewMore: { fontSize: 12, fontWeight: '600', color: c.grayMid },
    previewGrand: { fontSize: 14, fontWeight: '800', color: c.ink },
    btnRow: { flexDirection: 'row', gap: 10 },
    shareBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.accent,
      borderRadius: 16,
      paddingVertical: 16,
    },
    shareDisabled: { opacity: 0.7 },
    shareText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    saveBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      paddingVertical: 16,
    },
    saveText: { color: c.ink, fontSize: 15, fontWeight: '700' },
  });
