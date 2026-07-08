import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PurchasesPackage } from 'react-native-purchases';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { usePremium } from '../context/PremiumContext';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { useI18n } from '../i18n/I18nContext';
import type { TKey } from '../i18n/translations';
import { track } from '../lib/analytics';
import { FREE_IMPORT_CREDITS } from '../config/credits';

type PaywallReason = 'out_of_credits' | 'upsell';

// Order + i18n label keys for the plan cards, keyed by RevenueCat packageType.
function planMeta(pkg: PurchasesPackage): { labelKey: TKey; best?: boolean; order: number } {
  switch (pkg.packageType) {
    case 'ANNUAL':
      return { labelKey: 'paywall.planYearly', best: true, order: 1 };
    case 'MONTHLY':
      return { labelKey: 'paywall.planMonthly', order: 0 };
    case 'LIFETIME':
      return { labelKey: 'paywall.planLifetime', order: 2 };
    default:
      return { labelKey: 'paywall.planMonthly', order: 3 };
  }
}

const PERK_KEYS: TKey[] = [
  'paywall.perkImport',
  'paywall.perkPlan',
  'paywall.perkPantry',
  'paywall.perkCook',
];

export function PaywallScreen({
  reason = 'upsell',
  onClose,
}: { reason?: PaywallReason; onClose?: () => void } = {}) {
  const c = useTheme();
  const styles = makeStyles(c);
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { signOut } = useAuth();
  const { recipes } = useApp();
  const { offering, isLoading, purchase, restore } = usePremium();

  // Sell the moment, not a feature list: someone who just hit the free-import
  // wall sees a very different headline than someone browsing Premium.
  const outOfCredits = reason === 'out_of_credits';
  const title = outOfCredits
    ? t('paywall.titleOutOfCredits' as TKey, { n: FREE_IMPORT_CREDITS })
    : t('paywall.titleUpsell' as TKey);
  const subtitle = outOfCredits
    ? t('paywall.subOutOfCredits' as TKey)
    : t('paywall.subUpsell' as TKey);

  const packages = useMemo(() => {
    const list = offering?.availablePackages ?? [];
    return [...list].sort((a, b) => planMeta(a).order - planMeta(b).order);
  }, [offering]);

  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fire once when the paywall is shown — this is the top of the purchase funnel.
  useEffect(() => {
    track('paywall_viewed', { reason });
  }, [reason]);

  // Default the selection to the annual plan (or the first available).
  const selectedPkg =
    packages.find((p) => p.identifier === selected) ??
    packages.find((p) => p.packageType === 'ANNUAL') ??
    packages[0] ??
    null;

  const planName = (pkg: PurchasesPackage | null) =>
    pkg ? pkg.packageType.toLowerCase() : 'none';

  const handlePurchase = async () => {
    if (!selectedPkg) return;
    setError(null);
    setBusy(true);
    track('purchase_started', { plan: planName(selectedPkg) });
    const res = await purchase(selectedPkg);
    setBusy(false);
    if (res.cancelled) track('purchase_cancelled', { plan: planName(selectedPkg) });
    else if (res.error) {
      track('purchase_failed', { plan: planName(selectedPkg), reason: res.error });
      setError(res.error);
    } else {
      track('purchase_succeeded', { plan: planName(selectedPkg) });
    }
  };

  const handleRestore = async () => {
    setError(null);
    setBusy(true);
    const res = await restore();
    setBusy(false);
    if (res.error) setError(res.error);
    else track('purchases_restored');
  };

  const isLifetime = selectedPkg?.packageType === 'LIFETIME';
  const cta = isLifetime ? t('paywall.ctaLifetime' as TKey) : t('paywall.ctaTrial' as TKey);
  const savedCount = recipes?.length ?? 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: c.bg }]}
      contentContainerStyle={[
        styles.inner,
        { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {onClose && (
        <Pressable style={[styles.closeBtn, { top: insets.top + 8 }]} onPress={onClose} hitSlop={10}>
          <Text style={styles.closeIcon}>✕</Text>
        </Pressable>
      )}
      <Image source={require('../../assets/logo-mark.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.brand}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.trialBadge}>
        <Text style={styles.trialText}>{t('paywall.trialBadge' as TKey)}</Text>
      </View>

      {/* Social proof of the value the user has already built up. */}
      {savedCount > 0 && (
        <Text style={styles.valueLine}>{t('paywall.valueRecipes' as TKey, { n: savedCount })}</Text>
      )}

      <View style={styles.perks}>
        {PERK_KEYS.map((k) => (
          <View key={k} style={styles.perkRow}>
            <Text style={styles.perkCheck}>✓</Text>
            <Text style={styles.perkText}>{t(k)}</Text>
          </View>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color={c.ink} style={{ marginVertical: 32 }} />
      ) : packages.length === 0 ? (
        <Text style={styles.empty}>{t('paywall.comingSoon' as TKey)}</Text>
      ) : (
        <View style={styles.plans}>
          {packages.map((pkg) => {
            const meta = planMeta(pkg);
            const on = selectedPkg?.identifier === pkg.identifier;
            return (
              <Pressable
                key={pkg.identifier}
                style={[styles.planCard, on && styles.planCardOn]}
                onPress={() => {
                  setSelected(pkg.identifier);
                  track('paywall_plan_selected', { plan: planName(pkg) });
                }}
              >
                <View style={styles.planLeft}>
                  <View style={[styles.radio, on && styles.radioOn]}>
                    {on && <View style={styles.radioDot} />}
                  </View>
                  <Text style={[styles.planLabel, on && styles.planLabelOn]}>{t(meta.labelKey)}</Text>
                  {meta.best && (
                    <View style={styles.bestBadge}>
                      <Text style={styles.bestText}>{t('paywall.bestValue' as TKey)}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.planPrice, on && styles.planLabelOn]}>
                  {pkg.product.priceString}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {packages.length > 0 && (
        <Pressable
          style={[styles.cta, busy && styles.ctaDisabled]}
          onPress={handlePurchase}
          disabled={busy || !selectedPkg}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>{cta}</Text>}
        </Pressable>
      )}

      <View style={styles.footer}>
        <Pressable onPress={handleRestore} disabled={busy} hitSlop={8}>
          <Text style={styles.footerLink}>{t('paywall.restore' as TKey)}</Text>
        </Pressable>
        <Text style={styles.footerDot}>·</Text>
        <Pressable onPress={() => signOut()} disabled={busy} hitSlop={8}>
          <Text style={styles.footerLink}>{t('paywall.signOut' as TKey)}</Text>
        </Pressable>
      </View>

      <Text style={styles.legal}>{t('paywall.legal' as TKey)}</Text>
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1 },
    inner: { paddingHorizontal: 24, alignItems: 'center' },
    closeBtn: {
      position: 'absolute', right: 18, zIndex: 10,
      width: 34, height: 34, borderRadius: 17,
      backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center',
    },
    closeIcon: { fontSize: 15, color: c.grayLight, fontWeight: '700' },

    logo: { width: 64, height: 64, marginBottom: 12 },
    brand: {
      fontFamily: fonts.displayExtra,
      fontSize: 28,
      color: c.ink,
      letterSpacing: -0.5,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 15,
      fontWeight: '500',
      color: c.grayLight,
      textAlign: 'center',
      lineHeight: 21,
      marginTop: 8,
      paddingHorizontal: 8,
    },
    trialBadge: {
      backgroundColor: c.accentSoft,
      borderRadius: 20,
      paddingVertical: 6,
      paddingHorizontal: 14,
      marginTop: 16,
      marginBottom: 20,
    },
    trialText: { fontSize: 13, fontWeight: '700', color: c.accent },
    valueLine: {
      alignSelf: 'stretch',
      fontSize: 13,
      fontWeight: '600',
      color: c.grayMid,
      textAlign: 'center',
      marginBottom: 20,
    },

    perks: { alignSelf: 'stretch', gap: 10, marginBottom: 28 },
    perkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    perkCheck: {
      fontSize: 13,
      fontWeight: '800',
      color: '#fff',
      backgroundColor: c.accent,
      width: 22,
      height: 22,
      borderRadius: 11,
      textAlign: 'center',
      lineHeight: 22,
      overflow: 'hidden',
    },
    perkText: { flex: 1, fontSize: 15, fontWeight: '500', color: c.ink },

    plans: { alignSelf: 'stretch', gap: 12, marginBottom: 16 },
    planCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: c.surface,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: c.border,
      paddingVertical: 16,
      paddingHorizontal: 16,
    },
    planCardOn: { borderColor: c.accent, backgroundColor: c.accentSoft },
    planLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: c.grayMid,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOn: { borderColor: c.accent },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.accent },
    planLabel: { fontSize: 16, fontWeight: '700', color: c.ink },
    planLabelOn: { color: c.accent },
    bestBadge: { backgroundColor: c.accent, borderRadius: 8, paddingVertical: 2, paddingHorizontal: 8 },
    bestText: { fontSize: 11, fontWeight: '800', color: '#fff' },
    planPrice: { fontSize: 16, fontWeight: '700', color: c.ink },

    empty: { fontSize: 15, fontWeight: '600', color: c.grayMuted, marginVertical: 32 },

    error: { fontSize: 13, fontWeight: '600', color: c.dangerText, marginBottom: 12, textAlign: 'center' },

    cta: {
      alignSelf: 'stretch',
      backgroundColor: c.accent,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 4,
    },
    ctaDisabled: { opacity: 0.6 },
    ctaText: { color: '#fff', fontSize: 16, fontWeight: '800' },

    footer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
    footerLink: { fontSize: 14, fontWeight: '700', color: c.grayMid },
    footerDot: { fontSize: 14, color: c.grayMid },

    legal: {
      fontSize: 11,
      fontWeight: '500',
      color: c.grayMid,
      textAlign: 'center',
      lineHeight: 17,
      marginTop: 20,
    },
  });
