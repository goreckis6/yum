import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { Icon, IconName } from './Icon';
import { useI18n } from '../i18n/I18nContext';

type TabKey = 'recipes' | 'mealplan' | 'grocery' | 'profile';

interface Props {
  active: TabKey;
  onRecipes: () => void;
  onMeal: () => void;
  onGrocery: () => void;
  onProfile: () => void;
  onAdd: () => void;
}

function NavItem({
  label,
  active,
  onPress,
  icon,
  styles,
  c,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon: IconName;
  styles: ReturnType<typeof makeStyles>;
  c: ThemeColors;
}) {
  const tint = active ? c.accent : c.gray;
  return (
    <Pressable style={styles.navItem} onPress={onPress}>
      <Icon name={icon} size={22} color={tint} fill={icon === 'heart' && active} />
      <Text style={[styles.navLabel, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

export function BottomNav({ active, onRecipes, onMeal, onGrocery, onProfile, onAdd }: Props) {
  const c = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <NavItem label={t('nav.recipes')} active={active === 'recipes'} onPress={onRecipes} icon="heart" styles={styles} c={c} />
        <NavItem label={t('nav.planner')} active={active === 'mealplan'} onPress={onMeal} icon="grid" styles={styles} c={c} />
        <Pressable style={styles.addBtn} onPress={onAdd}>
          <Icon name="plus" size={26} color="#fff" />
        </Pressable>
        <NavItem label={t('nav.grocery')} active={active === 'grocery'} onPress={onGrocery} icon="cart" styles={styles} c={c} />
        <NavItem label={t('nav.profile')} active={active === 'profile'} onPress={onProfile} icon="profile" styles={styles} c={c} />
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 16,
      paddingBottom: 22,
      paddingTop: 8,
      backgroundColor: c.bg,
    },
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: 22,
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: '#211C18',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 24,
      elevation: 6,
    },
    navItem: { flex: 1, alignItems: 'center', gap: 3 },
    navIcon: { fontSize: 18 },
    navLabel: { fontSize: 10.5, fontWeight: '700', fontFamily: fonts.bodyBold },
    addBtn: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: -28,
      shadowColor: c.accent,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.35,
      shadowRadius: 18,
      elevation: 8,
    },
    addIcon: { color: '#fff', fontSize: 28, fontWeight: '300', marginTop: -2 },
  });
