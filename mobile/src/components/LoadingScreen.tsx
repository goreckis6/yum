import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';

// Branded startup / loading screen. Shown while fonts, auth, stored flags, or
// subscription state resolve — a continuation of the native splash rather than
// a bare spinner. Deliberately self-contained (no theme/i18n hooks) so it also
// works before those providers mount; call sites already inside the app pass
// their themed colours so it adapts to light/dark.
//
// The logo softly "breathes" (scale + opacity) and the lockup fades/rises in on
// mount. Honours Reduce Motion: when it's on we drop the loop and show a plain
// spinner so there's still a loading cue.
export function LoadingScreen({
  bg = '#F6F6F4',
  tint = '#241B12',
}: { bg?: string; tint?: string } = {}) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const enter = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => { if (mounted) setReduceMotion(v); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  // Fade + rise the lockup in on mount (always — a single gentle transition is
  // fine under Reduce Motion, but keep it instant there to be safe).
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: reduceMotion ? 0 : 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter, reduceMotion]);

  // Continuous breathing loop for the mark.
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const logoOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] });
  const riseY = enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <Animated.View style={[styles.center, { opacity: enter, transform: [{ translateY: riseY }] }]}>
        <Animated.Image
          source={require('../../assets/logo-mark.png')}
          style={[styles.logo, { opacity: logoOpacity, transform: [{ scale }] }]}
          resizeMode="contain"
        />
        <Text style={[styles.word, { color: tint }]}>YumiShare</Text>
      </Animated.View>
      {reduceMotion && <ActivityIndicator style={styles.spinner} color={tint} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', gap: 14 },
  logo: { width: 88, height: 88 },
  word: { fontSize: 22, fontWeight: '700', letterSpacing: 0.5 },
  spinner: { position: 'absolute', bottom: 72 },
});
