import React, { useRef, useMemo, useState, useEffect } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AISLE_DOT, AISLE_ORDER } from '../data/seed';
import { useApp } from '../context/AppContext';
import { useTabNav } from '../navigation/TabContext';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { Aisle, GroceryItem } from '../types';
import { RootStackParamList } from '../navigation/types';
import { IngredientIcon } from '../components/IngredientIcon';
import { useI18n } from '../i18n/I18nContext';
import type { TKey } from '../i18n/translations';
import { parseAmt, formatValue } from '../utils/amounts';

type GroupBy = 'aisle' | 'recipe';

const AISLE_ICON: Record<Aisle, string> = {
  Produce: '🥬',
  'Meat & Seafood': '🥩',
  'Dairy & Eggs': '🥛',
  Bakery: '🍞',
  Pantry: '🫙',
  Frozen: '🧊',
};

const SWIPE_THRESHOLD = 72;

// Sort order for the Calculate view: meat first, pantry/spices last
const CALC_AISLE_ORDER: Aisle[] = [
  'Meat & Seafood',
  'Produce',
  'Dairy & Eggs',
  'Bakery',
  'Frozen',
  'Pantry',
];

interface Consolidated {
  name: string;
  aisle: Aisle;
  total: string;
  recipes: string[];
  merged: boolean;
}

function consolidate(items: GroceryItem[]): Consolidated[] {
  const normName = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');

  type Entry = { name: string; aisle: Aisle; byUnit: Map<string, number>; noValueAmts: string[]; recipes: string[] };
  const map = new Map<string, Entry>();

  items.forEach((item) => {
    const key = normName(item.n);
    const { value, unit } = parseAmt(item.a);

    if (!map.has(key)) {
      map.set(key, { name: item.n, aisle: item.aisle, byUnit: new Map(), noValueAmts: [], recipes: [] });
    }
    const entry = map.get(key)!;

    if (value > 0) {
      entry.byUnit.set(unit, (entry.byUnit.get(unit) ?? 0) + value);
    } else if (item.a?.trim()) {
      if (!entry.noValueAmts.includes(item.a.trim())) {
        entry.noValueAmts.push(item.a.trim());
      }
    }

    if (!entry.recipes.includes(item.recipe)) entry.recipes.push(item.recipe);
  });

  const result = Array.from(map.values()).map((e) => {
    const parts: string[] = [];
    e.byUnit.forEach((val, unit) => {
      parts.push(formatValue(val) + (unit ? ' ' + unit : ''));
    });
    parts.push(...e.noValueAmts);
    return {
      name: e.name,
      aisle: e.aisle,
      total: parts.filter(Boolean).join(' + ') || '—',
      recipes: e.recipes,
      merged: e.recipes.length > 1,
    };
  });

  result.sort((a, b) => {
    const ai = CALC_AISLE_ORDER.indexOf(a.aisle);
    const bi = CALC_AISLE_ORDER.indexOf(b.aisle);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return result;
}

// ─── SwipeableRow ─────────────────────────────────────────────────────────────

function SwipeableRow({
  onToggle, onRemove, children, styles, deleteLabel,
}: {
  onToggle: () => void;
  onRemove: () => void;
  children: React.ReactNode;
  styles: ReturnType<typeof makeStyles>;
  deleteLabel: string;
}) {
  const translateX = useRef(new Animated.Value(0)).current;

  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderMove: (_, g) => { if (g.dx < 0) translateX.setValue(g.dx); },
    onPanResponderRelease: (_, g) => {
      if (g.dx < -SWIPE_THRESHOLD) {
        Animated.spring(translateX, { toValue: -72, useNativeDriver: true }).start();
      } else {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    },
  })).current;

  const handleRemove = () => {
    Animated.timing(translateX, { toValue: -400, duration: 200, useNativeDriver: true }).start(onRemove);
  };

  return (
    <View style={styles.swipeWrap}>
      <View style={styles.deleteBg}>
        <Pressable style={styles.deleteBtn} onPress={handleRemove}>
          <Text style={styles.deleteText}>{deleteLabel}</Text>
        </Pressable>
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...pan.panHandlers}>
        <Pressable style={styles.row} onPress={onToggle}>
          {children}
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── GroceryScreen ────────────────────────────────────────────────────────────

export function GroceryScreen() {
  const c = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { setTab } = useTabNav();
  const { grocery, pantry, toggleGrocery, toggleAllGrocery, removeGrocery, clearCheckedGrocery, addPantryToGrocery, showToast } = useApp();
  const [groupBy, setGroupBy] = useState<GroupBy>('recipe');
  const [pantryExpanded, setPantryExpanded] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const insets = useSafeAreaInsets();

  const scrollRef = useRef<ScrollView>(null);
  const calcRef = useRef<View>(null);
  const arrowAnim = useRef(new Animated.Value(0)).current;

  // bouncing arrow animation
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(arrowAnim, { toValue: 7, duration: 500, useNativeDriver: true }),
        Animated.timing(arrowAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const handleCalculate = () => {
    setCalcOpen(true);
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 80);
  };

  const aisleLabel = (name: string) =>
    (['Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Bakery', 'Pantry', 'Frozen'] as const).includes(name as never)
      ? t(`aisle.${name}` as TKey)
      : name;

  const active = grocery.filter((g) => !g.checked);
  const completed = grocery.filter((g) => g.checked);
  const allChecked = grocery.length > 0 && grocery.every((g) => g.checked);

  const allPantryItems = pantry ?? [];
  const PANTRY_PREVIEW = 6;
  const pantryItems = pantryExpanded ? allPantryItems : allPantryItems.slice(0, PANTRY_PREVIEW);
  const hasMore = allPantryItems.length > PANTRY_PREVIEW;

  const consolidated = useMemo(() => consolidate(active), [active]);

  const groups = useMemo(() => {
    if (groupBy === 'aisle') {
      const byAisle: Record<string, GroceryItem[]> = {};
      active.forEach((g) => {
        if (!byAisle[g.aisle]) byAisle[g.aisle] = [];
        byAisle[g.aisle].push(g);
      });
      const ordered = AISLE_ORDER.filter((a) => byAisle[a]);
      const extra = Object.keys(byAisle).filter((a) => !AISLE_ORDER.includes(a as typeof AISLE_ORDER[number]));
      return [...ordered, ...extra].map((name) => ({ name, dot: AISLE_DOT[name] || c.accent, items: byAisle[name] }));
    }
    const byRecipe: Record<string, GroceryItem[]> = {};
    active.forEach((g) => {
      if (!byRecipe[g.recipe]) byRecipe[g.recipe] = [];
      byRecipe[g.recipe].push(g);
    });
    return Object.keys(byRecipe).map((name) => ({ name, dot: c.accent, items: byRecipe[name] }));
  }, [active, groupBy]);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}
    >

      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>{t('grocery.title')}</Text>
          <Text style={styles.sub}>
            {active.length === 0
              ? t('grocery.empty')
              : t('grocery.itemsToPickup', { n: active.length })}
          </Text>
        </View>
        {/* Toggle pill */}
        <View style={styles.toggle}>
          <Pressable
            style={[styles.toggleBtn, groupBy === 'recipe' && styles.toggleOn]}
            onPress={() => setGroupBy('recipe')}
          >
            <Text style={[styles.toggleText, groupBy === 'recipe' && styles.toggleTextOn]}>
              {t('grocery.byRecipe')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, groupBy === 'aisle' && styles.toggleOn]}
            onPress={() => setGroupBy('aisle')}
          >
            <Text style={[styles.toggleText, groupBy === 'aisle' && styles.toggleTextOn]}>
              {t('grocery.byAisle')}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Pantry quick-add — horizontal scroll */}
      {allPantryItems.length > 0 && (
        <View style={styles.pantryWrap}>
          <Text style={styles.sectionLabel}>{t('grocery.fromPantry' as TKey)}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pantryScroll}>
            {pantryItems.map((p) => {
              const entry = grocery.find((g) => g.n.toLowerCase() === p.name.toLowerCase());
              const onList = !!entry;
              return (
                <Pressable
                  key={p.id}
                  style={[styles.pantryChip, onList && styles.pantryChipOn]}
                  onPress={() => { if (onList && entry) removeGrocery(entry.id); else addPantryToGrocery(p.id); }}
                >
                  {p.imageUrl
                    ? <Image source={{ uri: p.imageUrl }} style={styles.pantryImg} resizeMode="cover" />
                    : <View style={styles.pantryImgEmpty}><Text style={{ fontSize: 11 }}>🫙</Text></View>}
                  <Text style={[styles.pantryChipText, onList && styles.pantryChipTextOn]} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={[styles.pantryBadge, onList && styles.pantryBadgeOn]}>
                    {onList ? '✓' : '+'}
                  </Text>
                </Pressable>
              );
            })}
            {hasMore && (
              <Pressable style={styles.pantryMore} onPress={() => setPantryExpanded((v) => !v)}>
                <Text style={styles.pantryMoreText}>
                  {pantryExpanded ? '‹ Mniej' : `+${allPantryItems.length - PANTRY_PREVIEW}`}
                </Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      )}

      {grocery.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🛒</Text>
          <Text style={styles.emptyTitle}>{t('grocery.empty')}</Text>
          <Text style={styles.emptySub}>{t('grocery.emptySub')}</Text>
          <Pressable style={styles.browseBtn} onPress={() => setTab('recipes')}>
            <Text style={styles.browseText}>{t('grocery.browse')}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* Select all */}
          <Pressable style={styles.selectRow} onPress={() => toggleAllGrocery(!allChecked)}>
            <View style={[styles.cb, allChecked && styles.cbOn]}>
              {allChecked && <Text style={styles.cbCheck}>✓</Text>}
            </View>
            <Text style={styles.selectText}>
              {allChecked ? t('grocery.deselectAll') : t('grocery.selectAll')}
            </Text>
            {completed.length > 0 && (
              <Pressable onPress={clearCheckedGrocery} hitSlop={10}>
                <Text style={styles.clearAll}>{t('grocery.clear')}</Text>
              </Pressable>
            )}
          </Pressable>

          {/* Groups */}
          {groups.map((group) => (
            <View key={group.name} style={styles.group}>
              <View style={styles.groupHeader}>
                {groupBy === 'aisle' && AISLE_ICON[group.name as Aisle]
                  ? <Text style={styles.groupEmoji}>{AISLE_ICON[group.name as Aisle]}</Text>
                  : <View style={[styles.groupDot, { backgroundColor: group.dot }]} />}
                <Text style={styles.groupName}>
                  {groupBy === 'aisle' ? aisleLabel(group.name) : group.name}
                </Text>
                <Text style={styles.groupCount}>{group.items.length}</Text>
              </View>

              <View style={styles.card}>
                {group.items.map((item, idx) => (
                  <SwipeableRow
                    key={item.id}
                    onToggle={() => toggleGrocery(item.id)}
                    onRemove={() => removeGrocery(item.id)}
                    styles={styles}
                    deleteLabel={t('grocery.swipeDelete' as TKey)}
                  >
                    <View style={[styles.cb, styles.cbInRow]}>
                      {/* unchecked — empty */}
                    </View>
                    <IngredientIcon name={item.n} aisle={item.aisle} size={28} />
                    <View style={styles.rowBody}>
                      <Text style={styles.rowName} numberOfLines={1}>{item.n}</Text>
                      <Text style={styles.rowSub} numberOfLines={1}>
                        {groupBy === 'aisle' ? item.recipe : aisleLabel(item.aisle)}
                      </Text>
                    </View>
                    <Text style={styles.rowAmt} numberOfLines={1}>{item.a}</Text>
                    {idx < group.items.length - 1 && <View style={styles.sep} />}
                  </SwipeableRow>
                ))}
              </View>
            </View>
          ))}

          {/* ── Calculate button ── */}
          {active.length > 0 && (
            <View style={styles.calcBtnWrap}>
              <Text style={styles.calcBtnHint}>{t('grocery.calcHint' as TKey)}</Text>
              <Pressable style={styles.calcBtn} onPress={handleCalculate}>
                <View style={styles.calcBtnInner}>
                  <Text style={styles.calcLabel}>🧮  Calculate</Text>
                  <Animated.Text style={[styles.calcArrow, { transform: [{ translateY: arrowAnim }] }]}>
                    ↓
                  </Animated.Text>
                </View>
              </Pressable>
            </View>
          )}

          {/* ── Consolidated view ── */}
          {calcOpen && (
            <View ref={calcRef} style={styles.calcCard}>
              <View style={styles.calcHeader}>
                <Text style={styles.calcTitle}>{t('grocery.calcTitle' as TKey)}</Text>
                <Text style={styles.calcSub}>{t('grocery.calcItems' as TKey, { n: consolidated.length })}</Text>
              </View>
              {consolidated.map((item, idx) => (
                <View key={item.name + idx}>
                  <View style={styles.calcRow}>
                    <IngredientIcon name={item.name} size={26} />
                    <View style={styles.rowBody}>
                      <Text style={styles.calcRowName}>{item.name}</Text>
                      {item.recipes.length > 1 && (
                        <Text style={styles.calcRowSub} numberOfLines={1}>
                          {item.recipes.join(' · ')}
                        </Text>
                      )}
                    </View>
                    <View style={styles.calcAmtWrap}>
                      <Text style={[styles.calcAmt, item.merged && styles.calcAmtMerged]}>
                        {item.total || '—'}
                      </Text>
                      {item.merged && (
                        <View style={styles.mergedBadge}>
                          <Text style={styles.mergedBadgeText}>+{item.recipes.length}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  {idx < consolidated.length - 1 && <View style={styles.calcSep} />}
                </View>
              ))}
            </View>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <View style={styles.completedWrap}>
              <View style={styles.completedHeader}>
                <Text style={styles.completedTitle}>{t('grocery.inBasket', { n: completed.length })}</Text>
                <Pressable onPress={clearCheckedGrocery} hitSlop={10}>
                  <Text style={styles.clearAll}>{t('grocery.clear')}</Text>
                </Pressable>
              </View>
              <Pressable
                style={styles.scanBoughtBtn}
                onPress={() => navigation.navigate('ScanBarcode')}
              >
                <Text style={styles.scanBoughtText}>{t('grocery.scanBought' as TKey)}</Text>
              </Pressable>
              <View style={styles.card}>
                {completed.map((item) => (
                  <SwipeableRow
                    key={item.id}
                    onToggle={() => toggleGrocery(item.id)}
                    onRemove={() => removeGrocery(item.id)}
                    styles={styles}
                    deleteLabel={t('grocery.swipeDelete' as TKey)}
                  >
                    <View style={styles.cbOn}>
                      <Text style={styles.cbCheck}>✓</Text>
                    </View>
                    <IngredientIcon name={item.n} aisle={item.aisle} size={26} muted />
                    <Text style={styles.rowNameDone} numberOfLines={1}>{item.n}</Text>
                    <Text style={styles.rowAmtDone} numberOfLines={1}>{item.a}</Text>
                  </SwipeableRow>
                ))}
              </View>
            </View>
          )}

          {/* Receipt shortcut */}
          <Pressable style={styles.receiptRow} onPress={() => navigation.navigate('Receipts')}>
            <Text style={{ fontSize: 20 }}>🧾</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.receiptTitle}>{t('home.trackSpending')}</Text>
              <Text style={styles.receiptSub}>{t('home.trackSpendingSub')}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  content: { paddingHorizontal: 20, paddingBottom: 120 },

  headerRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 18,
  },
  title: { fontFamily: fonts.display, fontSize: 26, color: c.ink, letterSpacing: -0.5 },
  sub: { fontSize: 13, fontWeight: '600', color: c.grayMid, marginTop: 2 },

  toggle: {
    flexDirection: 'row',
    backgroundColor: c.surfaceAlt,
    borderRadius: 10,
    padding: 3,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  toggleBtn: { paddingVertical: 6, paddingHorizontal: 11, borderRadius: 8 },
  toggleOn: { backgroundColor: c.surface, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  toggleText: { fontSize: 12, fontWeight: '700', color: c.grayMid },
  toggleTextOn: { color: c.ink },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: c.grayMid, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 },

  /* Pantry horizontal strip */
  pantryWrap: { marginBottom: 20 },
  pantryScroll: { marginHorizontal: -4 },
  pantryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    borderRadius: 20, paddingVertical: 5, paddingLeft: 5, paddingRight: 10,
    marginHorizontal: 4,
  },
  pantryChipOn: { backgroundColor: c.accentSoft, borderColor: c.accent },
  pantryImg: { width: 22, height: 22, borderRadius: 11 },
  pantryImgEmpty: { width: 22, height: 22, borderRadius: 11, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  pantryChipText: { fontSize: 12.5, fontWeight: '600', color: c.ink, maxWidth: 90 },
  pantryChipTextOn: { color: c.accent },
  pantryBadge: { fontSize: 12, fontWeight: '700', color: c.grayMid },
  pantryBadgeOn: { color: c.accent },
  pantryMore: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.surfaceAlt, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 5, marginHorizontal: 4,
  },
  pantryMoreText: { fontSize: 12.5, fontWeight: '700', color: c.grayMid },

  /* Select all */
  selectRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, marginBottom: 12 },
  selectText: { flex: 1, fontSize: 13, fontWeight: '700', color: c.ink },
  clearAll: { fontSize: 12.5, fontWeight: '700', color: c.accent },

  /* Groups */
  group: { marginBottom: 18 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  groupEmoji: { fontSize: 14 },
  groupDot: { width: 7, height: 7, borderRadius: 4 },
  groupName: { flex: 1, fontSize: 12, fontWeight: '700', color: c.grayMid, textTransform: 'uppercase', letterSpacing: 0.5 },
  groupCount: { fontSize: 11.5, fontWeight: '600', color: c.grayMid },

  /* Card container for group items */
  card: {
    backgroundColor: c.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    overflow: 'hidden',
  },

  /* Swipeable row */
  swipeWrap: { position: 'relative', overflow: 'hidden' },
  deleteBg: {
    position: 'absolute', right: 0, top: 0, bottom: 0,
    backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center',
    width: 72,
  },
  deleteBtn: { width: 72, height: '100%', alignItems: 'center', justifyContent: 'center' },
  deleteText: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, gap: 11,
    backgroundColor: c.surface,
  },

  /* Checkbox */
  cb: {
    width: 20, height: 20, borderRadius: 6,
    borderWidth: 1.5, borderColor: '#D0CEC9',
  },
  cbOn: {
    width: 20, height: 20, borderRadius: 6,
    backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center',
  },
  cbInRow: { flexShrink: 0 },
  cbCheck: { color: '#fff', fontSize: 11, fontWeight: '800' },

  rowBody: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '600', color: c.ink },
  rowSub: { fontSize: 11.5, color: c.grayMid, marginTop: 1 },
  rowAmt: { fontSize: 13, fontWeight: '700', color: c.grayMid, flexShrink: 0, maxWidth: 90, textAlign: 'right' },
  sep: {
    position: 'absolute', bottom: 0, left: 46, right: 0,
    height: StyleSheet.hairlineWidth, backgroundColor: c.border,
  },

  /* ── Calculate button ── */
  calcBtnWrap: { marginVertical: 20 },
  calcBtnHint: {
    fontSize: 12.5, fontWeight: '500', color: c.grayMid,
    textAlign: 'center', marginBottom: 12, paddingHorizontal: 10,
  },
  calcBtn: {
    backgroundColor: c.accent,
    borderRadius: 20,
    paddingVertical: 18, paddingHorizontal: 24,
    shadowColor: c.accent, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 5 },
    elevation: 7,
  },
  calcBtnInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  calcLabel: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  calcArrow: { color: '#fff', fontSize: 26, fontWeight: '800', lineHeight: 28 },

  /* ── Consolidated card ── */
  calcCard: {
    backgroundColor: c.surface, borderRadius: 18,
    borderWidth: 1, borderColor: c.border,
    marginBottom: 20, overflow: 'hidden',
  },
  calcHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: c.border,
    backgroundColor: c.surfaceAlt,
  },
  calcTitle: { fontSize: 14, fontWeight: '800', color: c.ink },
  calcSub: { fontSize: 12, fontWeight: '600', color: c.grayMid },
  calcRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 11, gap: 11,
  },
  calcRowName: { fontSize: 14, fontWeight: '600', color: c.ink },
  calcRowSub: { fontSize: 11, color: c.grayMid, marginTop: 1 },
  calcAmtWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  calcAmt: { fontSize: 13, fontWeight: '700', color: c.grayMid, textAlign: 'right' },
  calcAmtMerged: { color: c.accent, fontWeight: '800' },
  mergedBadge: {
    backgroundColor: c.accentSoft, borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  mergedBadgeText: { fontSize: 10.5, fontWeight: '800', color: c.accent },
  calcSep: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: 51 },

  /* Completed */
  completedWrap: { marginBottom: 18 },
  completedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  completedTitle: { fontSize: 12, fontWeight: '700', color: c.grayMid, textTransform: 'uppercase', letterSpacing: 0.5 },
  scanBoughtBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f0fdf4', borderRadius: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: '#86efac', marginBottom: 10,
  },
  scanBoughtText: { fontSize: 13, fontWeight: '700', color: '#15803d' },
  rowNameDone: { flex: 1, fontSize: 14, fontWeight: '500', color: c.grayMid, textDecorationLine: 'line-through' },
  rowAmtDone: { fontSize: 13, fontWeight: '600', color: c.grayMid, textDecorationLine: 'line-through', flexShrink: 0 },

  /* Empty */
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyIcon: { fontSize: 44, marginBottom: 6 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: c.ink },
  emptySub: { fontSize: 14, fontWeight: '500', color: c.grayMid },
  browseBtn: { backgroundColor: c.accent, paddingVertical: 13, paddingHorizontal: 26, borderRadius: 14, marginTop: 8 },
  browseText: { color: '#fff', fontSize: 14.5, fontWeight: '700' },

  /* Receipt shortcut */
  receiptRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    borderRadius: 14, padding: 13, marginTop: 4,
  },
  receiptTitle: { fontSize: 13.5, fontWeight: '700', color: c.ink },
  receiptSub: { fontSize: 11.5, color: c.grayMid, marginTop: 1 },
  chevron: { color: c.grayMid, fontSize: 20 },
});
