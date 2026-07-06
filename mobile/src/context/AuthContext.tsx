import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../lib/supabase';
import { getApiBaseUrl } from '../config/api';

WebBrowser.maybeCompleteAuthSession();

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string; needsConfirm?: boolean }>;
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

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    console.log('[OAuth] result:', result.type);

    if (result.type !== 'success') return {};

    const url = (result as { type: 'success'; url: string }).url;
    console.log('[OAuth] callback url:', url.slice(0, 120));

    // PKCE flow — Supabase returns ?code=
    const qs = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
    const code = new URLSearchParams(qs).get('code');
    if (code) {
      console.log('[OAuth] exchanging code...');
      const { error: exchErr } = await supabase.auth.exchangeCodeForSession(code);
      if (exchErr) { console.log('[OAuth] exchange error:', exchErr.message); return { error: exchErr.message }; }
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitializing(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
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
      value={{ session, user: session?.user ?? null, initializing, signIn, signUp, signInWithGoogle, signInWithApple, signOut }}
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
