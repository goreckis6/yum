import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { fonts } from '../theme/fonts';

// Trendy gradient cover presets. The id is stored on the recipe (recipe.cover)
// so a text cover can be re-rendered anywhere a photo would normally appear.
export interface CoverPreset {
  id: string;
  from: string;
  to: string;
  text: string; // overlay text color
}

export const COVER_PRESETS: CoverPreset[] = [
  { id: 'sage', from: '#A8C3A0', to: '#5E8C6A', text: '#FFFFFF' },
  { id: 'sunset', from: '#FFB088', to: '#E8617B', text: '#FFFFFF' },
  { id: 'berry', from: '#C56BCB', to: '#6A4C9C', text: '#FFFFFF' },
  { id: 'ocean', from: '#7FD0E0', to: '#3E78B2', text: '#FFFFFF' },
  { id: 'butter', from: '#FCE38A', to: '#F38181', text: '#3A2E2E' },
  { id: 'mint', from: '#C2F0E2', to: '#2BAE9E', text: '#10463E' },
  { id: 'charcoal', from: '#6B7280', to: '#1F2937', text: '#FFFFFF' },
  { id: 'mocha', from: '#D7B996', to: '#7A5C44', text: '#FFFFFF' },
];

export function getCoverPreset(id?: string): CoverPreset {
  return COVER_PRESETS.find((p) => p.id === id) ?? COVER_PRESETS[0];
}

interface Props {
  cover?: string;
  title: string;
  radius?: number;
  fontSize?: number;
}

// Full-bleed gradient with subtle decorative circles + the title overlaid.
export function CoverArt({ cover, title, radius = 0, fontSize = 26 }: Props) {
  const p = getCoverPreset(cover);
  return (
    <View style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`g-${p.id}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={p.from} />
            <Stop offset="1" stopColor={p.to} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#g-${p.id})`} />
        <Circle cx="82%" cy="20%" r="60" fill="#FFFFFF" opacity={0.12} />
        <Circle cx="18%" cy="92%" r="90" fill="#FFFFFF" opacity={0.08} />
      </Svg>
      <View style={styles.textWrap}>
        <Text
          style={[styles.title, { color: p.text, fontSize }]}
          numberOfLines={3}
        >
          {title}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  textWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  title: {
    fontFamily: fonts.display,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
});
