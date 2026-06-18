import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getApiBaseUrl } from '../config/api';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

const SETTINGS = [
  'Account settings',
  'Units & preferences',
  'Notifications',
  'Default servings',
  'Data export',
  'Help & support',
  'Privacy & terms',
];

export function ProfileScreen() {
  const { recipes, showToast } = useApp();
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>YS</Text>
        </View>
        <View>
          <Text style={styles.name}>{user?.email?.split('@')[0] ?? 'YumShare User'}</Text>
          <Text style={styles.email}>{user?.email ?? 'Synced to your account'}</Text>
        </View>
      </View>

      <View style={styles.statCard}>
        <Text style={styles.statNum}>{recipes.length}</Text>
        <Text style={styles.statLabel}>recipes synced to your account</Text>
      </View>

      <Text style={styles.syncLine}>Last synced just now · 1 device</Text>
      <Pressable style={styles.syncBtn} onPress={() => showToast('Everything is up to date')}>
        <Text style={styles.syncBtnText}>Sync now</Text>
      </Pressable>

      <Text style={styles.section}>Settings</Text>
      {SETTINGS.map((label) => (
        <Pressable key={label} style={styles.link} onPress={() => showToast('Settings coming in a later phase')}>
          <Text style={styles.linkText}>{label}</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}

      <Pressable style={styles.logout} onPress={() => signOut()}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>

      <Text style={styles.apiHint}>API: {getApiBaseUrl()}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 130 },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink, marginBottom: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  name: { fontSize: 16, fontWeight: '700', color: colors.ink },
  email: { fontSize: 13, fontWeight: '500', color: colors.grayMid, marginTop: 2 },
  statCard: {
    backgroundColor: colors.ink,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },
  statNum: { fontFamily: fonts.displayExtra, fontSize: 32, color: '#fff' },
  statLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)', marginTop: 4 },
  syncLine: { fontSize: 13, fontWeight: '500', color: colors.grayMid, marginBottom: 10 },
  syncBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  syncBtnText: { fontSize: 14, fontWeight: '700', color: colors.ink },
  section: { fontFamily: fonts.display, fontSize: 17, color: colors.ink, marginBottom: 10 },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  linkText: { fontSize: 15, fontWeight: '600', color: colors.ink },
  chevron: { fontSize: 20, color: colors.gray },
  logout: { marginTop: 16, alignItems: 'center', paddingVertical: 14 },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#B91C1C' },
  apiHint: { fontSize: 11, color: colors.grayMid, textAlign: 'center', marginTop: 20 },
});
