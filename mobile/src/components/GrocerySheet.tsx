import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { Recipe } from '../types';
import { scaleAmount } from '../utils/scale';

// Competitor-style "Add to groceries" sheet: pick which ingredients to add,
// adjust servings (amounts rescale live), then add the selected items.
export function GrocerySheet({
  visible,
  onClose,
  recipe,
}: {
  visible: boolean;
  onClose: () => void;
  recipe: Recipe;
}) {
  const c = useTheme();
  const { t } = useI18n();
  const styles = makeStyles(c);
  const insets = useSafeAreaInsets();
  const { addIngredientsToGrocery } = useApp();

  const [servings, setServings] = useState(recipe.servings || 4);
  // Track deselected indices (everything starts selected, like the reference).
  const [deselected, setDeselected] = useState<Set<number>>(new Set());

  // Reset each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setServings(recipe.servings || 4);
      setDeselected(new Set());
    }
  }, [visible, recipe.servings]);

  const factor = servings / (recipe.servings || servings || 1);
  const selectedCount = recipe.ingredients.length - deselected.size;
  const allSelected = deselected.size === 0;

  const toggle = (i: number) =>
    setDeselected((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const toggleAll = () =>
    setDeselected(allSelected ? new Set(recipe.ingredients.map((_, i) => i)) : new Set());

  const onAdd = () => {
    const items = recipe.ingredients
      .filter((_, i) => !deselected.has(i))
      .map((ing) => ({ a: scaleAmount(ing.a, factor), n: ing.n, aisle: ing.aisle }));
    if (items.length) addIngredientsToGrocery(recipe.title, items);
    onClose();
  };

  const label = useMemo(
    () => (selectedCount > 0 ? t('grocerySheet.add', { n: selectedCount }) : t('grocerySheet.addNone')),
    [selectedCount, t],
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.grabber} />

        <View style={styles.header}>
          <Text style={styles.title}>{t('grocerySheet.title')}</Text>
          <Pressable style={styles.close} onPress={onClose} hitSlop={10}>
            <Text style={styles.closeIcon}>×</Text>
          </Pressable>
        </View>

        <View style={styles.servingsRow}>
          <View style={styles.stepper}>
            <Pressable
              style={styles.stepBtn}
              onPress={() => setServings((s) => Math.max(1, s - 1))}
              hitSlop={8}
            >
              <Text style={styles.stepSign}>−</Text>
            </Pressable>
            <Text style={styles.stepValue}>{servings}</Text>
            <Pressable
              style={styles.stepBtn}
              onPress={() => setServings((s) => Math.min(12, s + 1))}
              hitSlop={8}
            >
              <Text style={styles.stepSign}>+</Text>
            </Pressable>
          </View>
          <Text style={styles.servingsLabel}>{t('grocerySheet.servings')}</Text>
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.listHeaderText}>{t('grocerySheet.ingredients')}</Text>
          <Pressable onPress={toggleAll} hitSlop={8}>
            <Text style={styles.selectAll}>
              {allSelected ? t('grocerySheet.deselectAll') : t('grocerySheet.selectAll')}
            </Text>
          </Pressable>
        </View>

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {recipe.ingredients.map((ing, i) => {
            const on = !deselected.has(i);
            return (
              <Pressable key={i} style={styles.row} onPress={() => toggle(i)}>
                <Text style={styles.amt}>
                  {scaleAmount(ing.a, factor)} <Text style={styles.name}>{ing.n}</Text>
                </Text>
                <View style={[styles.checkbox, on && styles.checkboxOn]}>
                  {on ? <Text style={styles.checkmark}>✓</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable
          style={[styles.addBtn, selectedCount === 0 && styles.addBtnOff]}
          onPress={onAdd}
          disabled={selectedCount === 0}
        >
          <Text style={styles.addText}>{label}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: c.scrim },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: '86%',
      backgroundColor: c.bg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 8,
    },
    grabber: {
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: c.border,
      alignSelf: 'center',
      marginBottom: 8,
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
    title: { fontFamily: fonts.display, fontSize: 22, color: c.ink },
    close: {
      position: 'absolute',
      right: 0,
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeIcon: { fontSize: 22, color: c.grayLight, marginTop: -2 },
    servingsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 6,
    },
    stepBtn: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
    stepSign: { fontSize: 22, color: c.ink, fontWeight: '600' },
    stepValue: { fontSize: 17, fontWeight: '800', color: c.ink, minWidth: 26, textAlign: 'center' },
    servingsLabel: { fontSize: 15, fontWeight: '500', color: c.grayLight },
    listHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingTop: 16,
      paddingBottom: 10,
    },
    listHeaderText: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: c.accent },
    selectAll: { fontSize: 14, fontWeight: '700', color: c.accent },
    list: { flexGrow: 0 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    amt: { flex: 1, fontSize: 16, fontWeight: '800', color: c.ink },
    name: { fontWeight: '500', color: c.ink },
    checkbox: {
      width: 26,
      height: 26,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: c.gray,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 12,
    },
    checkboxOn: { backgroundColor: c.accent, borderColor: c.accent },
    checkmark: { color: '#fff', fontSize: 15, fontWeight: '900', marginTop: -1 },
    addBtn: {
      backgroundColor: c.accent,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 14,
    },
    addBtnOff: { backgroundColor: c.gray },
    addText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  });
