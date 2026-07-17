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

// Chef's toque for the loading state — the supplied SVG icon rendered as a
// single theme colour (c.ink) so it's a dark outline on the light (cream) bg and
// turns white in dark mode. Only the icon's outline/detail paths are used (its
// white fill + grey shading are dropped) to keep it clean line-art. It bounces
// (see the Animated wrapper below) while the recipe is analysed.
function ChefHat({ c }: { c: ThemeColors }) {
  return (
    <Svg width={110} height={110} viewBox="0 0 481.04 481.04">
      {/* band with fold slits */}
      <Path
        fill={c.ink}
        d="M351.04,232.68h-224c-4.424,0-8,3.584-8,8v216c0,13.232,10.768,24,24,24h192c13.232,0,24-10.768,24-24v-216C359.04,236.264,355.464,232.68,351.04,232.68z M343.04,456.68c0,4.408-3.584,8-8,8h-192c-4.416,0-8-3.592-8-8v-24h184c4.424,0,8-3.584,8-8s-3.576-8-8-8h-16v-48c0-4.416-3.576-8-8-8s-8,3.584-8,8v48h-40v-48c0-4.416-3.576-8-8-8s-8,3.584-8,8v48h-40v-48c0-4.416-3.576-8-8-8s-8,3.584-8,8v48h-40v-168h208V456.68z"
      />
      {/* puffy top outline */}
      <Path
        fill={c.ink}
        d="M368.56,46.68c-6.992,0-14.016,0.704-21.352,2.136C319.808,17.96,280.72,0.36,239.2,0.36c-41.088,0-80.048,17.432-107.592,47.992c-6.432-1.112-12.816-1.672-19.048-1.672C50.488,46.68,0,97.136,0,159.16c0,62.064,50.496,112.56,112.56,112.56c15.648,0,30.832-3.248,45.184-9.656c24.192,16.544,52.248,25.256,81.448,25.256c29.728,0,58.144-8.944,82.488-25.912c14.832,6.84,30.568,10.312,46.88,10.312c62.024,0,112.48-50.496,112.48-112.56C481.04,97.136,430.584,46.68,368.56,46.68z M368.56,255.72c-15.384,0-30.192-3.608-44.024-10.712c-2.704-1.392-5.992-1.12-8.448,0.704c-22.424,16.752-49.016,25.608-76.896,25.608c-27.36,0-53.608-8.624-75.904-24.936c-1.4-1.016-3.056-1.544-4.728-1.544c-1.208,0-2.432,0.28-3.56,0.832c-13.408,6.664-27.688,10.04-42.44,10.04c-53.24,0-96.56-43.32-96.56-96.56c0-53.2,43.32-96.48,96.56-96.48c6.592,0,13.416,0.744,20.296,2.208c7.872,4.392,36.304,22.496,34.048,53.864c-0.32,4.408,3,8.24,7.408,8.552c0.192,0.008,0.384,0.016,0.576,0.016c4.16,0,7.672-3.216,7.968-7.424c2.44-33.84-21.584-55.28-35.448-64.752C171.64,30.472,204.512,16.36,239.2,16.36c34.832,0,67.64,14.04,91.712,38.648c-13.808,9.12-38.544,30.448-36.088,65.192c0.296,4.216,3.808,7.44,7.968,7.44c0.184,0,0.384-0.008,0.568-0.016c4.408-0.312,7.728-4.136,7.416-8.544c-2.184-31.024,24.952-48.736,33.408-53.48c0.624,0.008,1.256-0.024,1.888-0.168c7.88-1.848,15.232-2.752,22.496-2.752c53.192,0,96.48,43.28,96.48,96.48C465.04,212.4,421.76,255.72,368.56,255.72z"
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
