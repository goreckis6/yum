import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
import { Icon } from './Icon';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { DAYS } from '../data/seed';
import { DayKey, GroceryItem, MealSlot, PantryItem, Recipe } from '../types';
import { OFFSearchResult, searchProducts } from '../api/openfoodfacts';
import type { TKey } from '../i18n/translations';

type Tab = 'pantry' | 'recipes' | 'db';

const SLOT_LABEL: Record<MealSlot, TKey> = {
  Breakfast: 'slot.Breakfast',
  Lunch: 'slot.Lunch',
  Dinner: 'slot.Dinner',
};

interface QuantityTarget {
  name: string;
  brand?: string;
  kcalPer100: number;
  pPer100: number;
  fromDb: boolean;
  onConfirm: (grams: number) => void;
}

interface Props {
  visible: boolean;
  slot: MealSlot;
  day: DayKey;
  onClose: () => void;
  onRecipeAdd: (recipeId: string) => void;
}

export function MealAddSheet({ visible, slot, day, onClose, onRecipeAdd }: Props) {
  const c = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { pantry, recipes, grocery, addGroceryItem, showToast } = useApp();

  const [tab, setTab] = useState<Tab>('pantry');
  const [query, setQuery] = useState('');
  const [dbResults, setDbResults] = useState<OFFSearchResult[]>([]);
  const [dbStatus, setDbStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [qtyTarget, setQtyTarget] = useState<QuantityTarget | null>(null);
  const [qty, setQty] = useState(100);
  const abortRef = useRef<AbortController | null>(null);

  const dayLabel = DAYS.find((d) => d.day === day)?.date ?? day;
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

  // Debounced DB search
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
      setDbStatus(results.length ? 'done' : 'done');
    }, 500);
    return () => clearTimeout(timeout);
  }, [query, tab]);

  // Filtered pantry + recipes
  const q = query.toLowerCase().trim();
  const pantryItems: PantryItem[] = (pantry ?? []).filter(
    (p) => !q || p.name.toLowerCase().includes(q) || (p.brand ?? '').toLowerCase().includes(q),
  );
  const recipeItems: Recipe[] = (recipes ?? []).filter(
    (r) => !q || r.title.toLowerCase().includes(q),
  );

  const handleAddPantry = useCallback((item: PantryItem) => {
    setQtyTarget({
      name: item.name,
      brand: item.brand,
      kcalPer100: item.per100.kcal,
      pPer100: item.per100.p,
      fromDb: false,
      onConfirm: (grams) => {
        showToast(`${item.name} added to ${slotLabel}`);
        onClose();
      },
    });
    setQty(100);
  }, [slotLabel, onClose, showToast]);

  const handleAddDb = useCallback((item: OFFSearchResult) => {
    const alreadyInGrocery = (grocery ?? []).some(
      (g) => g.n.toLowerCase() === item.name.toLowerCase(),
    );
    setQtyTarget({
      name: item.name,
      brand: item.brand,
      kcalPer100: item.kcal,
      pPer100: item.p,
      fromDb: !alreadyInGrocery,
      onConfirm: (grams) => {
        if (!alreadyInGrocery) {
          const groceryItem: GroceryItem = {
            id: `gm${Date.now()}`,
            a: `${grams}g`,
            n: item.name,
            aisle: 'Pantry',
            recipe: item.brand || 'Food DB',
            checked: false,
          };
          addGroceryItem(groceryItem);
        }
        showToast(`${item.name} added to ${slotLabel}`);
        onClose();
      },
    });
    setQty(100);
  }, [grocery, slotLabel, onClose, addGroceryItem, showToast]);

  const confirmQty = () => {
    qtyTarget?.onConfirm(qty);
    setQtyTarget(null);
  };

  const kcalPreview = qtyTarget ? Math.round(qtyTarget.kcalPer100 * qty / 100) : 0;
  const pPreview = qtyTarget ? Math.round(qtyTarget.pPer100 * qty / 100) : 0;

  const TABS: { key: Tab; label: TKey; icon: string }[] = [
    { key: 'pantry', label: 'mealplan.add.tabPantry', icon: 'fridge' },
    { key: 'recipes', label: 'mealplan.add.tabRecipes', icon: 'book' },
    { key: 'db', label: 'mealplan.add.tabDb', icon: 'globe' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.title}>
            {t('mealplan.add.title' as TKey, { slot: slotLabel, day: `${day} ${dayLabel}` })}
          </Text>

          {/* Segmented tabs */}
          <View style={styles.seg}>
            {TABS.map(({ key, label, icon }) => (
              <Pressable
                key={key}
                style={[styles.segBtn, tab === key && styles.segBtnOn]}
                onPress={() => setTab(key)}
              >
                <Icon name={icon as any} size={14} color={tab === key ? c.accent : c.grayMid} />
                <Text style={[styles.segText, tab === key && styles.segTextOn]}>
                  {t(label as TKey)}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Search input */}
          <View style={styles.searchRow}>
            <Icon name="search" size={15} color={c.gray} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('mealplan.add.search' as TKey)}
              placeholderTextColor={c.gray}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Text style={{ color: c.gray, fontSize: 14 }}>✕</Text>
              </Pressable>
            )}
          </View>

          {/* Quantity prompt overlay */}
          {qtyTarget ? (
            <View style={styles.qtyCard}>
              <Text style={styles.qtyName}>{qtyTarget.name}</Text>
              {qtyTarget.brand ? <Text style={styles.qtyBrand}>{qtyTarget.brand}</Text> : null}
              <Text style={styles.qtyTitle}>{t('mealplan.qty.title' as TKey)}</Text>
              <View style={styles.qtyRow}>
                <Pressable style={styles.qtyBtn} onPress={() => setQty((v) => Math.max(10, v - 10))} hitSlop={8}>
                  <Text style={styles.qtyBtnText}>−</Text>
                </Pressable>
                <View style={styles.qtyValWrap}>
                  <TextInput
                    style={styles.qtyValInput}
                    keyboardType="number-pad"
                    value={String(qty)}
                    onChangeText={(v) => setQty(Math.max(1, parseInt(v, 10) || 1))}
                    selectTextOnFocus
                  />
                  <Text style={styles.qtyUnit}>g</Text>
                </View>
                <Pressable style={styles.qtyBtn} onPress={() => setQty((v) => v + 10)} hitSlop={8}>
                  <Text style={styles.qtyBtnText}>+</Text>
                </Pressable>
              </View>
              <Text style={styles.qtyPreview}>
                {t('mealplan.qty.kcalPreview' as TKey, { kcal: kcalPreview, p: pPreview })}
              </Text>
              {qtyTarget.fromDb && (
                <View style={styles.autoNote}>
                  <Icon name="cart" size={13} color="#92400e" />
                  <Text style={styles.autoNoteText}>
                    {t('mealplan.qty.autoGrocery' as TKey)}
                  </Text>
                </View>
              )}
              <View style={styles.qtyActions}>
                <Pressable style={styles.qtyCancelBtn} onPress={() => setQtyTarget(null)}>
                  <Text style={styles.qtyCancelText}>{t('common.cancel' as TKey)}</Text>
                </Pressable>
                <Pressable style={styles.qtyConfirmBtn} onPress={confirmQty}>
                  <Text style={styles.qtyConfirmText}>
                    {t('mealplan.qty.confirm' as TKey, { slot: slotLabel })}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <ScrollView
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* ── Pantry tab ── */}
              {tab === 'pantry' && (
                <>
                  {pantryItems.length === 0 ? (
                    <EmptyState label={t('mealplan.add.emptyPantry' as TKey)} styles={styles} />
                  ) : (
                    <>
                      <SectionLabel label={t('mealplan.add.secPantry' as TKey)} dot="#ef4444" styles={styles} />
                      {pantryItems.map((item) => (
                        <ItemRow
                          key={item.id}
                          name={item.name}
                          sub={`${item.per100.kcal} kcal / 100g${item.brand ? ` · ${item.brand}` : ''}`}
                          emoji="🏠"
                          tint="#f0fdf4"
                          styles={styles}
                          c={c}
                          onAdd={() => handleAddPantry(item)}
                        />
                      ))}
                    </>
                  )}
                </>
              )}

              {/* ── Recipes tab ── */}
              {tab === 'recipes' && (
                <>
                  {recipeItems.length === 0 ? (
                    <EmptyState label={t('mealplan.add.emptyRecipes' as TKey)} styles={styles} />
                  ) : (
                    <>
                      <SectionLabel label={t('mealplan.add.secRecipes' as TKey)} dot="#22c55e" styles={styles} />
                      {recipeItems.map((rec) => (
                        <ItemRow
                          key={rec.id}
                          name={rec.title}
                          sub={`${rec.kcal} kcal · ${rec.time} min`}
                          emoji="📖"
                          tint="#fef9c3"
                          styles={styles}
                          c={c}
                          onAdd={() => { onRecipeAdd(rec.id); onClose(); }}
                        />
                      ))}
                    </>
                  )}
                </>
              )}

              {/* ── Food DB tab ── */}
              {tab === 'db' && (
                <>
                  {dbStatus === 'idle' && (
                    <EmptyState label={t('mealplan.add.dbTypeToSearch' as TKey)} styles={styles} />
                  )}
                  {dbStatus === 'loading' && (
                    <View style={styles.center}>
                      <ActivityIndicator color={c.accent} />
                      <Text style={styles.loadingText}>{t('mealplan.add.dbLoading' as TKey)}</Text>
                    </View>
                  )}
                  {dbStatus === 'done' && dbResults.length === 0 && (
                    <EmptyState label={t('mealplan.add.dbEmpty' as TKey)} styles={styles} />
                  )}
                  {dbStatus === 'done' && dbResults.length > 0 && (
                    <>
                      <SectionLabel label={t('mealplan.add.secDb' as TKey)} dot="#3b82f6" styles={styles} />
                      {dbResults.map((item) => (
                        <ItemRow
                          key={item.code}
                          name={item.name}
                          sub={`${item.kcal} kcal / 100g${item.brand ? ` · ${item.brand}` : ''}`}
                          emoji="🌐"
                          tint="#eff6ff"
                          styles={styles}
                          c={c}
                          onAdd={() => handleAddDb(item)}
                        />
                      ))}
                    </>
                  )}
                </>
              )}
              <View style={{ height: 20 }} />
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ─── Sub-components ─────────────────────────────────────────── */

function SectionLabel({ label, dot, styles }: { label: string; dot: string; styles: any }) {
  return (
    <View style={styles.secRow}>
      <View style={[styles.secDot, { backgroundColor: dot }]} />
      <Text style={styles.secLabel}>{label}</Text>
    </View>
  );
}

function ItemRow({
  name, sub, emoji, tint, styles, c, onAdd,
}: { name: string; sub: string; emoji: string; tint: string; styles: any; c: ThemeColors; onAdd: () => void }) {
  return (
    <Pressable style={styles.item} onPress={onAdd}>
      <View style={[styles.itemIcon, { backgroundColor: tint }]}>
        <Text style={{ fontSize: 18 }}>{emoji}</Text>
      </View>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>{name}</Text>
        <Text style={styles.itemSub} numberOfLines={1}>{sub}</Text>
      </View>
      <View style={styles.addBtn}>
        <Text style={styles.addBtnText}>+</Text>
      </View>
    </Pressable>
  );
}

function EmptyState({ label, styles }: { label: string; styles: any }) {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyText}>{label}</Text>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    kav: { flex: 1, justifyContent: 'flex-end', backgroundColor: c.scrim },
    sheet: {
      backgroundColor: c.bg,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: 28,
      maxHeight: '88%',
    },
    handle: {
      width: 38, height: 4, borderRadius: 2,
      backgroundColor: c.border, alignSelf: 'center', marginBottom: 16,
    },
    title: {
      fontFamily: fonts.display, fontSize: 18, color: c.ink, marginBottom: 14,
    },

    // Segmented control
    seg: {
      flexDirection: 'row', backgroundColor: c.surface,
      borderRadius: 14, padding: 3, gap: 3, marginBottom: 12,
    },
    segBtn: {
      flex: 1, borderRadius: 11, paddingVertical: 8,
      alignItems: 'center', gap: 3,
    },
    segBtnOn: { backgroundColor: c.bg, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
    segText: { fontSize: 10.5, fontWeight: '700', color: c.grayMid },
    segTextOn: { color: c.accent },

    // Search
    searchRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: c.surface, borderRadius: 12,
      paddingHorizontal: 12, borderWidth: 1, borderColor: c.border, marginBottom: 12,
    },
    searchInput: { flex: 1, fontSize: 14, color: c.ink, paddingVertical: 11 },

    // List
    list: { flex: 1 },
    secRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, marginTop: 4 },
    secDot: { width: 7, height: 7, borderRadius: 4 },
    secLabel: { fontSize: 11, fontWeight: '700', color: c.grayMid, textTransform: 'uppercase', letterSpacing: 0.4 },

    item: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    },
    itemIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    itemInfo: { flex: 1, minWidth: 0 },
    itemName: { fontSize: 13.5, fontWeight: '600', color: c.ink },
    itemSub: { fontSize: 11.5, color: c.grayMid, marginTop: 1 },
    addBtn: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    addBtnText: { color: '#fff', fontSize: 18, fontWeight: '700', lineHeight: 22 },

    center: { paddingVertical: 32, alignItems: 'center', gap: 8 },
    emptyText: { fontSize: 13, fontWeight: '500', color: c.grayMid, textAlign: 'center' },
    loadingText: { fontSize: 13, fontWeight: '500', color: c.grayMid },

    // Quantity card
    qtyCard: {
      backgroundColor: c.surface, borderRadius: 18,
      padding: 16, borderWidth: 1, borderColor: c.border,
    },
    qtyName: { fontFamily: fonts.display, fontSize: 16, color: c.ink },
    qtyBrand: { fontSize: 12, color: c.grayMid, marginTop: 1, marginBottom: 6 },
    qtyTitle: { fontSize: 13, fontWeight: '700', color: c.grayMid, marginTop: 6, marginBottom: 12 },
    qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
    qtyBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: c.bg, borderWidth: 1, borderColor: c.border,
      alignItems: 'center', justifyContent: 'center',
    },
    qtyBtnText: { fontSize: 20, fontWeight: '600', color: c.ink, lineHeight: 24 },
    qtyValWrap: { flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 4 },
    qtyValInput: {
      fontFamily: fonts.display, fontSize: 28, fontWeight: '700', color: c.ink,
      textAlign: 'center', minWidth: 60,
    },
    qtyUnit: { fontSize: 14, fontWeight: '600', color: c.grayMid },
    qtyPreview: { fontSize: 12, fontWeight: '500', color: c.grayMid, textAlign: 'center', marginBottom: 10 },
    autoNote: {
      flexDirection: 'row', gap: 7, alignItems: 'flex-start',
      backgroundColor: '#fffbeb', borderRadius: 10, padding: 10,
      borderWidth: 1, borderColor: '#fde68a', marginBottom: 12,
    },
    autoNoteText: { flex: 1, fontSize: 12, color: '#92400e', lineHeight: 17 },
    qtyActions: { flexDirection: 'row', gap: 10 },
    qtyCancelBtn: {
      flex: 1, paddingVertical: 13, borderRadius: 13,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center',
    },
    qtyCancelText: { fontSize: 14, fontWeight: '700', color: c.grayMid },
    qtyConfirmBtn: {
      flex: 2, paddingVertical: 13, borderRadius: 13,
      backgroundColor: c.accent, alignItems: 'center',
    },
    qtyConfirmText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  });
