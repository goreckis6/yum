// Lightweight, provider-agnostic analytics.
//
// WHY this shape: we never call a vendor SDK (PostHog, Amplitude, …) directly
// from screens. Screens only call `track('some_event')`. A single "sink" decides
// where those events actually go. Today the sink just prints to the Metro
// console in development (so you can literally watch your funnel while you use
// the app) and no-ops in production. The moment you create a PostHog/Amplitude
// account, you swap ONE function (`setAnalyticsSink`) — no screen changes.
//
// See mobile/docs/ANALYTICS_SETUP.md for how to turn on a real provider.

// The full funnel we care about for "will people subscribe?". Keeping these as
// a fixed list (not free-form strings) means a typo is a compile error and the
// event names stay consistent across the app.
export type AnalyticsEvent =
  | 'app_opened'
  | 'onboarding_completed'
  | 'signed_in'
  // Import funnel — the app's core "magic moment".
  | 'import_started' // { source: 'link' | 'photo' }
  | 'import_succeeded' // { source, creditsLeft }
  | 'import_failed' // { source, reason }
  | 'import_credit_spent' // { creditsLeft }
  // Monetisation funnel.
  | 'paywall_viewed' // { reason }
  | 'paywall_plan_selected' // { plan }
  | 'purchase_started' // { plan }
  | 'purchase_succeeded' // { plan }
  | 'purchase_failed' // { plan, reason }
  | 'purchase_cancelled' // { plan }
  | 'purchases_restored'
  // Engagement / retention signals.
  | 'recipe_cooked'
  | 'meal_planned'
  | 'meals_copied' // { count } — copy a day's meals to the next day
  | 'recipe_shared';

export type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

// A sink receives every event. Swap it to route events to a real provider.
export interface AnalyticsSink {
  track: (event: AnalyticsEvent, props?: AnalyticsProps) => void;
  identify: (userId: string, traits?: AnalyticsProps) => void;
  reset: () => void;
}

// Default sink: visible in dev (watch the funnel in the Metro logs), silent in
// production. This is what runs until you plug in PostHog/Sentry.
const consoleSink: AnalyticsSink = {
  track: (event, props) => {
    if (__DEV__) console.log(`📊 [analytics] ${event}`, props ?? {});
  },
  identify: (userId, traits) => {
    if (__DEV__) console.log(`📊 [analytics] identify ${userId}`, traits ?? {});
  },
  reset: () => {
    if (__DEV__) console.log('📊 [analytics] reset');
  },
};

let sink: AnalyticsSink = consoleSink;

// Called once at startup (from src/lib/analyticsProviders.ts) to point analytics
// at a real backend. If nothing calls this, the console sink stays.
export function setAnalyticsSink(next: AnalyticsSink) {
  sink = next;
}

// Fire-and-forget: analytics must never crash the app or block the UI, so every
// call is wrapped — a broken provider can't take a screen down with it.
export function track(event: AnalyticsEvent, props?: AnalyticsProps) {
  try {
    sink.track(event, props);
  } catch {
    /* analytics is best-effort */
  }
}

// Tie all events to a stable user id (so one person across sessions is one user
// in the dashboard, not many anonymous blips). Call on sign-in.
export function identify(userId: string, traits?: AnalyticsProps) {
  try {
    sink.identify(userId, traits);
  } catch {
    /* best-effort */
  }
}

// Call on sign-out so the next person on the device isn't merged with the last.
export function resetAnalytics() {
  try {
    sink.reset();
  } catch {
    /* best-effort */
  }
}
