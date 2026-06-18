import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useApp } from '../context/AppContext';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const SLIDES = [
  {
    title: 'Save recipes from anywhere',
    body: 'Paste a link from any blog, Instagram or Pinterest — we pull out the full recipe automatically.',
    tint: '#E4E4E2',
  },
  {
    title: 'Plan your whole week',
    body: 'Drop recipes into breakfast, lunch and dinner and watch the nutrition add up.',
    tint: '#DCDCDA',
  },
  {
    title: 'Grocery lists, sorted',
    body: 'Every ingredient consolidated and grouped by aisle. One tap to add to your list.',
    tint: '#E6E6E4',
  },
];

export function OnboardingScreen({ navigation }: Props) {
  const { setHasOnboarded } = useApp();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];

  const finish = () => {
    setHasOnboarded(true);
    navigation.replace('Main');
  };

  return (
    <View style={styles.container}>
      <View style={[styles.hero, { backgroundColor: slide.tint }]} />
      <View style={styles.body}>
        <Text style={styles.brand}>YumShare</Text>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.sub}>{slide.body}</Text>

        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotOn]} />
          ))}
        </View>

        <Pressable
          style={styles.primary}
          onPress={() => (index < 2 ? setIndex(index + 1) : finish())}
        >
          <Text style={styles.primaryText}>{index < 2 ? 'Next' : 'Get started'}</Text>
        </Pressable>

        <Pressable onPress={finish}>
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  hero: { height: '42%' },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 28 },
  brand: { fontFamily: fonts.displayExtra, fontSize: 22, color: colors.ink, marginBottom: 16 },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 32,
    color: colors.ink,
    letterSpacing: -0.6,
    marginBottom: 10,
  },
  sub: { fontSize: 15, fontWeight: '500', color: colors.grayMuted, lineHeight: 22 },
  dots: { flexDirection: 'row', gap: 6, marginTop: 28, marginBottom: 24 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#DADADA' },
  dotOn: { width: 22, backgroundColor: colors.ink },
  primary: {
    backgroundColor: colors.ink,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  skip: { textAlign: 'center', fontSize: 14, fontWeight: '600', color: colors.grayMid },
});
