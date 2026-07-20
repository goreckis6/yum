import { supabase } from '../lib/supabase';

// Attach the caller's Supabase access token so the backend can verify the user
// (and their subscription) before running an expensive AI request.
//
// On a cold start the token persisted in AsyncStorage may already be expired
// (access tokens live ~1h), and getSession() hands back that stale token before
// background auto-refresh has run — so the FIRST request after launch 401s and
// only "works on the second try" once a refresh has landed. Guard against that
// by refreshing proactively whenever the token is missing or about to expire.
export async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  let session = data.session;

  // expires_at is a unix timestamp in seconds; refresh if it's within a small
  // skew window (or already gone) so we never send an expired token.
  const SKEW_SECONDS = 60;
  const expiresAt = session?.expires_at ?? 0;
  const expiringSoon = expiresAt > 0 && expiresAt - Date.now() / 1000 < SKEW_SECONDS;
  if (session && expiringSoon) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed.session) session = refreshed.session;
  }

  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Turn the backend's auth/subscription/rate-limit responses into friendly,
// user-facing errors.
export function mapApiError(status: number, body: { error?: string; limit?: number }): Error {
  if (status === 402 || body?.error === 'no_credits') {
    const e = new Error('no_credits');
    (e as Error & { code?: string }).code = 'no_credits';
    return e;
  }
  if (status === 401) return new Error('Please sign in again.');
  if (status === 403 && body?.error === 'premium_required') {
    return new Error('Your subscription is no longer active. Subscribe to use AI features.');
  }
  if (status === 429) {
    return new Error(
      `Daily AI limit reached${body?.limit ? ` (${body.limit})` : ''}. Please try again tomorrow.`,
    );
  }
  return new Error(body?.error || `Request failed (${status})`);
}
