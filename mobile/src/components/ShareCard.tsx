import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { CoverArt } from './CoverArt';
import { fonts } from '../theme/fonts';
import { Recipe } from '../types';
import { cleanStep, isToTaste } from '../utils/scale';

// Fixed "Larder" light-brand palette so the exported image always looks the
// same and pretty on Instagram — independent of the app's light/dark mode.
const BRAND = {
  bg: '#FBF7F1',
  card: '#FFFFFF',
  ink: '#241B12',
  gray: '#8A7C68',
  accent: '#C7613C',
  sage: '#5E7150',
  gold: '#D6982F',
  border: '#EEE6D9',
};

export const SHARE_CARD_WIDTH = 360;

// A self-contained recipe card rendered off-screen and captured with
// react-native-view-shot, then handed to the OS share sheet.
export function ShareCard({
  recipe,
  onImageLoad,
}: {
  recipe: Recipe;
  onImageLoad?: () => void;
}) {
  const ingredients = recipe.ingredients
    .slice()
    .sort((a, b) => Number(isToTaste(a.a)) - Number(isToTaste(b.a)));
  const steps = (recipe.steps ?? []).map(cleanStep).filter(Boolean);

  const macros = [
    { label: 'protein', val: recipe.p, color: BRAND.sage },
    { label: 'carbs', val: recipe.c, color: BRAND.gold },
    { label: 'fat', val: recipe.f, color: BRAND.accent },
  ];

  return (
    <View style={styles.card}>
      <View style={styles.hero}>
        {recipe.imageUrl ? (
          <Image
            source={{ uri: recipe.imageUrl }}
            style={styles.heroImg}
            resizeMode="cover"
            onLoad={onImageLoad}
            onError={onImageLoad}
          />
        ) : (
          <CoverArt cover={recipe.cover} title={recipe.title} fontSize={26} />
        )}
        {recipe.kcal > 0 && (
          <View style={styles.kcalPill}>
            <Text style={styles.kcalText}>{recipe.kcal} kcal</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{recipe.title}</Text>
        <Text style={styles.meta}>
          {recipe.time} min  ·  {recipe.servings} {recipe.servings === 1 ? 'serving' : 'servings'}
        </Text>

        {recipe.kcal > 0 && (
          <View style={styles.macroRow}>
            {macros.map((m) => (
              <View key={m.label} style={styles.macroChip}>
                <View style={[styles.macroDot, { backgroundColor: m.color }]} />
                <Text style={styles.macroVal}>{m.val}g</Text>
                <Text style={styles.macroLabel}>{m.label}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Ingredients</Text>
        {ingredients.map((ing, i) => (
          <View key={i} style={styles.ingRow}>
            <Text style={styles.ingBullet}>•</Text>
            <Text style={styles.ingName}>{ing.n}</Text>
            {ing.a ? <Text style={styles.ingAmt} numberOfLines={1}>{ing.a}</Text> : null}
          </View>
        ))}

        {steps.length > 0 && (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Method</Text>
            {steps.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{i + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </>
        )}
      </View>

      <View style={styles.footer}>
        <Image source={require('../../assets/logo-mark.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brand}>Saved with YumiShare</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: SHARE_CARD_WIDTH, backgroundColor: BRAND.bg, borderRadius: 28, overflow: 'hidden' },
  hero: { height: 220, backgroundColor: BRAND.border, justifyContent: 'flex-end' },
  heroImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  kcalPill: {
    position: 'absolute', top: 14, right: 14,
    backgroundColor: 'rgba(27,23,18,0.62)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
  },
  kcalText: { color: '#fff', fontSize: 13, fontFamily: fonts.bodyBold },
  body: { paddingHorizontal: 22, paddingTop: 18 },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28, color: BRAND.ink, letterSpacing: -0.4 },
  meta: { fontFamily: fonts.bodySemi, fontSize: 13, color: BRAND.gray, marginTop: 7 },
  macroRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  macroChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: BRAND.card, borderWidth: 1, borderColor: BRAND.border,
    borderRadius: 12, paddingVertical: 9, paddingHorizontal: 10,
  },
  macroDot: { width: 8, height: 8, borderRadius: 4 },
  macroVal: { fontFamily: fonts.bodyBold, fontSize: 13, color: BRAND.ink },
  macroLabel: { fontFamily: fonts.body, fontSize: 11, color: BRAND.gray },
  divider: { height: 1, backgroundColor: BRAND.border, marginVertical: 18 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 16, color: BRAND.ink, marginBottom: 10 },
  ingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  ingBullet: { color: BRAND.accent, fontSize: 15, fontFamily: fonts.bodyBold, lineHeight: 20 },
  ingName: { flex: 1, minWidth: 0, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: BRAND.ink },
  ingAmt: { flexShrink: 0, maxWidth: '38%', fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 20, color: BRAND.gray },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  stepNum: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: BRAND.accent,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  stepNumText: { color: '#fff', fontSize: 12, fontFamily: fonts.bodyBold },
  stepText: { flex: 1, minWidth: 0, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: BRAND.ink },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 18, marginTop: 14, borderTopWidth: 1, borderTopColor: BRAND.border,
  },
  logo: { width: 20, height: 20 },
  brand: { fontFamily: fonts.bodyBold, fontSize: 13, color: BRAND.ink, letterSpacing: 0.2 },
});
