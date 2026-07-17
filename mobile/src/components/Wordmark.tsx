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
  centered = false,
  style,
}: {
  color?: string;
  size?: number;
  // Mirror the right padding on the left so a standalone wordmark stays visually
  // centred. Leave false when it sits next to a logo (so it stays tight left).
  centered?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const pad = Math.ceil(size * 0.6);
  return (
    <Text
      accessibilityLabel="YumiShare"
      // iOS under-measures the italic "Share" and clips the final letter. Give
      // the text frame generous room on the RIGHT (where the clip is).
      style={[
        {
          fontSize: size,
          letterSpacing: -size * 0.01,
          paddingRight: pad,
          paddingLeft: centered ? pad : 0,
        },
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
