import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { extractRecipeFromImage, extractRecipeFromUrl } from '../api/recipes';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { Recipe } from '../types';
import { RootStackParamList } from '../navigation/types';
import { useI18n } from '../i18n/I18nContext';
import type { TKey } from '../i18n/translations';
import { COVER_PRESETS } from '../components/CoverArt';
import { useApp } from '../context/AppContext';
import { LOW_CREDITS_WARNING } from '../config/credits';
import { track } from '../lib/analytics';

type Props = NativeStackScreenProps<RootStackParamList, 'Processing'>;

// A friendly, on-brand illustration (plate + cutlery over soft blobs) for the
// fallback screen — replaces a bare error message when extraction fails.
function FallbackArt({ c }: { c: ThemeColors }) {
  return (
    <Svg width={200} height={140} viewBox="0 0 200 140">
      <Ellipse cx="54" cy="98" rx="30" ry="23" fill={c.gold} opacity={0.5} />
      <Ellipse cx="150" cy="92" rx="34" ry="26" fill={c.sage} opacity={0.4} />
      <Circle cx="100" cy="68" r="46" fill={c.surface} stroke={c.border} strokeWidth={2} />
      <Circle cx="100" cy="68" r="33" fill="none" stroke={c.border} strokeWidth={1.5} />
      {/* fork */}
      <Path d="M85 50 v11 M91 50 v11 M97 50 v11" stroke={c.accent} strokeWidth={3} strokeLinecap="round" />
      <Path d="M91 61 v26" stroke={c.accent} strokeWidth={3.5} strokeLinecap="round" />
      {/* knife */}
      <Path d="M112 50 c7 3 7 15 1 21" stroke={c.accent} strokeWidth={3} strokeLinecap="round" fill="none" />
      <Path d="M113 71 v16" stroke={c.accent} strokeWidth={3.5} strokeLinecap="round" />
    </Svg>
  );
}

// On-brand chef's toque for the loading state — a white puffy hat with an
// accent band. It bounces (see the Animated wrapper below) while the recipe is
// being analysed.
function ChefHat({ c }: { c: ThemeColors }) {
  return (
    <Svg width={104} height={104} viewBox="0 0 104 104">
      {/* puffy top */}
      <Path
        d="M32 46 c-11 0 -18 -9 -15.5 -19 c1.7 -7.7 9 -12 15.5 -11 c1.2 -9 9 -14.5 20 -14.5 c11 0 18.8 5.5 20 14.5 c6.5 -1 13.8 3.3 15.5 11 c2.5 10 -4.5 19 -15.5 19 z"
        fill={c.surface}
        stroke={c.border}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {/* band */}
      <Path
        d="M33 46 h38 v13 c0 3.3 -2.7 6 -6 6 h-26 c-3.3 0 -6 -2.7 -6 -6 z"
        fill={c.accent}
      />
      {/* pleats */}
      <Path
        d="M44 47 v16 M52 47 v16 M60 47 v16"
        stroke="#fff"
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={0.35}
      />
    </Svg>
  );
}

export function ProcessingScreen({ navigation, route }: Props) {
  const c = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [error, setError] = useState<string | null>(null);
  const [isNetErr, setIsNetErr] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const { setCredits, showToast } = useApp();

  const isImageMode = 'imageBase64' in route.params;
  const importSource = isImageMode ? 'photo' : 'link';

  // Bouncing chef's hat while we work. Honours Reduce Motion (static hat + a
  // plain spinner instead).
  const jump = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => { if (mounted) setReduceMotion(v); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(jump, { toValue: 1, duration: 360, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(jump, { toValue: 0, duration: 420, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.delay(140),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [jump, reduceMotion]);
  const hatY = jump.interpolate({ inputRange: [0, 1], outputRange: [0, -18] });

  useEffect(() => {
    // Credits/premium are enforced server-side (the backend knows the real
    // subscription state via RevenueCat). We don't pre-empt with a client-side
    // paywall redirect here: isPremium can still be resolving when an import is
    // launched from the share sheet, which wrongly bounced premium users to the
    // paywall. A genuinely out-of-credits free user gets a 402 below (handled in
    // .catch), which costs no OpenAI call.
    track('import_started', { source: importSource });

    const work = isImageMode
      ? extractRecipeFromImage(
          (route.params as { imageBase64: string; mimeType: string }).imageBase64,
          (route.params as { imageBase64: string; mimeType: string }).mimeType,
        )
      : extractRecipeFromUrl((route.params as { url: string }).url);

    work
      .then((res) => {
        const recipe = res.recipe;
        // Guard against "not a recipe" results: the extractor (or the AI) can
        // return an empty shell when the link/photo has no real recipe in it —
        // e.g. a photo of a person, a landscape, or an unrelated screenshot.
        const noTitle = !recipe?.title?.trim();
        const noContent =
          (recipe?.ingredients?.length ?? 0) === 0 && (recipe?.steps?.length ?? 0) === 0;
        if (noTitle || noContent) {
          track('import_failed', { source: importSource, reason: 'notfound' });
          setIsNetErr(false);
          setError('notfound');
          return;
        }
        // The server already spent the credit for a real recipe — mirror its
        // authoritative balance (null = premium/unlimited, leave as-is).
        if (typeof res.credits === 'number') {
          setCredits(res.credits);
          // Warn once the free imports are running low, so hitting 0 isn't a
          // surprise (premium returns null credits, so this never fires there).
          if (res.credits > 0 && res.credits <= LOW_CREDITS_WARNING) {
            showToast(
              res.credits === 1
                ? t('credits.lowOne' as TKey)
                : t('credits.lowMany' as TKey, { n: res.credits }),
            );
          }
        }
        track('import_succeeded', {
          source: importSource,
          creditsLeft: typeof res.credits === 'number' ? res.credits : null,
        });
        const draft: Recipe = {
          ...recipe,
          id: `imp${Date.now()}`,
        };
        navigation.replace('ReviewImport', { draft });
      })
      .catch((err: Error & { code?: string }) => {
        if (err?.code === 'no_credits') {
          track('import_failed', { source: importSource, reason: 'no_credits' });
          setCredits(0);
          navigation.replace('Paywall', { reason: 'out_of_credits' });
          return;
        }
        const m = err?.message || '';
        const net = /reach the server|timed out|network request failed|connection|network/i.test(m);
        track('import_failed', { source: importSource, reason: net ? 'network' : 'error' });
        setIsNetErr(net);
        setError(m || 'error');
      });
  }, []);

  // ── Fallback actions ──────────────────────────────────────────
  const goManual = () => {
    navigation.replace('ReviewImport', {
      manual: true,
      draft: {
        id: '', title: '', time: 30, servings: 4, rating: '0',
        app: 'manual', handle: '', tint: '#F97316', sourceTint: '#F97316',
        kcal: 0, p: 0, c: 0, f: 0, tags: [], ingredients: [], steps: [],
        cover: COVER_PRESETS[0].id,
      },
    });
  };
  const primaryAction = () => {
    if (isImageMode) navigation.goBack();            // try another photo
    else navigation.replace('ScanRecipe');           // import from screenshots
  };

  if (error) {
    const body = isNetErr
      ? t('processing.errorBodyNetwork')
      : isImageMode
        ? t('processing.errorBodyImage')
        : t('processing.errorBodyUrl');
    const primaryLabel = isNetErr
      ? t('processing.tryAgain')
      : isImageMode
        ? t('processing.tryPhoto')
        : t('processing.takeScreenshots');

    return (
      <View style={styles.container}>
        <FallbackArt c={c} />
        <Text style={styles.errTitle}>{t('processing.errorTitle')}</Text>
        <Text style={styles.errBody}>{body}</Text>

        <Pressable style={styles.primaryBtn} onPress={primaryAction}>
          <Text style={styles.primaryText}>{primaryLabel}</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={goManual}>
          <Text style={styles.secondaryText}>{t('processing.enterManually')}</Text>
        </Pressable>
        <Pressable style={styles.cancelBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.cancelText}>{t('processing.cancel')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.hatWrap, { transform: [{ translateY: hatY }] }]}>
        <ChefHat c={c} />
      </Animated.View>
      <Text style={styles.title}>{t('processing.chefAnalyzing')}</Text>
      {reduceMotion && (
        <ActivityIndicator color={c.accent} style={styles.spinner} />
      )}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    hatWrap: { marginBottom: 24 },
    spinner: { marginTop: 22 },
    title: {
      fontFamily: fonts.display,
      fontSize: 22,
      color: c.ink,
      textAlign: 'center',
    },

    // Fallback / error state
    errTitle: {
      fontFamily: fonts.display,
      fontSize: 32,
      color: c.accent,
      textAlign: 'center',
      marginTop: 18,
      marginBottom: 12,
    },
    errBody: {
      fontSize: 15,
      fontWeight: '500',
      lineHeight: 22,
      color: c.grayLight,
      textAlign: 'center',
      marginBottom: 28,
    },
    primaryBtn: {
      alignSelf: 'stretch',
      backgroundColor: c.accent,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
    },
    primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    secondaryBtn: {
      alignSelf: 'stretch',
      backgroundColor: c.bg,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 16,
      paddingVertical: 15,
      alignItems: 'center',
      marginTop: 12,
    },
    secondaryText: { color: c.ink, fontSize: 15, fontWeight: '700' },
    cancelBtn: { paddingVertical: 16, marginTop: 6 },
    cancelText: { fontSize: 14, fontWeight: '700', color: c.grayMid },
  });
