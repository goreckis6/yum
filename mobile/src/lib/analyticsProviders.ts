// The single place where real analytics/crash providers get turned on.
//
// Right now this is a no-op: events go to the dev console via the default sink
// (see analytics.ts). When you're ready to see real dashboards, follow
// mobile/docs/ANALYTICS_SETUP.md — create a PostHog and/or Sentry account, add
// the keys to mobile/.env as EXPO_PUBLIC_* vars, install the packages, and
// uncomment the blocks below. No screen code changes.
//
// The env-key guard mirrors how RevenueCat is handled (src/context/Premium
// Context.tsx): no key → the feature quietly stays off, so the app runs fine
// in Expo Go and in development without any accounts.

import { setAnalyticsSink } from './analytics';

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '';
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

// Call once, as early as possible in App startup.
export function initAnalytics() {
  if (POSTHOG_KEY) {
    // ── To enable PostHog ──────────────────────────────────────────────
    // 1. `npx expo install posthog-react-native expo-file-system expo-application expo-device expo-localization`
    // 2. Uncomment:
    //
    // const { PostHog } = require('posthog-react-native');
    // const client = new PostHog(POSTHOG_KEY, { host: POSTHOG_HOST });
    // setAnalyticsSink({
    //   track: (event, props) => client.capture(event, props),
    //   identify: (userId, traits) => client.identify(userId, traits),
    //   reset: () => client.reset(),
    // });
    // 3. Rebuild the dev client (adds a native module): `npx expo run:ios`
    if (__DEV__) console.log('📊 PostHog key present — uncomment the block in analyticsProviders.ts to enable it.');
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

  // Keep a reference so tree-shakers/linters don't drop the import while the
  // provider blocks are still commented out.
  void setAnalyticsSink;
}
