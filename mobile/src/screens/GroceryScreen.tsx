import React, { useRef, useMemo, useState } from 'react';
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

type GroupBy = 'aisle' | 'recipe';

const AISLE_ICON: Record<Aisle, string> = {
  Produce: '🥬',
  'Meat & Seafood': '🥩',
  'Dairy & Eggs': '🥛',
  Bakery: '🍞',
  Pantry: '🫙',
  Frozen: '🧊',
};

const SWIPE_THRESHOLD = 80;

function SwipeableRow({
  item,
  onToggle,
  onRemove,
  children,
  styles,
  c,
}: {
  item: GroceryItem;
  onToggle: () => void;
  onRemove: () => void;
  children: React.ReactNode;
  styles: ReturnType<typeof makeStyles>;
  c: ThemeColors;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [revealed, setRevealed] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        const dx = Math.min(0, g.dx);
        translateX.setValue(dx);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -SWIPE_THRESHOLD) {
          Animated.spring(translateX, { toValue: -80, useNativeDriver: true }).start();
          setRevealed(true);
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
          setRevealed(false);
        }
      },
    }),
  ).current;

  const handleRemove = () => {
    Animated.timing(translateX, { toValue: -400, duration: 220, useNativeDriver: true }).start(
      onRemove,
    );
  };

  return (
    <View style={styles.swipeWrap}>
      <View style={styles.deleteBack}>
        <Pressable style={styles.deleteBtn} onPress={handleRemove}>
          <Text style={styles.deleteText}>Usuń</Text>
        </Pressable>
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <Pressable style={styles.item} onPress={onToggle}>
          {children}
        </Pressable>
      </Animated.View>
    </View>
  );
}

export function GroceryScreen() {
  const c = useTheme();
  const { t } = useI18n();
  const styles = makeStyles(c);
  const aisleLabel = (name: string) =>
    (['Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Bakery', 'Pantry', 'Frozen'] as const).includes(name as never)
      ? t(`aisle.${name}` as TKey)
      : name;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { setTab } = useTabNav();
  const { grocery, pantry, toggleGrocery, toggleAllGrocery, removeGrocery, clearCheckedGrocery, addPantryToGrocery, showToast } = useApp();
  const [groupBy, setGroupBy] = useState<GroupBy>('aisle');
  const [pantryExpanded, setPantryExpanded] = useState(false);
  const insets = useSafeAreaInsets();

  const active = grocery.filter((g) => !g.checked);
  const completed = grocery.filter((g) => g.checked);
  const allChecked = grocery.length > 0 && grocery.every((g) => g.checked);

  const allPantryItems = pantry ?? [];
  const PANTRY_PREVIEW = 4;
  const pantryItems = pantryExpanded ? allPantryItems : allPantryItems.slice(0, PANTRY_PREVIEW);
  const hasMore = allPantryItems.length > PANTRY_PREVIEW;

  const groups = useMemo(() => {
    if (groupBy === 'aisle') {
      const byAisle: Record<string, GroceryItem[]> = {};
      active.forEach((g) => {
        if (!byAisle[g.aisle]) byAisle[g.aisle] = [];
        byAisle[g.aisle].push(g);
      });
      const ordered = AISLE_ORDER.filter((a) => byAisle[a]);
      const extra = Object.keys(byAisle).filter((a) => !AISLE_ORDER.includes(a as typeof AISLE_ORDER[number]));
      return [...ordered, ...extra].map((name) => ({
        name,
        dot: AISLE_DOT[name] || c.accent,
        items: byAisle[name],
      }));
    }

    const byRecipe: Record<string, GroceryItem[]> = {};
    active.forEach((g) => {
      if (!byRecipe[g.recipe]) byRecipe[g.recipe] = [];
      byRecipe[g.recipe].push(g);
    });
    return Object.keys(byRecipe).map((name) => ({
      name,
      dot: c.accent,
      items: byRecipe[name],
    }));
  }, [active, groupBy]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.title}>{t('grocery.title')}</Text>
      <Text style={styles.sub}>{t('grocery.itemsToPickup', { n: active.length })}</Text>

      {/* Pantry quick-add strip */}
      {allPantryItems.length > 0 && (
        <View style={styles.pantryStrip}>
          <Text style={styles.pantryStripLabel}>Ze spiżarni</Text>
          <View style={styles.pantryGrid}>
            {pantryItems.map((p) => {
              const groceryEntry = grocery.find((g) => g.n.toLowerCase() === p.name.toLowerCase());
              const onList = !!groceryEntry;
              return (
                <Pressable
                  key={p.id}
                  style={[styles.pantryChip, onList && styles.pantryChipDone]}
                  onPress={() => {
                    if (onList && groceryEntry) {
                      removeGrocery(groceryEntry.id);
                    } else {
                      addPantryToGrocery(p.id);
                    }
                  }}
                >
                  {p.imageUrl ? (
                    <Image source={{ uri: p.imageUrl }} style={styles.pantryChipImg} resizeMode="cover" />
                  ) : (
                    <View style={styles.pantryChipImgEmpty}>
                      <Text style={{ fontSize: 12 }}>🫙</Text>
                    </View>
                  )}
                  <Text style={[styles.pantryChipText, onList && styles.pantryChipTextDone]} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={[styles.pantryChipBadge, onList && styles.pantryChipBadgeDone]}>
                    {onList ? '✓' : '+'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {hasMore && (
            <Pressable style={styles.pantryExpandBtn} onPress={() => setPantryExpanded((v) => !v)}>
              <Text style={styles.pantryExpandText}>
                {pantryExpanded ? 'Pokaż mniej ↑' : `Pokaż więcej (${allPantryItems.length - PANTRY_PREVIEW}) ↓`}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.toggle}>
        <Pressable
          style={[styles.toggleBtn, groupBy === 'aisle' && styles.toggleOn]}
          onPress={() => setGroupBy('aisle')}
        >
          <Text style={[styles.toggleText, groupBy === 'aisle' && styles.toggleTextOn]}>{t('grocery.byAisle')}</Text>
        </Pressable>
        <Pressable
          style={[styles.toggleBtn, groupBy === 'recipe' && styles.toggleOn]}
          onPress={() => setGroupBy('recipe')}
        >
          <Text style={[styles.toggleText, groupBy === 'recipe' && styles.toggleTextOn]}>{t('grocery.byRecipe')}</Text>
        </Pressable>
      </View>

      {grocery.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{t('grocery.empty')}</Text>
          <Text style={styles.emptySub}>{t('grocery.emptySub')}</Text>
          <Pressable style={styles.browseBtn} onPress={() => setTab('recipes')}>
            <Text style={styles.browseText}>{t('grocery.browse')}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* Select-all row */}
          <Pressable style={styles.selectAllRow} onPress={() => toggleAllGrocery(!allChecked)}>
            <View style={[styles.checkbox, allChecked && styles.checkboxOn]}>
              {allChecked && <Text style={styles.check}>✓</Text>}
            </View>
            <Text style={styles.selectAllText}>{allChecked ? 'Odznacz wszystko' : 'Zaznacz wszystko'}</Text>
            {completed.length > 0 && (
              <Pressable onPress={clearCheckedGrocery} hitSlop={10}>
                <Text style={styles.clearText}>{t('grocery.clear')}</Text>
              </Pressable>
            )}
          </Pressable>

          {groups.map((group) => (
            <View key={group.name} style={styles.group}>
              <View style={styles.groupHeader}>
                {groupBy === 'aisle' && AISLE_ICON[group.name as Aisle] ? (
                  <Text style={styles.groupIcon}>{AISLE_ICON[group.name as Aisle]}</Text>
                ) : (
                  <View style={[styles.dot, { backgroundColor: group.dot }]} />
                )}
                <Text style={styles.groupName}>{groupBy === 'aisle' ? aisleLabel(group.name) : group.name}</Text>
                <Text style={styles.groupCount}>{group.items.length}</Text>
              </View>
              {group.items.map((item) => (
                <SwipeableRow
                  key={item.id}
                  item={item}
                  onToggle={() => toggleGrocery(item.id)}
                  onRemove={() => removeGrocery(item.id)}
                  styles={styles}
                  c={c}
                >
                  <View style={styles.checkboxInner} />
                  <IngredientIcon name={item.n} aisle={item.aisle} size={34} />
                  <Text style={styles.itemAmt}>{item.a}</Text>
                  <View style={styles.itemBody}>
                    <Text style={styles.itemName}>{item.n}</Text>
                    <Text style={styles.itemSub}>
                      {groupBy === 'aisle' ? item.recipe : aisleLabel(item.aisle)}
                    </Text>
                  </View>
                </SwipeableRow>
              ))}
            </View>
          ))}

          {completed.length > 0 && (
            <View style={styles.completed}>
              <View style={styles.completedHeader}>
                <Text style={styles.completedTitle}>{t('grocery.inBasket', { n: completed.length })}</Text>
                <Pressable onPress={clearCheckedGrocery}>
                  <Text style={styles.clearText}>{t('grocery.clear')}</Text>
                </Pressable>
              </View>
              {completed.map((item) => (
                <SwipeableRow
                  key={item.id}
                  item={item}
                  onToggle={() => toggleGrocery(item.id)}
                  onRemove={() => removeGrocery(item.id)}
                  styles={styles}
                  c={c}
                >
                  <View style={styles.checkboxOn}>
                    <Text style={styles.check}>✓</Text>
                  </View>
                  <IngredientIcon name={item.n} aisle={item.aisle} size={30} muted />
                  <Text style={styles.itemAmtDone}>{item.a}</Text>
                  <Text style={styles.itemNameDone}>{item.n}</Text>
                </SwipeableRow>
              ))}
            </View>
          )}

          <Pressable style={styles.orderBtn} onPress={() => showToast(t('grocery.order'))}>
            <Text style={styles.orderText}>{t('grocery.order')}</Text>
          </Pressable>

          <Pressable style={styles.receiptBtn} onPress={() => navigation.navigate('Receipts')}>
            <Text style={styles.receiptIcon}>🧾</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.receiptTitle}>{t('home.trackSpending')}</Text>
              <Text style={styles.receiptSub}>{t('home.trackSpendingSub')}</Text>
            </View>
            <Text style={styles.receiptChevron}>›</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 130 },
  title: { fontFamily: fonts.display, fontSize: 28, color: c.ink, letterSpacing: -0.6 },
  sub: { fontSize: 14, fontWeight: '600', color: c.grayMid, marginTop: 4, marginBottom: 16 },

  pantryStrip: { marginBottom: 16 },
  pantryStripLabel: { fontSize: 12, fontWeight: '700', color: c.grayMid, marginBottom: 8 },
  pantryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pantryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 20,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 12,
  },
  pantryChipDone: { backgroundColor: c.surfaceAlt, borderColor: c.border },
  pantryChipImg: { width: 26, height: 26, borderRadius: 13 },
  pantryChipImgEmpty: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pantryChipText: { fontSize: 13, fontWeight: '600', color: c.ink, maxWidth: 110 },
  pantryChipTextDone: { color: c.grayMid },
  pantryChipBadge: { fontSize: 13, fontWeight: '700', color: c.accent },
  pantryChipBadgeDone: { color: c.grayMid },
  pantryExpandBtn: { paddingTop: 10, alignSelf: 'flex-start' },
  pantryExpandText: { fontSize: 12.5, fontWeight: '700', color: c.accent },

  toggle: {
    flexDirection: 'row',
    backgroundColor: c.surfaceAlt,
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
  },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  toggleOn: {
    backgroundColor: c.surface,
    shadowColor: '#211C18',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  toggleText: { fontSize: 13.5, fontWeight: '700', color: c.grayMid },
  toggleTextOn: { color: c.ink },

  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    marginBottom: 10,
  },
  selectAllText: { flex: 1, fontSize: 13.5, fontWeight: '700', color: c.ink },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: c.ink, marginBottom: 6 },
  emptySub: { fontSize: 14, fontWeight: '500', color: c.grayMid, marginBottom: 20 },
  browseBtn: {
    backgroundColor: c.accent,
    paddingVertical: 14,
    paddingHorizontal: 26,
    borderRadius: 14,
  },
  browseText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  group: { marginBottom: 20 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  groupIcon: { fontSize: 16 },
  groupName: { fontSize: 13, fontWeight: '700', color: c.ink, flex: 1 },
  groupCount: { fontSize: 12, fontWeight: '600', color: c.grayMid },

  swipeWrap: { position: 'relative', marginBottom: 8, overflow: 'hidden', borderRadius: 14 },
  deleteBack: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#DC2626',
    borderRadius: 14,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  deleteBtn: { paddingHorizontal: 20, height: '100%', alignItems: 'center', justifyContent: 'center' },
  deleteText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#DADADA',
  },
  checkboxInner: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#DADADA',
  },
  checkboxOn: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: { color: '#fff', fontSize: 12, fontWeight: '700' },
  itemAmt: { fontSize: 14, fontWeight: '700', color: c.ink, minWidth: 56 },
  itemBody: { flex: 1 },
  itemName: { fontSize: 14.5, fontWeight: '600', color: c.ink },
  itemSub: { fontSize: 12, fontWeight: '500', color: c.grayMid, marginTop: 2 },

  completed: { marginTop: 8 },
  completedHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  completedTitle: { fontSize: 13, fontWeight: '700', color: c.grayMid },
  clearText: { fontSize: 13, fontWeight: '700', color: c.ink },
  itemAmtDone: { fontSize: 14, fontWeight: '700', color: c.grayMid, textDecorationLine: 'line-through', minWidth: 56 },
  itemNameDone: { fontSize: 14.5, fontWeight: '500', color: c.grayMid, textDecorationLine: 'line-through', flex: 1 },
  orderBtn: {
    backgroundColor: c.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  orderText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  receiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
  },
  receiptIcon: { fontSize: 26 },
  receiptTitle: { fontSize: 14, fontWeight: '700', color: c.ink },
  receiptSub: { fontSize: 12, fontWeight: '500', color: c.grayMid, marginTop: 1 },
  receiptChevron: { color: c.grayMid, fontSize: 22 },
});
