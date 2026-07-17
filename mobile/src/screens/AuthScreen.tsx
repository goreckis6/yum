import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path, ClipPath, Rect, Defs, G } from 'react-native-svg';
import { Icon } from '../components/Icon';
import { Wordmark } from '../components/Wordmark';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { useI18n } from '../i18n/I18nContext';

interface Props {
  onBack?: () => void;
}

type EmailMode = 'in' | 'up';

export function AuthScreen({ onBack }: Props) {
  const c = useTheme();
  const { t } = useI18n();
  const styles = makeStyles(c);
  const insets = useSafeAreaInsets();
  const { signIn, signUp, signInWithGoogle, signInWithApple } = useAuth();

  const [showEmail, setShowEmail] = useState(false);
  const [emailMode, setEmailMode] = useState<EmailMode>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'google' | 'apple' | 'email' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleGoogle = async () => {
    setError(null);
    setBusy('google');
    const res = await signInWithGoogle();
    setBusy(null);
    if (res.error) setError(res.error);
  };

  const handleApple = async () => {
    setError(null);
    setBusy('apple');
    const res = await signInWithApple();
    setBusy(null);
    if (res.error) setError(res.error);
  };

  const handleEmail = async () => {
    setError(null);
    setNotice(null);
    if (!email.trim() || password.length < 6) {
      setError('Enter your email and a password (min 6 characters).');
      return;
    }
    setBusy('email');
    const res = emailMode === 'in'
      ? await signIn(email, password)
      : await signUp(email, password);
    setBusy(null);
    if (res.error) { setError(res.error); return; }
    if (emailMode === 'up' && 'needsConfirm' in res && res.needsConfirm) {
      setNotice('Check your inbox to confirm your email, then sign in.');
      setEmailMode('in');
    }
  };

  const anyBusy = busy !== null;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: c.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.inner, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {onBack && (
          <Pressable onPress={onBack} style={styles.backBtn} hitSlop={10}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
        )}

        <Image source={require('../../assets/logo-mark.png')} style={styles.logo} resizeMode="contain" />
        <Wordmark color={c.ink} size={32} style={{ marginBottom: 4, textAlign: 'center' }} />
        <Text style={styles.subtitle}>{t('auth.welcome')}</Text>

        {!isSupabaseConfigured && (
          <Text style={styles.warn}>
            Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to mobile/.env.
          </Text>
        )}

        {/* Google */}
        <Pressable
          style={[styles.socialBtn, styles.googleBtn, anyBusy && styles.btnDisabled]}
          onPress={handleGoogle}
          disabled={anyBusy}
        >
          {busy === 'google' ? (
            <ActivityIndicator color="#444" />
          ) : (
            <>
              <GoogleLogo />
              <Text style={styles.googleText}>Continue with Google</Text>
            </>
          )}
        </Pressable>

        {/* Apple — iOS only (Apple Developer account + Sign In with Apple set up) */}
        {Platform.OS === 'ios' && (
          <Pressable
            style={[styles.socialBtn, styles.appleBtn, anyBusy && styles.btnDisabled]}
            onPress={handleApple}
            disabled={anyBusy}
          >
            {busy === 'apple' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Icon name="apple" size={18} color="#fff" />
                <Text style={styles.appleText}>Continue with Apple</Text>
              </>
            )}
          </Pressable>
        )}

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.divLine} />
          <Text style={styles.divText}>or</Text>
          <View style={styles.divLine} />
        </View>

        {/* Email toggle */}
        {!showEmail ? (
          <Pressable
            style={[styles.socialBtn, styles.emailBtn]}
            onPress={() => setShowEmail(true)}
          >
            <Text style={styles.emailIcon}>✉</Text>
            <Text style={styles.emailText}>Continue with Email</Text>
          </Pressable>
        ) : (
          <View style={styles.emailForm}>
            <View style={styles.modeTabs}>
              <Pressable
                style={[styles.modeTab, emailMode === 'in' && styles.modeTabOn]}
                onPress={() => { setEmailMode('in'); setError(null); setNotice(null); }}
              >
                <Text style={[styles.modeTabText, emailMode === 'in' && styles.modeTabTextOn]}>
                  Sign In
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modeTab, emailMode === 'up' && styles.modeTabOn]}
                onPress={() => { setEmailMode('up'); setError(null); setNotice(null); }}
              >
                <Text style={[styles.modeTabText, emailMode === 'up' && styles.modeTabTextOn]}>
                  Sign Up
                </Text>
              </Pressable>
            </View>

            <TextInput
              style={styles.field}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={c.gray}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              inputMode="email"
            />
            <TextInput
              style={styles.field}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={c.gray}
              secureTextEntry
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}

            <Pressable
              style={[styles.submitBtn, (anyBusy) && styles.btnDisabled]}
              onPress={handleEmail}
              disabled={anyBusy}
            >
              {busy === 'email' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>
                  {emailMode === 'in' ? 'Sign In' : 'Create Account'}
                </Text>
              )}
            </Pressable>
          </View>
        )}

        {error && !showEmail ? <Text style={[styles.error, { marginTop: 12 }]}>{error}</Text> : null}

        <Text style={styles.legal}>
          By continuing you agree to our Terms of Service and Privacy Policy.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function GoogleLogo() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48">
      <Defs>
        <ClipPath id="clip">
          <Rect width={48} height={48} />
        </ClipPath>
      </Defs>
      <G clipPath="url(#clip)">
        <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </G>
    </Svg>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1 },
  inner: { paddingHorizontal: 24 },

  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: 28,
  },
  backIcon: { fontSize: 22, color: c.ink, marginTop: -2 },

  logo: { width: 72, height: 72, marginBottom: 12, alignSelf: 'center' },
  subtitle: { fontSize: 15, fontWeight: '500', color: c.grayMuted, marginBottom: 32, textAlign: 'center' },

  warn: {
    fontSize: 13, fontWeight: '600', color: '#B45309',
    backgroundColor: c.warning, padding: 12, borderRadius: 12, marginBottom: 20,
  },

  socialBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, borderRadius: 16, paddingVertical: 15, marginBottom: 12,
  },
  btnDisabled: { opacity: 0.55 },

  googleBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E5E5' },
  googleText: { fontSize: 15, fontWeight: '700', color: '#1F1F1F' },

  appleBtn: { backgroundColor: '#000' },
  appleText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4, marginBottom: 12 },
  divLine: { flex: 1, height: 1, backgroundColor: c.border },
  divText: { fontSize: 13, fontWeight: '600', color: c.grayMid },

  emailBtn: { backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.border },
  emailIcon: { fontSize: 16, color: c.ink },
  emailText: { fontSize: 15, fontWeight: '700', color: c.ink },

  emailForm: {
    backgroundColor: c.surface, borderRadius: 18,
    borderWidth: 1, borderColor: c.border,
    padding: 16, marginBottom: 8,
  },
  modeTabs: { flexDirection: 'row', backgroundColor: c.surfaceAlt, borderRadius: 12, padding: 3, marginBottom: 16 },
  modeTab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 10 },
  modeTabOn: { backgroundColor: c.accent },
  modeTabText: { fontSize: 14, fontWeight: '700', color: c.grayMid },
  modeTabTextOn: { color: '#fff' },

  field: {
    backgroundColor: c.bg, borderRadius: 12,
    paddingVertical: 13, paddingHorizontal: 14,
    fontSize: 15, fontWeight: '500', color: c.ink,
    marginBottom: 10, borderWidth: 1, borderColor: c.border,
  },
  error: { fontSize: 13, fontWeight: '600', color: c.dangerText, marginBottom: 8 },
  notice: { fontSize: 13, fontWeight: '600', color: '#15803D', marginBottom: 8 },

  submitBtn: {
    backgroundColor: c.accent, borderRadius: 13,
    paddingVertical: 14, alignItems: 'center', marginTop: 4,
  },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  legal: {
    fontSize: 12, fontWeight: '500', color: c.grayMid,
    textAlign: 'center', lineHeight: 18, marginTop: 24,
  },
});
