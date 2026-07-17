import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle } from 'react-native';
import { fonts } from '../theme/fonts';

// The YumiShare wordmark: "Yumi" upright + "Share" italic in terracotta, both
// set in Fraunces (soft serif). "Yumi" takes the caller's colour so it can be
// dark on light and white in dark mode; "Share" stays terracotta on both.
const TERRACOTTA = '#C7613C';

export function Wordmark({
  color = '#241B12',
  size = 34,
  style,
}: {
  color?: string;
  size?: number;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      accessibilityLabel="YumiShare"
      // iOS under-measures the italic "Share", clipping the final letter. Give
      // the text frame generous horizontal room (symmetric so a centred wordmark
      // stays centred) so nothing is cut.
      style={[
        { fontSize: size, letterSpacing: -size * 0.01, paddingHorizontal: Math.ceil(size * 0.25) },
        style,
      ]}
    >
      <Text style={[styles.yumi, { color }]}>Yumi</Text>
      <Text style={styles.share}>Share</Text>
      {/* trailing space reserves width so iOS doesn't clip the italic "e" */}
      <Text style={styles.yumi}> </Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  yumi: { fontFamily: fonts.brand },
  // The italic font is already slanted, so no fontStyle needed.
  share: { fontFamily: fonts.brandItalic, color: TERRACOTTA },
});
