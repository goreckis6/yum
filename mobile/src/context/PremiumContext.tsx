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

// Must match the entitlement identifier in the RevenueCat dashboard exactly.
const ENTITLEMENT = 'YumiSharev1';

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
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [managementURL, setManagementURL] = useState<string | null>(null);

  const applyInfo = useCallback((info: CustomerInfo) => {
    setIsPremium(!!info.entitlements.active[ENTITLEMENT]);
    setManagementURL(info.managementURL ?? null);
  }, []);

  const refresh = useCallback(async () => {
    if (BYPASS) {
      setIsPremium(false); // free account in dev / Expo Go
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const info = await Purchases.getCustomerInfo();
      applyInfo(info);
      const offerings = await Purchases.getOfferings();
      setOffering(offerings.current ?? null);
    } catch (e) {
      console.warn('[Premium] refresh failed', e);
    } finally {
      setIsLoading(false);
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
      value={{ isPremium, isLoading, offering, managementURL, purchase, restore, refresh }}
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
