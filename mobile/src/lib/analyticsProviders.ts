// The single place where real analytics/crash providers get turned on.
//
// PostHog is wired in below. It only actually starts when EXPO_PUBLIC_POSTHOG_KEY
// is set in mobile/.env — no key means the app keeps using the dev console sink
// (see analytics.ts), so it still runs fine in Expo Go / without an account.
// The env-key guard mirrors how RevenueCat is handled (PremiumContext.tsx).
//
// See mobile/docs/ANALYTICS_SETUP.md for the account setup + Sentry steps.

import PostHog from 'posthog-react-native';
import { AnalyticsProps, setAnalyticsSink } from './analytics';

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '';
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

let posthog: PostHog | null = null;

// PostHog's property type rejects `undefined` values, so drop any before sending.
function clean(props?: AnalyticsProps): Record<string, string | number | boolean | null> | undefined {
  if (!props) return undefined;
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

// Call once, as early as possible in App startup.
export function initAnalytics() {
  if (POSTHOG_KEY && !posthog) {
    posthog = new PostHog(POSTHOG_KEY, { host: POSTHOG_HOST });
    setAnalyticsSink({
      track: (event, props) => posthog?.capture(event, clean(props)),
      identify: (userId, traits) => posthog?.identify(userId, clean(traits)),
      reset: () => posthog?.reset(),
    });
    if (__DEV__) console.log('📊 PostHog enabled →', POSTHOG_HOST);
  } else if (!POSTHOG_KEY && __DEV__) {
    console.log('📊 No EXPO_PUBLIC_POSTHOG_KEY — analytics stays in the dev console.');
  }

  if (SENTRY_DSN) {
    // ── To enable Sentry (crash reporting) ─────────────────────────────
    // 1. `npx expo install @sentry/react-native`
    // 2. Add the Sentry Expo config plugin to app.json (see ANALYTICS_SETUP.md).
    // 3. Uncomment:
    //
    // const Sentry = require('@sentry/react-native');
    // Sentry.init({ dsn: SENTRY_DSN, tracesSampleRate: 0.2 });
    // 4. Rebuild: `npx expo run:ios`
    if (__DEV__) console.log('📊 Sentry DSN present — uncomment the block in analyticsProviders.ts to enable it.');
  }
}
