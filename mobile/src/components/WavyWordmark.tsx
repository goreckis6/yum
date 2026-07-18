import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { fonts } from '../theme/fonts';

// The YumiShare wordmark whose letters bob up one after another in a gentle
// travelling wave — used on the recipe-loading screen. "Yumi" upright in the
// caller's colour, "Share" italic in terracotta (matches the static Wordmark).
const TERRACOTTA = '#C7613C';
const LETTERS: { ch: string; italic: boolean }[] = [
  ...['Y', 'u', 'm', 'i'].map((ch) => ({ ch, italic: false })),
  ...['S', 'h', 'a', 'r', 'e'].map((ch) => ({ ch, italic: true })),
];

export function WavyWordmark({ color = '#241B12', size = 28 }: { color?: string; size?: number }) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const anims = useRef(LETTERS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => { if (mounted) setReduceMotion(v); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    // Every letter's loop has the SAME total period, just a staggered start, so
    // the wave keeps travelling in sync instead of drifting apart.
    const step = 85; // stagger between neighbouring letters
    const up = 260, down = 260, tail = 700;
    const bob = up + down;
    const period = (LETTERS.length - 1) * step + bob + tail;
    const loops = anims.map((v, i) => {
      const before = i * step;
      const after = period - before - bob;
      return Animated.loop(
        Animated.sequence([
          Animated.delay(before),
          Animated.timing(v, { toValue: 1, duration: up, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: down, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.delay(after),
        ]),
      );
    });
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [reduceMotion, anims]);

  const amp = Math.round(size * 0.24);
  return (
    <View style={[styles.row, { paddingTop: amp + 2 }]}>
      {LETTERS.map((l, i) => (
        <Animated.Text
          key={i}
          style={{
            fontFamily: l.italic ? fonts.brandItalic : fonts.brand,
            fontSize: size,
            color: l.italic ? TERRACOTTA : color,
            paddingRight: l.italic ? Math.ceil(size * 0.1) : 0,
            transform: [{ translateY: anims[i].interpolate({ inputRange: [0, 1], outputRange: [0, -amp] }) }],
          }}
        >
          {l.ch}
        </Animated.Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' },
});
