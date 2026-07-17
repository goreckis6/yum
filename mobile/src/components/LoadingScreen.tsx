import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  StyleSheet,
  View,
} from 'react-native';
import { Wordmark } from './Wordmark';

// Branded startup / loading screen. Shown while fonts, auth, stored flags, or
// subscription state resolve — a continuation of the native splash rather than
// a bare spinner. Deliberately self-contained (no theme/i18n hooks) so it also
// works before those providers mount; call sites already inside the app pass
// their themed colours so it adapts to light/dark.
//
// No entrance/opacity animation on purpose: this screen mounts and unmounts
// several times across the startup gates (fonts → app state → auth → premium),
// and any fade/rise-in replays on every remount, which read as the logo
// blinking and jumping. Instead the mark just gently breathes (scale only, from
// its natural size) so a remount is never jarring. Honours Reduce Motion.
export function LoadingScreen({
  bg = '#F6F6F4',
  tint = '#241B12',
}: { bg?: string; tint?: string } = {}) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;

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
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  // Scale only, starting from 1 (natural size) so a mid-breath remount doesn't snap.
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <View style={styles.center}>
        <Animated.Image
          source={require('../../assets/logo-mark.png')}
          style={[styles.logo, { transform: [{ scale }] }]}
          resizeMode="contain"
        />
        <Wordmark color={tint} size={30} centered />
      </View>
      {reduceMotion && <ActivityIndicator style={styles.spinner} color={tint} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', gap: 14 },
  logo: { width: 88, height: 88 },
  spinner: { position: 'absolute', bottom: 72 },
});
