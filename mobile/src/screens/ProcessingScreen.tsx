import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
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

// Classic chef's toque for the loading state — line-art: a tall, wavy puffy cap
// overhanging a flared, pleated band (matching the reference art). Black (ink)
// outline so it adapts per theme; the pleats + fold ticks are the brick accent.
// It bounces (see the Animated wrapper below) while the recipe is analysed.
function ChefHat({ c }: { c: ThemeColors }) {
  return (
    <Svg width={118} height={106} viewBox="0 0 120 108">
      {/* puffy cap — bumpy dome overhanging the band, outline only */}
      <Path
        d="M42 68 C24 70 12 61 16 46 C9 39 15 26 28 28 C26 15 43 11 53 20 C57 11 78 9 83 23 C97 22 108 33 101 47 C104 61 92 70 78 68 C66 65 54 65 42 68 Z"
        fill="none"
        stroke={c.ink}
        strokeWidth={3.6}
        strokeLinejoin="round"
      />
      {/* band — flared, rounded base, outline only */}
      <Path
        d="M42 68 L78 68 C81 77 84 81 87 86 C89 90 85 92 80 92 L40 92 C35 92 31 90 33 86 C36 81 39 77 42 68 Z"
        fill="none"
        stroke={c.ink}
        strokeWidth={3.6}
        strokeLinejoin="round"
      />
      {/* brick accents — band pleats + centre fold ticks */}
      <Path
        d="M50 74 v14 M60 73 v15 M70 74 v14"
        stroke={c.accent}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
      <Path
        d="M55 63 l2.5 4 M65 63 l-2.5 4"
        stroke={c.accent}
        strokeWidth={2.4}
        strokeLinecap="round"
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
          const makeDraft = (): Recipe => ({
            id: `imp${Date.now()}`,
            title: recipe?.title ?? '',
            time: recipe?.time ?? 30,
            servings: recipe?.servings ?? 4,
            rating: recipe?.rating ?? '0',
            app: recipe?.app ?? 'manual',
            handle: recipe?.handle ?? '',
            tint: recipe?.tint ?? '#F97316',
            sourceTint: recipe?.sourceTint ?? '#F97316',
            kcal: recipe?.kcal ?? 0,
            p: recipe?.p ?? 0,
            c: recipe?.c ?? 0,
            f: recipe?.f ?? 0,
            tags: recipe?.tags ?? [],
            ingredients: recipe?.ingredients ?? [],
            steps: recipe?.steps ?? [],
            cover: recipe?.cover ?? COVER_PRESETS[0].id,
            imageUrl: recipe?.imageUrl,
            sourceUrl: recipe?.sourceUrl,
          });

          // "Scan a recipe" (photo) skips the is-it-a-recipe gate entirely —
          // whatever the photo produced goes straight into the editor. The
          // gate only guards link imports, where a random URL can be anything.
          if (isImageMode) {
            navigation.replace('ReviewImport', { draft: makeDraft(), manual: true });
            return;
          }

          track('import_failed', { source: importSource, reason: 'notfound' });
          // Link import: don't hard-block either — ask whether to import anyway
          // and finish by hand.
          Alert.alert(
            t('processing.notRecipeTitle' as TKey),
            t('processing.notRecipeBody' as TKey),
            [
              {
                text: t('processing.notRecipeCancel' as TKey),
                style: 'cancel',
                onPress: () => { setIsNetErr(false); setError('notfound'); },
              },
              {
                text: t('processing.notRecipeImport' as TKey),
                onPress: () => navigation.replace('ReviewImport', { draft: makeDraft(), manual: true }),
              },
            ],
          );
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
