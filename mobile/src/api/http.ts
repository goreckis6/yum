import { supabase } from '../lib/supabase';

// Attach the caller's Supabase access token so the backend can verify the user
// (and their subscription) before running an expensive AI request.
export async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
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
