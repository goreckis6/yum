import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { ThemeColors } from '../theme/colors';
import { useTheme, useThemeCtx, ThemeMode } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { useI18n } from '../i18n/I18nContext';
import { Lang, TKey } from '../i18n/translations';
import { Icon, IconName } from '../components/Icon';
import { ActionSheet } from '../components/ActionSheet';
import { RootStackParamList } from '../navigation/types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { clearCache } from '../storage/persist';
import { getApiBaseUrl } from '../config/api';

const LANG_OPTIONS: { key: Lang; label: string }[] = [
  { key: 'en', label: 'English' },
  { key: 'pl', label: 'Polski' },
];

const SUPPORT_EMAIL = '3dstudiopoland@gmail.com';
const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

// Fill these in to make the links live; empty = shows a "coming soon" toast.
const LINKS = {
  terms: '',
  privacy: '',
  instagram: '',
  tiktok: '',
  x: '',
};

export function ProfileScreen() {
  const c = useTheme();
  const { t, lang, setLang } = useI18n();
  const styles = makeStyles(c);
  const { mode, setMode } = useThemeCtx();
  const { recipes, receipts, showToast } = useApp();
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const THEME_OPTIONS: { key: ThemeMode; label: string }[] = [
    { key: 'system', label: t('profile.system') },
    { key: 'light', label: t('profile.light') },
    { key: 'dark', label: t('profile.dark') },
  ];

  const mail = (subject: string) =>
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`).catch(() =>
      showToast(SUPPORT_EMAIL),
    );

  const openExt = (url: string) =>
    url ? Linking.openURL(url).catch(() => showToast(t('profile.comingSoon'))) : showToast(t('profile.comingSoon'));

  const lastSynced = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const deleteAccount = async () => {
    try {
      if (isSupabaseConfigured) {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) {
          // Server deletes the auth user + data using the service role.
          await fetch(`${getApiBaseUrl()}/api/delete-account`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken: token }),
          });
        }
        if (user) await clearCache(user.id);
      }
    } catch {
      /* ignore — still sign out below */
    }
    showToast(t('profile.deletedToast'));
    signOut();
  };

  const Row = ({
    icon,
    labelKey,
    onPress,
    right,
    last,
  }: {
    icon: IconName;
    labelKey: TKey;
    onPress: () => void;
    right?: string;
    last?: boolean;
  }) => (
    <Pressable style={[styles.row, !last && styles.rowBorder]} onPress={onPress}>
      <Icon name={icon} size={19} color={c.ink} />
      <Text style={styles.rowText}>{t(labelKey)}</Text>
      {right ? <Text style={styles.rowRight}>{right}</Text> : <Text style={styles.chevron}>›</Text>}
    </Pressable>
  );

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.title}>{t('profile.title')}</Text>

      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>YS</Text>
        </View>
        <View>
          <Text style={styles.name}>{user?.email?.split('@')[0] ?? 'YumiShare'}</Text>
          <Text style={styles.email}>{user?.email ?? ''}</Text>
        </View>
      </View>

      <View style={styles.statCard}>
        <Text style={styles.statNum}>{recipes.length}</Text>
        <Text style={styles.statLabel}>{t('profile.recipesSynced')}</Text>
      </View>

      <Text style={styles.section}>{t('profile.appearance')}</Text>
      <View style={styles.segment}>
        {THEME_OPTIONS.map((opt) => {
          const on = mode === opt.key;
          return (
            <Pressable key={opt.key} style={[styles.segmentBtn, on && styles.segmentBtnOn]} onPress={() => setMode(opt.key)}>
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
            <Pressable key={opt.key} style={[styles.segmentBtn, on && styles.segmentBtnOn]} onPress={() => setLang(opt.key)}>
              <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.section}>{t('profile.data')}</Text>
      <View style={styles.group}>
        <Row icon="receipt" labelKey="profile.myReceipts" right={String(receipts?.length ?? 0)} onPress={() => navigation.navigate('Receipts')} />
        <Row icon="document" labelKey="profile.exportReceipts" onPress={() => navigation.navigate('Receipts')} />
        <Row icon="sync" labelKey="profile.syncData" right={t('profile.lastSynced', { time: lastSynced })} onPress={() => showToast(t('profile.syncedToast'))} last />
      </View>

      <Text style={styles.section}>{t('profile.supportLegal')}</Text>
      <View style={styles.group}>
        <Row icon="bulb" labelKey="profile.requestFeature" onPress={() => mail('YumiShare – feature request')} />
        <Row icon="mail" labelKey="profile.contactSupport" onPress={() => mail('YumiShare – support')} />
        <Row icon="document" labelKey="profile.terms" onPress={() => openExt(LINKS.terms)} />
        <Row icon="shield" labelKey="profile.privacy" onPress={() => openExt(LINKS.privacy)} last />
      </View>

      <Text style={styles.section}>{t('profile.accountActions')}</Text>
      <View style={styles.group}>
        <Row icon="profile" labelKey="profile.signOut" onPress={() => signOut()} />
        <Pressable style={styles.row} onPress={() => setDeleteOpen(true)}>
          <Icon name="x" size={19} color="#DC2626" />
          <Text style={[styles.rowText, styles.deleteText]}>{t('profile.deleteAccount')}</Text>
          <Text style={[styles.chevron, styles.deleteText]}>›</Text>
        </Pressable>
      </View>

      <Text style={styles.apiHint}>{t('profile.version', { v: APP_VERSION })}</Text>
    </ScrollView>

    <ActionSheet
      visible={deleteOpen}
      title={t('profile.deleteAccount')}
      message={t('profile.deleteAccountMsg')}
      options={[{ label: t('profile.deleteAccount'), destructive: true, onPress: deleteAccount }]}
      onClose={() => setDeleteOpen(false)}
    />
    </>
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
  statCard: { backgroundColor: c.accent, borderRadius: 18, padding: 18, marginBottom: 24 },
  statNum: { fontFamily: fonts.displayExtra, fontSize: 32, color: '#fff' },
  statLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  segment: {
    flexDirection: 'row',
    backgroundColor: c.surfaceAlt,
    borderRadius: 14,
    padding: 4,
    marginBottom: 24,
  },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  segmentBtnOn: { backgroundColor: c.accent },
  segmentText: { fontSize: 14, fontWeight: '700', color: c.grayMid },
  segmentTextOn: { color: '#fff' },
  section: { fontFamily: fonts.display, fontSize: 17, color: c.ink, marginBottom: 10 },
  group: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 15 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: c.border },
  rowText: { flex: 1, fontSize: 15, fontWeight: '600', color: c.ink },
  rowRight: { fontSize: 14, fontWeight: '600', color: c.grayMid },
  chevron: { fontSize: 20, color: c.gray },
  deleteText: { color: '#DC2626' },
  logout: { marginTop: 4, alignItems: 'center', paddingVertical: 14 },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#B91C1C' },
  apiHint: { fontSize: 11, color: c.grayMid, textAlign: 'center', marginTop: 16 },
});
