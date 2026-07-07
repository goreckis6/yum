import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { fonts } from '../theme/fonts';

// Same fixed "Larder" light-brand palette as ShareCard so the exported image
// looks consistent and pretty regardless of the app's light/dark mode.
const BRAND = {
  bg: '#FBF7F1',
  card: '#FFFFFF',
  ink: '#241B12',
  gray: '#8A7C68',
  accent: '#C7613C',
  border: '#EEE6D9',
};

export const GROCERY_CARD_WIDTH = 360;

export interface GroceryShareSection {
  label: string;
  items: { name: string; amount: string }[];
}

// A branded shopping-list card rendered off-screen and captured with
// react-native-view-shot, then shared as an image.
export function GroceryShareCard({
  title,
  subtitle,
  footer,
  sections,
}: {
  title: string;
  subtitle: string;
  footer: string;
  sections: GroceryShareSection[];
}) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.emoji}>🛒</Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>

      <View style={styles.body}>
        {sections.map((sec, si) => (
          <View key={si} style={si > 0 ? styles.section : undefined}>
            <Text style={styles.sectionLabel}>{sec.label}</Text>
            {sec.items.map((it, i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.name}>{it.name}</Text>
                {it.amount ? <Text style={styles.amount} numberOfLines={1}>{it.amount}</Text> : null}
              </View>
            ))}
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Image source={require('../../assets/logo-mark.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brand}>{footer}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: GROCERY_CARD_WIDTH, backgroundColor: BRAND.bg, borderRadius: 28, overflow: 'hidden' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 22, paddingTop: 24, paddingBottom: 18,
  },
  emoji: { fontSize: 30 },
  title: { fontFamily: fonts.display, fontSize: 24, color: BRAND.ink, letterSpacing: -0.4 },
  subtitle: { fontFamily: fonts.bodySemi, fontSize: 13, color: BRAND.gray, marginTop: 3 },
  body: { paddingHorizontal: 22 },
  section: { marginTop: 18 },
  sectionLabel: {
    fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1,
    color: BRAND.accent, textTransform: 'uppercase', marginBottom: 10,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 9 },
  bullet: { color: BRAND.accent, fontSize: 15, fontFamily: fonts.bodyBold, lineHeight: 20 },
  name: { flex: 1, minWidth: 0, fontFamily: fonts.body, fontSize: 15, lineHeight: 20, color: BRAND.ink },
  amount: { flexShrink: 0, maxWidth: '40%', fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 20, color: BRAND.gray },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 18, marginTop: 22, borderTopWidth: 1, borderTopColor: BRAND.border,
  },
  logo: { width: 20, height: 20 },
  brand: { fontFamily: fonts.bodyBold, fontSize: 13, color: BRAND.ink, letterSpacing: 0.2 },
});
