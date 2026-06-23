import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { Icon } from '../components/Icon';
import { useI18n } from '../i18n/I18nContext';

export function AuthScreen() {
  const c = useTheme();
  const { t } = useI18n();
  const styles = makeStyles(c);
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setNotice(null);
    if (!email.trim() || password.length < 6) {
      setError('Enter an email and a password (min 6 characters).');
      return;
    }
    setBusy(true);
    const res = mode === 'in' ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (mode === 'up' && 'needsConfirm' in res && res.needsConfirm) {
      setNotice('Check your inbox to confirm your email, then sign in.');
      setMode('in');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.inner, { paddingTop: insets.top + 40 }]}>
        <View style={styles.logo}>
          <Icon name="logo" size={30} color="#fff" />
        </View>
        <Text style={styles.brand}>YumShare</Text>
        <Text style={styles.subtitle}>
          {mode === 'in' ? t('auth.welcome') : t('auth.signUp')}
        </Text>

        {!isSupabaseConfigured && (
          <Text style={styles.warn}>
            Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to mobile/.env.
          </Text>
        )}

        <Text style={styles.label}>{t('auth.email')}</Text>
        <TextInput
          style={styles.field}
          value={email}
          onChangeText={setEmail}
          placeholder={t('auth.emailPlaceholder')}
          placeholderTextColor={c.gray}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          inputMode="email"
        />

        <Text style={styles.label}>{t('auth.password')}</Text>
        <TextInput
          style={styles.field}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={c.gray}
          secureTextEntry
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <Pressable style={[styles.submit, busy && styles.submitBusy]} onPress={submit} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>{mode === 'in' ? t('auth.signIn') : t('auth.signUp')}</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.switch}
          onPress={() => {
            setMode(mode === 'in' ? 'up' : 'in');
            setError(null);
            setNotice(null);
          }}
        >
          <Text style={styles.switchText}>
            {mode === 'in' ? t('auth.noAccount') : t('auth.haveAccount')}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  inner: { flex: 1, paddingHorizontal: 24 },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  brand: { fontFamily: fonts.displayExtra, fontSize: 32, color: c.ink, letterSpacing: -0.6 },
  subtitle: { fontSize: 15, fontWeight: '500', color: c.grayMuted, marginTop: 6, marginBottom: 28 },
  warn: { fontSize: 13, fontWeight: '600', color: '#B45309', backgroundColor: '#FEF3C7', padding: 12, borderRadius: 12, marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '700', color: c.grayMid, marginBottom: 6 },
  field: {
    backgroundColor: c.surface,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    fontWeight: '500',
    color: c.ink,
    marginBottom: 16,
  },
  error: { fontSize: 13, fontWeight: '600', color: '#DC2626', marginBottom: 12 },
  notice: { fontSize: 13, fontWeight: '600', color: '#15803D', marginBottom: 12 },
  submit: {
    backgroundColor: c.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBusy: { opacity: 0.7 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  switch: { alignItems: 'center', paddingVertical: 18 },
  switchText: { fontSize: 14, fontWeight: '700', color: c.ink },
});
