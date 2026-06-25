import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { Icon } from './Icon';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { DayKey, MealEntry, MealSlot, PantryItem, Recipe } from '../types';
import { OFFSearchResult, searchProducts } from '../api/openfoodfacts';
import type { TKey } from '../i18n/translations';

type Tab = 'pantry' | 'recipes' | 'db';

const SLOT_LABEL: Record<MealSlot, TKey> = {
  Breakfast: 'slot.Breakfast',
  SecondBreakfast: 'slot.SecondBreakfast',
  Lunch: 'slot.Lunch',
  Dinner: 'slot.Dinner',
  Snack: 'slot.Snack',
  Supper: 'slot.Supper',
};

interface QtyTarget {
  name: string;
  brand?: string;
  kcalPer100: number;
  pPer100: number;
  cPer100: number;
  fPer100: number;
  fromDb: boolean;
  pantryId?: string;
  dbItem?: OFFSearchResult;
}

interface Props {
  visible: boolean;
  slot: MealSlot;
  day: DayKey;
  onClose: () => void;
  onAdd: (entry: MealEntry) => void;
}

export function MealAddSheet({ visible, slot, day, onClose, onAdd }: Props) {
  const c = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { pantry, recipes, grocery, addGroceryItem } = useApp();

  const [tab, setTab] = useState<Tab>('pantry');
  const [query, setQuery] = useState('');
  const [dbResults, setDbResults] = useState<OFFSearchResult[]>([]);
  const [dbStatus, setDbStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const [qtyTarget, setQtyTarget] = useState<QtyTarget | null>(null);
  const [qty, setQty] = useState(100);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<TextInput>(null);
  const [inputFocused, setInputFocused] = useState(false);

  const slotLabel = t(SLOT_LABEL[slot] as TKey);

  useEffect(() => {
    if (!visible) {
      setTab('pantry');
      setQuery('');
      setDbResults([]);
      setDbStatus('idle');
      setQtyTarget(null);
      setQty(100);
    }
  }, [visible]);

  // Debounced OFF search
  useEffect(() => {
    if (tab !== 'db') return;
    if (query.trim().length < 2) { setDbResults([]); setDbStatus('idle'); return; }
    const timeout = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setDbStatus('loading');
      const results = await searchProducts(query.trim(), ctrl.signal);
      if (ctrl.signal.aborted) return;
      setDbResults(results);
      setDbStatus('done');
    }, 500);
    return () => clearTimeout(timeout);
  }, [query, tab]);

  const q = query.toLowerCase().trim();
  const filteredPantry: PantryItem[] = (pantry ?? []).filter(
    (p) => !q || p.name.toLowerCase().includes(q) || (p.brand ?? '').toLowerCase().includes(q),
  );
  const filteredRecipes: Recipe[] = (recipes ?? []).filter(
    (r) => !q || r.title.toLowerCase().includes(q),
  );

  const openQtyForPantry = useCallback((item: PantryItem) => {
    setQtyTarget({
      name: item.name,
      brand: item.brand,
      kcalPer100: item.per100.kcal,
      pPer100: item.per100.p,
      cPer100: item.per100.c,
      fPer100: item.per100.f,
      fromDb: false,
      pantryId: item.id,
    });
    setQty(item.servingQuantity ?? 100);
  }, []);

  const openQtyForDb = useCallback((item: OFFSearchResult) => {
    const alreadyInGrocery = (grocery ?? []).some(
      (g) => g.n.toLowerCase() === item.name.toLowerCase(),
    );
    setQtyTarget({
      name: item.name,
      brand: item.brand,
      kcalPer100: item.kcal,
      pPer100: item.p,
      cPer100: item.c,
      fPer100: item.f,
      fromDb: !alreadyInGrocery,
      dbItem: item,
    });
    setQty(100);
  }, [grocery]);

  const confirmQty = () => {
    if (!qtyTarget) return;
    const { name, brand, kcalPer100, pPer100, cPer100, fPer100, pantryId, dbItem, fromDb } = qtyTarget;
    const scale = qty / 100;
    const kcal = Math.round(kcalPer100 * scale);
    const p = Math.round(pPer100 * scale);
    const cv = Math.round(cPer100 * scale);
    const f = Math.round(fPer100 * scale);

    let entry: MealEntry;
    if (pantryId) {
      entry = { type: 'pantry', pantryId, name, grams: qty, kcal, p, c: cv, f };
    } else {
      entry = { type: 'food', name, brand, imageUrl: dbItem?.imageUrl, grams: qty, kcal, p, c: cv, f };
      if (fromDb && dbItem) {
        addGroceryItem({
          id: `gm${Date.now()}`,
          a: `${qty}g`, n: name,
          aisle: 'Pantry',
          recipe: brand || 'Food DB',
          checked: false,
        });
      }
    }
    setQtyTarget(null);
    onAdd(entry);
  };

  const kcalPreview = qtyTarget ? Math.round(qtyTarget.kcalPer100 * qty / 100) : 0;
  const pPreview   = qtyTarget ? Math.round(qtyTarget.pPer100   * qty / 100) : 0;
  const cPreview   = qtyTarget ? Math.round(qtyTarget.cPer100   * qty / 100) : 0;
  const fPreview   = qtyTarget ? Math.round(qtyTarget.fPer100   * qty / 100) : 0;

  const TABS: { key: Tab; labelKey: TKey; iconName: string; iconColor: string; iconBg: string }[] = [
    { key: 'pantry',  labelKey: 'mealplan.add.tabPantry',  iconName: 'barcode', iconColor: c.sage,   iconBg: c.sageSoft },
    { key: 'recipes', labelKey: 'mealplan.add.tabRecipes', iconName: 'document', iconColor: c.accent, iconBg: c.accentSoft },
    { key: 'db',      labelKey: 'mealplan.add.tabDb',      iconName: 'link',     iconColor: c.gold,   iconBg: c.warning },
  ];

  const topPad = insets.top + (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0);
  const botPad = Math.max(insets.bottom, 16);

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.kav, { paddingTop: topPad, paddingBottom: botPad }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>

          {/* ── Quantity step ── */}
          {qtyTarget ? (
            <QtyStep
              target={qtyTarget}
              qty={qty}
              setQty={setQty}
              slotLabel={slotLabel}
              kcal={kcalPreview}
              p={pPreview}
              cv={cPreview}
              f={fPreview}
              styles={styles}
              c={c}
              t={t}
              onBack={() => setQtyTarget(null)}
              onConfirm={confirmQty}
            />
          ) : (
            <>
              {/* Header */}
              <View style={styles.header}>
                <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
                  <Text style={styles.closeIcon}>‹</Text>
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={styles.slotChip}>{slotLabel} · {day}</Text>
                  <Text style={styles.title}>{t('mealplan.add.title' as TKey, { slot: slotLabel, day })}</Text>
                </View>
              </View>

              {/* Segmented tabs */}
              <View style={styles.seg}>
                {TABS.map(({ key, labelKey, iconName, iconColor, iconBg }) => {
                  const on = tab === key;
                  return (
                    <Pressable
                      key={key}
                      style={[styles.segBtn, on && styles.segBtnOn]}
                      onPress={() => setTab(key)}
                    >
                      <View style={[styles.segIcon, { backgroundColor: on ? iconBg : c.surfaceAlt }]}>
                        <Icon name={iconName as any} size={13} color={on ? iconColor : c.gray} />
                      </View>
                      <Text style={[styles.segText, on && styles.segTextOn]}>
                        {t(labelKey as TKey)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Search */}
              <View style={[styles.inputWrap, inputFocused && styles.inputWrapFocused]}>
                <Icon name="search" size={16} color={c.gray} />
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  placeholder={t('mealplan.add.search' as TKey)}
                  placeholderTextColor={c.gray}
                  value={query}
                  onChangeText={setQuery}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {query.length > 0 && (
                  <Pressable onPress={() => setQuery('')} hitSlop={8}>
                    <Text style={styles.clearBtn}>✕</Text>
                  </Pressable>
                )}
              </View>

              {/* List */}
              <ScrollView
                style={styles.list}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* ── Pantry ── */}
                {tab === 'pantry' && (
                  filteredPantry.length === 0 ? (
                    <Empty label={t('mealplan.add.emptyPantry' as TKey)} styles={styles} />
                  ) : <>
                    <SectionHeader label={t('mealplan.add.secPantry' as TKey)} styles={styles} />
                    {filteredPantry.map((item) => (
                      <FoodRow
                        key={item.id}
                        name={item.name}
                        sub={item.brand ?? ''}
                        meta={`${item.per100.kcal} kcal / 100g`}
                        iconName="barcode"
                        iconColor={c.sage}
                        iconBg={c.sageSoft}
                        imageUrl={item.imageUrl}
                        styles={styles}
                        c={c}
                        onPress={() => openQtyForPantry(item)}
                      />
                    ))}
                  </>
                )}

                {/* ── Recipes ── */}
                {tab === 'recipes' && (
                  filteredRecipes.length === 0 ? (
                    <Empty label={t('mealplan.add.emptyRecipes' as TKey)} styles={styles} />
                  ) : <>
                    <SectionHeader label={t('mealplan.add.secRecipes' as TKey)} styles={styles} />
                    {filteredRecipes.map((rec) => (
                      <FoodRow
                        key={rec.id}
                        name={rec.title}
                        sub={`${rec.time} min`}
                        meta={`${rec.kcal} kcal`}
                        iconName="book"
                        iconColor={c.accent}
                        iconBg={c.accentSoft}
                        imageUrl={rec.imageUrl}
                        chevron
                        styles={styles}
                        c={c}
                        onPress={() => onAdd({ type: 'recipe', recipeId: rec.id })}
                      />
                    ))}
                  </>
                )}

                {/* ── Food DB ── */}
                {tab === 'db' && (
                  <>
                    {dbStatus === 'idle' && (
                      <Empty label={t('mealplan.add.dbTypeToSearch' as TKey)} styles={styles} icon="search" />
                    )}
                    {dbStatus === 'loading' && (
                      <View style={styles.center}>
                        <ActivityIndicator color={c.accent} size="small" />
                        <Text style={styles.emptyText}>{t('mealplan.add.dbLoading' as TKey)}</Text>
                      </View>
                    )}
                    {dbStatus === 'done' && dbResults.length === 0 && (
                      <Empty label={t('mealplan.add.dbEmpty' as TKey)} styles={styles} />
                    )}
                    {dbStatus === 'done' && dbResults.length > 0 && (
                      <>
                        <SectionHeader label={t('mealplan.add.secDb' as TKey)} styles={styles} />
                        {dbResults.map((item) => (
                          <FoodRow
                            key={item.code}
                            name={item.name}
                            sub={item.brand}
                            meta={`${item.kcal} kcal / 100g`}
                            iconName="globe"
                            iconColor={c.gold}
                            iconBg={c.warning}
                            imageUrl={item.imageUrl}
                            styles={styles}
                            c={c}
                            onPress={() => openQtyForDb(item)}
                          />
                        ))}
                      </>
                    )}
                  </>
                )}

                <View style={{ height: 32 }} />
              </ScrollView>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ─── QtyStep ────────────────────────────────────────────────── */

function QtyStep({ target, qty, setQty, slotLabel, kcal, p, cv, f, styles, c, t, onBack, onConfirm }: {
  target: QtyTarget; qty: number; setQty: (v: number) => void;
  slotLabel: string; kcal: number; p: number; cv: number; f: number;
  styles: any; c: ThemeColors;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
  onBack: () => void; onConfirm: () => void;
}) {
  return (
    <>
      {/* Back header */}
      <View style={styles.qtyHeader}>
        <Pressable style={styles.backBtn} onPress={onBack} hitSlop={8}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.qtyName} numberOfLines={1}>{target.name}</Text>
          {target.brand ? <Text style={styles.qtyBrand}>{target.brand}</Text> : null}
        </View>
      </View>

      {/* Section label */}
      <Text style={styles.qtySectionLabel}>{t('mealplan.qty.title' as TKey)}</Text>

      {/* Stepper */}
      <View style={styles.stepperRow}>
        <Pressable
          style={styles.stepBtn}
          onPress={() => setQty(Math.max(10, qty - 10))}
          hitSlop={6}
        >
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <View style={styles.stepValWrap}>
          <TextInput
            style={styles.stepVal}
            keyboardType="number-pad"
            value={String(qty)}
            onChangeText={(v) => setQty(Math.max(1, parseInt(v, 10) || 1))}
            selectTextOnFocus
          />
          <Text style={styles.stepUnit}>g</Text>
        </View>
        <Pressable
          style={styles.stepBtn}
          onPress={() => setQty(qty + 10)}
          hitSlop={6}
        >
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>

      {/* Quick amounts */}
      <View style={styles.quickRow}>
        {[50, 100, 150, 200].map((v) => (
          <Pressable
            key={v}
            style={[styles.quickBtn, qty === v && styles.quickBtnOn]}
            onPress={() => setQty(v)}
          >
            <Text style={[styles.quickText, qty === v && styles.quickTextOn]}>{v}g</Text>
          </Pressable>
        ))}
      </View>

      {/* Macro preview */}
      <View style={styles.macroRow}>
        <MacroChip label="kcal" value={kcal} styles={styles} accent />
        <MacroChip label="P" value={p} styles={styles} />
        <MacroChip label="C" value={cv} styles={styles} />
        <MacroChip label="F" value={f} styles={styles} />
      </View>

      {/* Auto-grocery note */}
      {target.fromDb && (
        <View style={styles.autoNote}>
          <Icon name="cart" size={14} color={c.warningText} />
          <Text style={styles.autoNoteText}>{t('mealplan.qty.autoGrocery' as TKey)}</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.qtyActions}>
        <Pressable style={styles.cancelBtn} onPress={onBack}>
          <Text style={styles.cancelText}>{t('common.cancel' as TKey)}</Text>
        </Pressable>
        <Pressable style={styles.confirmBtn} onPress={onConfirm}>
          <Text style={styles.confirmText}>{t('mealplan.qty.confirm' as TKey, { slot: slotLabel })}</Text>
        </Pressable>
      </View>
    </>
  );
}

function MacroChip({ label, value, styles, accent }: { label: string; value: number; styles: any; accent?: boolean }) {
  return (
    <View style={[styles.macroChip, accent && styles.macroChipAccent]}>
      <Text style={[styles.macroVal, accent && styles.macroValAccent]}>{value}</Text>
      <Text style={[styles.macroLabel, accent && styles.macroLabelAccent]}>{label}</Text>
    </View>
  );
}

/* ─── List parts ─────────────────────────────────────────────── */

function SectionHeader({ label, styles }: { label: string; styles: any }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

function FoodRow({
  name, sub, meta, iconName, iconColor, iconBg, imageUrl, chevron = false, styles, c, onPress,
}: {
  name: string; sub?: string; meta: string;
  iconName: string; iconColor: string; iconBg: string;
  imageUrl?: string; chevron?: boolean; styles: any; c: ThemeColors; onPress: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={[styles.rowIcon, { borderRadius: 12 }]} resizeMode="cover" />
      ) : (
        <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
          <Icon name={iconName as any} size={18} color={iconColor} />
        </View>
      )}
      <View style={styles.rowInfo}>
        <Text style={styles.rowName} numberOfLines={1}>{name}</Text>
        {sub ? <Text style={styles.rowSub} numberOfLines={1}>{sub}</Text> : null}
      </View>
      <Text style={styles.rowMeta}>{meta}</Text>
      {chevron ? (
        <Text style={styles.chevron}>›</Text>
      ) : (
        <View style={styles.addBtn}>
          <Text style={styles.addBtnText}>+</Text>
        </View>
      )}
    </Pressable>
  );
}

function Empty({ label, styles, icon }: { label: string; styles: any; icon?: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyText}>{label}</Text>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    kav: { flex: 1, backgroundColor: c.bg, paddingHorizontal: 20 },
    sheet: { flex: 1 },

    // ── List header ──
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18, paddingTop: 8 },
    slotChip: { fontSize: 11, fontWeight: '700', color: c.accent, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
    title: { fontFamily: fonts.display, fontSize: 22, color: c.ink },
    closeBtn: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    closeIcon: { fontSize: 26, color: c.ink, marginTop: -2, marginLeft: -2 },

    // ── Segmented control ──
    seg: {
      flexDirection: 'row', backgroundColor: c.surface,
      borderRadius: 16, padding: 4, gap: 4, marginBottom: 14,
      borderWidth: 1, borderColor: c.border,
    },
    segBtn: {
      flex: 1, borderRadius: 12, paddingVertical: 9,
      alignItems: 'center', gap: 5, flexDirection: 'row',
      justifyContent: 'center',
    },
    segBtnOn: { backgroundColor: c.bg, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
    segIcon: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    segText: { fontSize: 11, fontWeight: '700', color: c.grayMid },
    segTextOn: { color: c.ink },

    // ── Search ──
    inputWrap: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: c.surface, borderRadius: 14,
      paddingHorizontal: 14, borderWidth: 1.5, borderColor: c.border, marginBottom: 14,
    },
    inputWrapFocused: { borderColor: c.accent },
    input: { flex: 1, fontSize: 14.5, fontWeight: '500', color: c.ink, paddingVertical: 12 },
    clearBtn: { color: c.grayMid, fontSize: 14, paddingHorizontal: 2 },

    // ── List ──
    list: { flex: 1 },
    sectionLabel: {
      fontSize: 11, fontWeight: '700', color: c.grayMid,
      textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 2,
    },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      borderRadius: 16, padding: 12, marginBottom: 8,
    },
    rowIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
    rowInfo: { flex: 1, minWidth: 0 },
    rowName: { fontSize: 14, fontWeight: '700', color: c.ink },
    rowSub: { fontSize: 11.5, fontWeight: '500', color: c.grayMid, marginTop: 1 },
    rowMeta: { fontSize: 12, fontWeight: '600', color: c.grayLight, flexShrink: 0 },
    chevron: { color: c.grayMid, fontSize: 22, marginLeft: 2 },
    addBtn: {
      width: 30, height: 30, borderRadius: 15,
      backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    addBtnText: { color: '#fff', fontSize: 20, fontWeight: '700', lineHeight: 24, marginTop: -1 },

    center: { paddingVertical: 40, alignItems: 'center', gap: 8 },
    emptyText: { fontSize: 13.5, fontWeight: '500', color: c.grayMid, textAlign: 'center', paddingHorizontal: 24 },

    // ── QtyStep ──
    qtyHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20, paddingTop: 8 },
    backBtn: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    backIcon: { fontSize: 26, color: c.ink, marginTop: -2, marginLeft: -2 },
    qtyName: { fontFamily: fonts.display, fontSize: 17, color: c.ink },
    qtyBrand: { fontSize: 12, fontWeight: '500', color: c.grayMid, marginTop: 1 },
    qtySectionLabel: {
      fontSize: 11, fontWeight: '700', color: c.grayMid,
      textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16,
    },

    stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
    stepBtn: {
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.border,
      alignItems: 'center', justifyContent: 'center',
    },
    stepBtnText: { fontSize: 24, fontWeight: '300', color: c.ink, lineHeight: 30 },
    stepValWrap: {
      flex: 1, flexDirection: 'row', alignItems: 'baseline',
      justifyContent: 'center', gap: 4,
      backgroundColor: c.surface, borderRadius: 16,
      borderWidth: 1.5, borderColor: c.border, paddingVertical: 10,
    },
    stepVal: {
      fontFamily: fonts.display, fontSize: 34, fontWeight: '700', color: c.ink,
      textAlign: 'center', minWidth: 70,
    },
    stepUnit: { fontSize: 16, fontWeight: '600', color: c.grayMid },

    quickRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
    quickBtn: {
      flex: 1, paddingVertical: 8, borderRadius: 10,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center',
    },
    quickBtnOn: { backgroundColor: c.accentSoft, borderColor: c.accent },
    quickText: { fontSize: 12.5, fontWeight: '700', color: c.grayMid },
    quickTextOn: { color: c.accent },

    macroRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    macroChip: {
      flex: 1, alignItems: 'center', paddingVertical: 10,
      backgroundColor: c.surface, borderRadius: 12,
      borderWidth: 1, borderColor: c.border,
    },
    macroChipAccent: { backgroundColor: c.accentSoft, borderColor: c.accent },
    macroVal: { fontFamily: fonts.display, fontSize: 18, fontWeight: '700', color: c.ink },
    macroValAccent: { color: c.accent },
    macroLabel: { fontSize: 10, fontWeight: '700', color: c.grayMid, marginTop: 1 },
    macroLabelAccent: { color: c.accent },

    autoNote: {
      flexDirection: 'row', gap: 8, alignItems: 'flex-start',
      backgroundColor: c.warning, borderRadius: 12, padding: 11,
      borderWidth: 1, borderColor: c.border, marginBottom: 16,
    },
    autoNoteText: { flex: 1, fontSize: 12.5, color: c.warningText, lineHeight: 18, fontWeight: '500' },

    qtyActions: { flexDirection: 'row', gap: 10 },
    cancelBtn: {
      flex: 1, paddingVertical: 15, borderRadius: 14,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center',
    },
    cancelText: { fontSize: 14, fontWeight: '700', color: c.grayMid },
    confirmBtn: {
      flex: 2, paddingVertical: 15, borderRadius: 14,
      backgroundColor: c.accent, alignItems: 'center',
    },
    confirmText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  });
