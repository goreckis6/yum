import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { WavyWordmark } from './WavyWordmark';

// Branded startup / loading screen: the app logo with the "YumiShare" wordmark
// bobbing its letters in a gentle wave underneath. Deliberately self-contained
// (no theme/i18n hooks) so it also works before those providers mount; call
// sites already inside the app pass their themed colours so it adapts to
// light/dark.
//
// The logo is centred on screen at the SAME size the native splash uses (see
// app.json), so when the splash hands off to this screen the logo doesn't move
// — only the letters start animating in beneath it. The wordmark is positioned
// absolutely so it never nudges the logo off centre.
const LOGO = 88;

export function LoadingScreen({
  bg = '#FBF7F1',
  tint = '#241B12',
}: { bg?: string; tint?: string } = {}) {
  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <Image
        source={require('../../assets/logo-mark.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <View style={styles.wordmark} pointerEvents="none">
        <WavyWordmark color={tint} size={30} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { width: LOGO, height: LOGO },
  // Sit just below the screen-centred logo, spanning the full width so the
  // letters stay centred, without displacing the logo itself.
  wordmark: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    marginTop: LOGO / 2 + 12,
  },
});
