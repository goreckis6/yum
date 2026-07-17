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
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
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

// Chef's toque for the loading state — the supplied vector (dark-1.svg) as a
// single path, tinted with the theme ink so it's dark on the light (cream) bg
// and white in dark mode. It bounces (see the Animated wrapper below) while the
// recipe is analysed.
function ChefHat({ c }: { c: ThemeColors }) {
  return (
    <Svg width={106} height={106} viewBox="0 0 481 481">
      <G transform="translate(0,481) scale(0.1,-0.1)" fill={c.ink}>
        <Path d="M2245 4790 c-317 -35 -610 -170 -845 -388 l-85 -79 -137 5 c-167 6 -268 -8 -408 -54 -478 -159 -789 -610 -767 -1114 15 -336 179 -648 446 -851 86 -65 264 -153 372 -183 86 -25 238 -46 323 -46 l46 0 2 -957 3 -958 22 -40 c11 -22 34 -52 50 -67 64 -61 6 -58 1123 -58 1117 0 1059 -3 1124 58 16 15 39 50 52 77 l24 50 0 952 0 952 48 -6 c69 -8 249 14 350 43 103 29 247 96 333 155 149 101 291 266 372 431 325 664 -62 1449 -788 1599 -97 20 -303 25 -385 10 l-44 -9 -93 88 c-254 243 -577 379 -938 394 -66 2 -156 1 -200 -4z m415 -179 c228 -52 439 -160 595 -305 55 -51 58 -57 41 -67 -44 -27 -144 -120 -189 -175 -98 -121 -146 -240 -154 -384 -5 -87 -3 -97 17 -122 16 -21 30 -28 56 -28 34 0 74 28 74 53 3 143 23 224 75 312 67 111 210 236 291 256 383 90 796 -70 1014 -391 57 -84 107 -190 136 -287 35 -119 44 -320 20 -442 -38 -184 -117 -344 -237 -475 -85 -92 -174 -158 -294 -217 -262 -127 -546 -130 -827 -8 -41 18 -73 26 -85 22 -10 -4 -54 -30 -98 -59 -217 -140 -440 -206 -700 -206 -273 1 -501 70 -726 219 -76 50 -77 50 -177 8 -127 -53 -205 -68 -362 -69 -178 0 -277 21 -426 94 -252 123 -427 329 -510 605 -25 83 -28 104 -28 260 0 195 15 269 84 413 70 147 151 249 274 348 195 156 452 231 700 204 90 -10 107 -15 156 -47 118 -78 221 -198 263 -307 11 -30 22 -92 27 -150 6 -86 10 -102 29 -118 31 -24 64 -23 97 5 35 31 42 97 20 208 -33 161 -134 321 -275 433 -33 27 -61 54 -60 60 0 6 31 38 70 71 183 157 404 259 649 300 114 19 345 12 460 -14z m677 -2465 l92 -31 1 -958 0 -958 -25 -24 -24 -25 -981 0 c-1042 0 -1026 -1 -1044 45 -3 9 -6 77 -6 151 l0 134 939 0 940 0 20 26 c28 35 26 69 -4 99 -22 23 -32 25 -120 25 l-95 0 0 255 0 256 -25 24 c-29 30 -74 32 -106 6 -24 -19 -24 -20 -27 -280 l-3 -261 -199 0 -200 0 0 255 0 256 -25 24 c-29 30 -74 32 -106 6 -24 -19 -24 -20 -27 -280 l-3 -261 -199 0 -200 0 0 255 0 256 -25 24 c-29 30 -74 32 -106 6 -24 -19 -24 -20 -27 -280 l-3 -261 -199 0 -200 0 0 738 0 737 115 37 115 37 67 -41 c139 -85 312 -151 480 -185 135 -27 415 -24 550 5 174 38 390 126 503 206 20 14 42 22 50 19 8 -4 56 -20 107 -37z" />
      </G>
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
      <Text style={styles.chefName}>Chef YumiShare</Text>
      <Text style={styles.chefMsg}>{t('processing.chefAnalyzing')}</Text>
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
    // "Chef YumiShare" — the brand line, set in the display face.
    chefName: {
      fontFamily: fonts.display,
      fontSize: 22,
      color: c.ink,
      textAlign: 'center',
    },
    // "is analyzing your recipe…" — a lighter, quieter second line under it.
    chefMsg: {
      fontSize: 15,
      fontWeight: '400',
      color: c.grayMid,
      textAlign: 'center',
      marginTop: 5,
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
