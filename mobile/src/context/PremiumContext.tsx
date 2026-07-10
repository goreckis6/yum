import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';
import { useAuth } from './AuthContext';

const RC_KEY =
  Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_RC_IOS_KEY ?? ''
    : process.env.EXPO_PUBLIC_RC_ANDROID_KEY ?? '';

// Single premium tier: ANY active RevenueCat entitlement unlocks it. We don't
// hard-code a specific identifier, so a rename or a mismatch between the
// dashboard's identifier and its display name can't silently break unlocking.

// react-native-purchases is a native module that does NOT exist in Expo Go —
// calling Purchases.configure() there crashes the app. appOwnership === 'expo'
// is true ONLY inside Expo Go; a dev/standalone build reports null.
const IS_EXPO_GO = Constants.appOwnership === 'expo';

// When we can't talk to RevenueCat — Expo Go (no native module) or no API key —
// treat the user as a FREE account (not premium). The app is freemium: everyone
// gets free import credits and the paywall / 3-day trial is the upsell, so
// there's nothing to "unlock" locally. Backend has its own PREMIUM_ENFORCEMENT.
const BYPASS = IS_EXPO_GO || !RC_KEY;

interface PurchaseResult {
  error?: string;
  cancelled?: boolean;
}

interface PremiumContextValue {
  isPremium: boolean;
  isLoading: boolean;
  // True once the FIRST subscription resolution has finished. The app Gate
  // waits on this — NOT on isLoading — so later refreshes (e.g. opening the
  // paywall) don't blank the whole app and tear down navigation.
  initialized: boolean;
  offering: PurchasesOffering | null;
  managementURL: string | null;
  purchase: (pkg: PurchasesPackage) => Promise<PurchaseResult>;
  restore: () => Promise<{ error?: string }>;
  refresh: () => Promise<void>;
}

const PremiumContext = createContext<PremiumContextValue | null>(null);

// Guard so we only call Purchases.configure once across remounts.
let configured = false;

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // Default to FREE (not premium); only a live RevenueCat entitlement flips this.
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(!BYPASS);
  // In BYPASS there's nothing to resolve, so we're initialized immediately.
  const [initialized, setInitialized] = useState(BYPASS);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [managementURL, setManagementURL] = useState<string | null>(null);

  const applyInfo = useCallback((info: CustomerInfo) => {
    setIsPremium(Object.keys(info.entitlements.active).length > 0);
    setManagementURL(info.managementURL ?? null);
  }, []);

  const refresh = useCallback(async () => {
    if (BYPASS) {
      setIsPremium(false); // free account in dev / Expo Go
      setIsLoading(false);
      setInitialized(true);
      return;
    }
    setIsLoading(true);
    try {
      const info = await Purchases.getCustomerInfo();
      applyInfo(info);
      const offerings = await Purchases.getOfferings();
      const current = offerings.current ?? null;
      setOffering(current);
      if (__DEV__) {
        // If this logs 0 packages, the products aren't fetchable from the
        // store yet (wrong product IDs, still "Missing Metadata", or not in
        // the current offering) — the paywall shows the retry state.
        console.log(
          '[Premium] current offering:',
          current?.identifier ?? 'NONE',
          '| packages:',
          current?.availablePackages?.length ?? 0,
          current?.availablePackages?.map((p) => `${p.identifier}:${p.product.identifier}`) ?? [],
        );
      }
    } catch (e) {
      console.warn('[Premium] refresh failed', e);
    } finally {
      setIsLoading(false);
      setInitialized(true);
    }
  }, [applyInfo]);

  // Configure the SDK once and listen for entitlement changes.
  useEffect(() => {
    if (BYPASS) return;
    try {
      if (!configured) {
        if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
        Purchases.configure({ apiKey: RC_KEY });
        configured = true;
      }
    } catch (e) {
      console.warn('[Premium] configure failed', e);
      return;
    }
    Purchases.addCustomerInfoUpdateListener(applyInfo);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(applyInfo);
    };
  }, [applyInfo]);

  // Tie the RevenueCat identity to the Supabase user so backend lookups by
  // user id resolve the right subscriber.
  useEffect(() => {
    if (BYPASS) return;
    (async () => {
      try {
        if (user?.id) await Purchases.logIn(user.id);
        else await Purchases.logOut();
      } catch (e) {
        console.warn('[Premium] logIn/logOut failed', e);
      }
      await refresh();
    })();
  }, [user?.id, refresh]);

  const purchase = useCallback(
    async (pkg: PurchasesPackage): Promise<PurchaseResult> => {
      // No SDK configured (Expo Go / missing key) → don't call into the native
      // module (it throws "no singleton instance"); fail cleanly instead.
      if (BYPASS) return { error: 'Purchases are unavailable in this build.' };
      try {
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        applyInfo(customerInfo);
        return {};
      } catch (e: any) {
        if (e?.userCancelled) return { cancelled: true };
        return { error: e?.message ?? 'Purchase failed' };
      }
    },
    [applyInfo],
  );

  const restore = useCallback(async () => {
    if (BYPASS) return { error: 'Purchases are unavailable in this build.' };
    try {
      const info = await Purchases.restorePurchases();
      applyInfo(info);
      return {};
    } catch (e: any) {
      return { error: e?.message ?? 'Restore failed' };
    }
  }, [applyInfo]);

  return (
    <PremiumContext.Provider
      value={{ isPremium, isLoading, initialized, offering, managementURL, purchase, restore, refresh }}
    >
      {children}
    </PremiumContext.Provider>
  );
}

export function usePremium() {
  const ctx = useContext(PremiumContext);
  if (!ctx) throw new Error('usePremium must be used within PremiumProvider');
  return ctx;
}
