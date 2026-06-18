import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { Icon, IconName } from './Icon';

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
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon: IconName;
}) {
  const tint = active ? colors.accent : colors.gray;
  return (
    <Pressable style={styles.navItem} onPress={onPress}>
      <Icon name={icon} size={22} color={tint} fill={icon === 'heart' && active} />
      <Text style={[styles.navLabel, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

export function BottomNav({ active, onRecipes, onMeal, onGrocery, onProfile, onAdd }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <NavItem label="Recipes" active={active === 'recipes'} onPress={onRecipes} icon="heart" />
        <NavItem label="Plan" active={active === 'mealplan'} onPress={onMeal} icon="grid" />
        <Pressable style={styles.addBtn} onPress={onAdd}>
          <Icon name="plus" size={26} color="#fff" />
        </Pressable>
        <NavItem label="Grocery" active={active === 'grocery'} onPress={onGrocery} icon="cart" />
        <NavItem label="Profile" active={active === 'profile'} onPress={onProfile} icon="profile" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 22,
    paddingTop: 8,
    backgroundColor: 'rgba(246,246,244,0.95)',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 8,
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
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  addIcon: { color: '#fff', fontSize: 28, fontWeight: '300', marginTop: -2 },
});
