import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

// Branded startup / loading screen. Shown while fonts, auth, stored flags, or
// subscription state resolve — a continuation of the native splash rather than
// a bare spinner. Deliberately self-contained (no theme/i18n hooks) so it also
// works before those providers mount; call sites already inside the app pass
// their themed colours so it adapts to light/dark.
export function LoadingScreen({
  bg = '#F6F6F4',
  tint = '#241B12',
}: { bg?: string; tint?: string } = {}) {
  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <View style={styles.center}>
        <Image
          source={require('../../assets/logo-mark.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={[styles.word, { color: tint }]}>YumiShare</Text>
      </View>
      <ActivityIndicator style={styles.spinner} color={tint} />
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
