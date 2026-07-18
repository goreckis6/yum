import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Surfaced early so a missing .env is obvious rather than a cryptic auth error.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Set them in mobile/.env (see SETUP.md).',
  );
}

// Fall back to harmless placeholders when unconfigured so createClient doesn't
// throw at import time; isSupabaseConfigured gates all real calls.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
  auth: {
    // Session persisted in AsyncStorage. (An encrypted SecureStore-backed adapter
    // was tried but pulled in the expo-secure-store native module, which crashed
    // at startup when it wasn't in the build — reverted for reliability.)
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

// Keep the auth token fresh while the app is foregrounded (Supabase RN guidance).
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

// The OAuth callback (…/auth/callback?code=…) can arrive twice: once captured by
// the in-app auth session (performOAuth) and once via the OS deep link handler.
// A PKCE code is single-use, so exchanging it twice makes the second call fail
// and can clobber the freshly-created session. Dedupe by code so only the first
// exchange runs; later calls with the same code are no-ops.
const exchangedCodes = new Set<string>();
export async function exchangeOAuthCodeOnce(code: string): Promise<{ error?: string }> {
  if (!code || exchangedCodes.has(code)) return {};
  exchangedCodes.add(code);
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return { error: error?.message };
}
