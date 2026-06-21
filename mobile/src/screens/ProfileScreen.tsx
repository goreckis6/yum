import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getApiBaseUrl } from '../config/api';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { ThemeColors } from '../theme/colors';
import { useTheme, useThemeCtx, ThemeMode } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { useI18n } from '../i18n/I18nContext';
import { Lang } from '../i18n/translations';

const LANG_OPTIONS: { key: Lang; label: string }[] = [
  { key: 'en', label: 'English' },
  { key: 'pl', label: 'Polski' },
];

export function ProfileScreen() {
  const c = useTheme();
  const { t, lang, setLang } = useI18n();
  const styles = makeStyles(c);
  const { mode, setMode } = useThemeCtx();
  const { recipes, showToast } = useApp();
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();

  const THEME_OPTIONS: { key: ThemeMode; label: string }[] = [
    { key: 'system', label: t('profile.system') },
    { key: 'light', label: t('profile.light') },
    { key: 'dark', label: t('profile.dark') },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.title}>{t('profile.title')}</Text>

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

      <Text style={styles.section}>{t('profile.appearance')}</Text>
      <View style={styles.segment}>
        {THEME_OPTIONS.map((opt) => {
          const on = mode === opt.key;
          return (
            <Pressable
              key={opt.key}
              style={[styles.segmentBtn, on && styles.segmentBtnOn]}
              onPress={() => setMode(opt.key)}
            >
              <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.section}>{t('profile.language')}</Text>
      <View style={styles.segment}>
        {LANG_OPTIONS.map((opt) => {
          const on = lang === opt.key;
          return (
            <Pressable
              key={opt.key}
              style={[styles.segmentBtn, on && styles.segmentBtnOn]}
              onPress={() => setLang(opt.key)}
            >
              <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable style={styles.logout} onPress={() => signOut()}>
        <Text style={styles.logoutText}>{t('profile.signOut')}</Text>
      </Pressable>

      <Text style={styles.apiHint}>API: {getApiBaseUrl()}</Text>
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 130 },
  title: { fontFamily: fonts.display, fontSize: 28, color: c.ink, marginBottom: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: c.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  name: { fontSize: 16, fontWeight: '700', color: c.ink },
  email: { fontSize: 13, fontWeight: '500', color: c.grayMid, marginTop: 2 },
  statCard: {
    backgroundColor: c.accent,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: c.surfaceAlt,
    borderRadius: 14,
    padding: 4,
    marginBottom: 24,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  segmentBtnOn: { backgroundColor: c.accent },
  segmentText: { fontSize: 14, fontWeight: '700', color: c.grayMid },
  segmentTextOn: { color: '#fff' },
  statNum: { fontFamily: fonts.displayExtra, fontSize: 32, color: '#fff' },
  statLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)', marginTop: 4 },
  syncLine: { fontSize: 13, fontWeight: '500', color: c.grayMid, marginBottom: 10 },
  syncBtn: {
    alignSelf: 'flex-start',
    backgroundColor: c.surface,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  syncBtnText: { fontSize: 14, fontWeight: '700', color: c.ink },
  section: { fontFamily: fonts.display, fontSize: 17, color: c.ink, marginBottom: 10 },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.surface,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  linkText: { fontSize: 15, fontWeight: '600', color: c.ink },
  chevron: { fontSize: 20, color: c.gray },
  logout: { marginTop: 16, alignItems: 'center', paddingVertical: 14 },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#B91C1C' },
  apiHint: { fontSize: 11, color: c.grayMid, textAlign: 'center', marginTop: 20 },
});
