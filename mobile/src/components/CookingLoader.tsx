import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { useI18n } from '../i18n/I18nContext';
import type { TKey } from '../i18n/translations';

// The supplied chef-hat vector (dark-1.svg) as a single path, tinted with the
// theme ink (dark on light, white in dark).
function ChefHat({ c }: { c: ThemeColors }) {
  return (
    <Svg width={106} height={106} viewBox="0 0 481 481">
      <G transform="translate(0,481) scale(0.1,-0.1)" fill={c.ink}>
        <Path d="M2245 4790 c-317 -35 -610 -170 -845 -388 l-85 -79 -137 5 c-167 6 -268 -8 -408 -54 -478 -159 -789 -610 -767 -1114 15 -336 179 -648 446 -851 86 -65 264 -153 372 -183 86 -25 238 -46 323 -46 l46 0 2 -957 3 -958 22 -40 c11 -22 34 -52 50 -67 64 -61 6 -58 1123 -58 1117 0 1059 -3 1124 58 16 15 39 50 52 77 l24 50 0 952 0 952 48 -6 c69 -8 249 14 350 43 103 29 247 96 333 155 149 101 291 266 372 431 325 664 -62 1449 -788 1599 -97 20 -303 25 -385 10 l-44 -9 -93 88 c-254 243 -577 379 -938 394 -66 2 -156 1 -200 -4z m415 -179 c228 -52 439 -160 595 -305 55 -51 58 -57 41 -67 -44 -27 -144 -120 -189 -175 -98 -121 -146 -240 -154 -384 -5 -87 -3 -97 17 -122 16 -21 30 -28 56 -28 34 0 74 28 74 53 3 143 23 224 75 312 67 111 210 236 291 256 383 90 796 -70 1014 -391 57 -84 107 -190 136 -287 35 -119 44 -320 20 -442 -38 -184 -117 -344 -237 -475 -85 -92 -174 -158 -294 -217 -262 -127 -546 -130 -827 -8 -41 18 -73 26 -85 22 -10 -4 -54 -30 -98 -59 -217 -140 -440 -206 -700 -206 -273 1 -501 70 -726 219 -76 50 -77 50 -177 8 -127 -53 -205 -68 -362 -69 -178 0 -277 21 -426 94 -252 123 -427 329 -510 605 -25 83 -28 104 -28 260 0 195 15 269 84 413 70 147 151 249 274 348 195 156 452 231 700 204 90 -10 107 -15 156 -47 118 -78 221 -198 263 -307 11 -30 22 -92 27 -150 6 -86 10 -102 29 -118 31 -24 64 -23 97 5 35 31 42 97 20 208 -33 161 -134 321 -275 433 -33 27 -61 54 -60 60 0 6 31 38 70 71 183 157 404 259 649 300 114 19 345 12 460 -14z m677 -2465 l92 -31 1 -958 0 -958 -25 -24 -24 -25 -981 0 c-1042 0 -1026 -1 -1044 45 -3 9 -6 77 -6 151 l0 134 939 0 940 0 20 26 c28 35 26 69 -4 99 -22 23 -32 25 -120 25 l-95 0 0 255 0 256 -25 24 c-29 30 -74 32 -106 6 -24 -19 -24 -20 -27 -280 l-3 -261 -199 0 -200 0 0 255 0 256 -25 24 c-29 30 -74 32 -106 6 -24 -19 -24 -20 -27 -280 l-3 -261 -199 0 -200 0 0 255 0 256 -25 24 c-29 30 -74 32 -106 6 -24 -19 -24 -20 -27 -280 l-3 -261 -199 0 -200 0 0 738 0 737 115 37 115 37 67 -41 c139 -85 312 -151 480 -185 135 -27 415 -24 550 5 174 38 390 126 503 206 20 14 42 22 50 19 8 -4 56 -20 107 -37z" />
      </G>
    </Svg>
  );
}

// Shared "cooking" loading state used while a recipe is being fetched/analysed
// (the Processing screen and the paste-a-link sheet). A bouncing chef hat over
// "Chef YumiShare" + one steady line. Honours Reduce Motion.
export function CookingLoader() {
  const c = useTheme();
  const { t } = useI18n();
  const [reduceMotion, setReduceMotion] = useState(false);
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
  const styles = makeStyles(c);

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.hatWrap, { transform: [{ translateY: hatY }] }]}>
        <ChefHat c={c} />
      </Animated.View>
      <Text style={styles.name}>Chef YumiShare</Text>
      <Text style={styles.msg}>{t('processing.chefAnalyzing' as TKey)}</Text>
      {reduceMotion && <ActivityIndicator color={c.accent} style={styles.spinner} />}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrap: { alignItems: 'center', justifyContent: 'center' },
    hatWrap: { marginBottom: 24 },
    name: { fontFamily: fonts.display, fontSize: 22, color: c.ink, textAlign: 'center' },
    msg: { fontSize: 15, fontWeight: '400', color: c.grayMid, textAlign: 'center', marginTop: 5 },
    spinner: { marginTop: 22 },
  });
