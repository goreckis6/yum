import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { RootStackParamList } from '../navigation/types';
import { useApp } from '../context/AppContext';
import { useI18n } from '../i18n/I18nContext';
import { Icon } from '../components/Icon';
import { PantryItem } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Pantry'>;

export function PantryScreen({ navigation }: Props) {
  const c = useTheme();
  const { t } = useI18n();
  const styles = makeStyles(c);
  const insets = useSafeAreaInsets();
  const { pantry, removePantryItem, addPantryToGrocery, removeGrocery, grocery, showToast } = useApp();
  const items = pantry ?? [];

  const remove = (item: PantryItem) => {
    removePantryItem(item.id);
    showToast(t('pantry.removed'));
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{t('pantry.title')}</Text>
        <View style={{ width: 40 }} />
      </View>
      <Text style={styles.sub}>{t('pantry.sub')}</Text>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="barcode" size={44} color={c.gray} />
          <Text style={styles.emptyText}>{t('pantry.empty')}</Text>
          <Pressable style={styles.scanBtn} onPress={() => navigation.navigate('ScanBarcode')}>
            <Text style={styles.scanBtnText}>Skanuj kod kreskowy</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
          <Text style={styles.count}>{t('pantry.count', { n: items.length })}</Text>
          {items.map((item) => {
            const m = item.perServing ?? item.per100;
            const basisNote = item.perServing
              ? t('pantry.perServing')
              : item.basis === '100ml'
                ? t('barcode.per100ml')
                : t('barcode.per100');
            return (
              <View key={item.id} style={styles.card}>
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.img} resizeMode="cover" />
                ) : (
                  <View style={[styles.img, styles.imgEmpty]}>
                    <Icon name="barcode" size={20} color={c.gray} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
                  {!!item.brand && <Text style={styles.brand} numberOfLines={1}>{item.brand}</Text>}
                  <Text style={styles.macroLine}>
                    {m.kcal} kcal · {m.p}P · {m.c}C · {m.f}F
                    <Text style={styles.macroNote}>  {basisNote}</Text>
                  </Text>
                </View>
                <View style={styles.cardActions}>
                  {(() => {
                    const groceryEntry = (grocery ?? []).find((g) => g.n.toLowerCase() === item.name.toLowerCase());
                    const onList = !!groceryEntry;
                    return (
                      <Pressable
                        style={[styles.addBtn, onList && styles.addBtnDone]}
                        onPress={() => {
                          if (onList && groceryEntry) {
                            removeGrocery(groceryEntry.id);
                            showToast('Usunięto z listy zakupów');
                          } else {
                            addPantryToGrocery(item.id);
                          }
                        }}
                        hitSlop={6}
                      >
                        <Text style={[styles.addBtnText, onList && styles.addBtnTextDone]}>
                          {onList ? '×' : '+'}
                        </Text>
                      </Pressable>
                    );
                  })()}
                  <Pressable style={styles.removeBtn} onPress={() => remove(item)} hitSlop={8}>
                    <Text style={styles.removeText}>{t('pantry.remove')}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
        <Pressable
          style={[styles.scanBtn, { marginBottom: insets.bottom + 12 }]}
          onPress={() => navigation.navigate('ScanBarcode')}
        >
          <Text style={styles.scanBtnText}>+ Skanuj kod kreskowy</Text>
        </Pressable>
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingHorizontal: 20 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
    backIcon: { fontSize: 28, color: c.ink, marginTop: -3 },
    title: { fontFamily: fonts.display, fontSize: 22, color: c.ink },
    sub: { fontSize: 14, fontWeight: '500', color: c.grayMuted, marginTop: 10, marginBottom: 18 },
    count: { fontSize: 12.5, fontWeight: '700', color: c.grayMid, marginBottom: 12 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingBottom: 60 },
    emptyText: { fontSize: 14, fontWeight: '600', color: c.grayMid, textAlign: 'center', paddingHorizontal: 32 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      padding: 12,
      marginBottom: 10,
    },
    img: { width: 52, height: 52, borderRadius: 11, backgroundColor: c.surfaceAlt },
    imgEmpty: { alignItems: 'center', justifyContent: 'center' },
    name: { fontFamily: fonts.display, fontSize: 16, color: c.ink },
    brand: { fontSize: 12.5, fontWeight: '500', color: c.grayMid, marginTop: 1 },
    macroLine: { fontSize: 12.5, fontWeight: '700', color: c.ink, marginTop: 5 },
    macroNote: { fontSize: 11, fontWeight: '500', color: c.grayMid },
    cardActions: { alignItems: 'flex-end', gap: 8 },
    addBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: '#D1FAE5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    addBtnDone: { backgroundColor: '#FEE2E2' },
    addBtnText: { color: '#059669', fontSize: 18, fontWeight: '700', marginTop: -1 },
    addBtnTextDone: { color: '#DC2626' },
    removeBtn: { paddingVertical: 4, paddingHorizontal: 2 },
    removeText: { fontSize: 12, fontWeight: '700', color: c.grayMid },
    scanBtn: {
      backgroundColor: c.accent,
      borderRadius: 16,
      paddingVertical: 15,
      alignItems: 'center',
      marginHorizontal: 0,
      marginTop: 8,
    },
    scanBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  });
