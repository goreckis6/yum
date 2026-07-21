import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase, exchangeOAuthCodeOnce } from '../lib/supabase';
import { getRecovering, setRecovering, subscribeRecovering } from '../lib/authRecovery';
import { getApiBaseUrl } from '../config/api';

WebBrowser.maybeCompleteAuthSession();

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  initializing: boolean;
  // True after the user opens a password-reset link — the app shows the
  // "set a new password" screen until updatePassword() succeeds.
  recovering: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string; needsConfirm?: boolean }>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  updatePassword: (password: string) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signInWithApple: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function performOAuth(provider: 'google' | 'apple'): Promise<{ error?: string }> {
  try {
    const redirectTo = Linking.createURL('auth/callback');
    console.log('[OAuth] redirectTo:', redirectTo);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data.url) return { error: error?.message ?? 'OAuth failed' };
    console.log('[OAuth] opening url:', data.url.slice(0, 80));

    // Share cookies with Safari (non-ephemeral) so Google can recognise this
    // device on later sign-ins and skip re-verifying (2FA code) every time. The
    // trade-off is a one-time iOS "…wants to use google.com to sign in" consent
    // dialog — worth it to stop asking a returning user for a code repeatedly.
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
      preferEphemeralSession: false,
    });
    console.log('[OAuth] result:', result.type);

    if (result.type !== 'success') return {};

    const url = (result as { type: 'success'; url: string }).url;
    console.log('[OAuth] callback url:', url.slice(0, 120));

    // PKCE flow — Supabase returns ?code=
    const qs = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
    const code = new URLSearchParams(qs).get('code');
    if (code) {
      console.log('[OAuth] exchanging code...');
      const { error: exchErr } = await exchangeOAuthCodeOnce(code);
      if (exchErr) { console.log('[OAuth] exchange error:', exchErr); return { error: exchErr }; }
      console.log('[OAuth] success!');
      return {};
    }

    // Implicit flow fallback — tokens in hash
    const hash = url.includes('#') ? url.split('#')[1] : '';
    const hp = new URLSearchParams(hash);
    const access_token = hp.get('access_token');
    const refresh_token = hp.get('refresh_token');
    if (!access_token) { console.log('[OAuth] no code or token found'); return {}; }

    const { error: sessErr } = await supabase.auth.setSession({ access_token, refresh_token: refresh_token ?? '' });
    if (sessErr) return { error: sessErr.message };
    return {};
  } catch (e: any) {
    return { error: e?.message ?? 'OAuth error' };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  // `recovering` is driven by a module-level flag (authRecovery) so the
  // top-level deep-link handler in App.tsx can set it. We also flip it on the
  // Supabase PASSWORD_RECOVERY event as a backup.
  const [recovering, setRecoveringState] = useState(getRecovering());

  useEffect(() => subscribeRecovering(setRecoveringState), []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitializing(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return { error: error?.message };
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) return { error: error.message };
    return { needsConfirm: !data.session };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: Linking.createURL('auth/reset'),
    });
    return { error: error?.message };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) setRecovering(false);
    return { error: error?.message };
  };

  const signInWithGoogle = () => performOAuth('google');

  const signInWithApple = async (): Promise<{ error?: string }> => {
    if (Platform.OS !== 'ios') return performOAuth('apple');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) return { error: 'No identity token from Apple' };
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) return { error: error.message };
      // Apple only returns the name on the FIRST authorization — persist it now
      // so the profile shows a real name instead of the email prefix.
      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(' ')
        .trim();
      if (fullName) {
        await supabase.auth.updateUser({ data: { full_name: fullName } }).catch(() => {});
      }
      // Hand the one-time authorizationCode to the backend so it can store a
      // refresh token and revoke the Apple authorization on account deletion
      // (App Store requirement). Best-effort — never block sign-in on this.
      if (credential.authorizationCode) {
        try {
          const { data: sess } = await supabase.auth.getSession();
          const token = sess.session?.access_token;
          if (token) {
            await fetch(`${getApiBaseUrl()}/api/apple/link`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                accessToken: token,
                authorizationCode: credential.authorizationCode,
              }),
            });
          }
        } catch {
          /* ignore — revocation just won't be available for this account */
        }
      }
      return {};
    } catch (e: any) {
      if (e?.code === 'ERR_REQUEST_CANCELED') return {};
      return { error: e?.message ?? 'Apple sign-in failed' };
    }
  };

  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, initializing, recovering, signIn, signUp, resetPassword, updatePassword, signInWithGoogle, signInWithApple, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
