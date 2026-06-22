import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useApp } from '../context/AppContext';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { RootStackParamList } from '../navigation/types';
import { useI18n } from '../i18n/I18nContext';
import type { TKey } from '../i18n/translations';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const SLIDES: { title: TKey; body: TKey; tint: string }[] = [
  { title: 'onboarding.t1', body: 'onboarding.b1', tint: '#E4E4E2' },
  { title: 'onboarding.t2', body: 'onboarding.b2', tint: '#DCDCDA' },
  { title: 'onboarding.t3', body: 'onboarding.b3', tint: '#E6E6E4' },
];

export function OnboardingScreen({ navigation }: Props) {
  const c = useTheme();
  const { t } = useI18n();
  const styles = makeStyles(c);
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
        <Text style={styles.title}>{t(slide.title)}</Text>
        <Text style={styles.sub}>{t(slide.body)}</Text>

        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotOn]} />
          ))}
        </View>

        <Pressable
          style={styles.primary}
          onPress={() => (index < 2 ? setIndex(index + 1) : finish())}
        >
          <Text style={styles.primaryText}>{index < 2 ? t('onboarding.next') : t('onboarding.start')}</Text>
        </Pressable>

        <Pressable onPress={finish}>
          <Text style={styles.skip}>{t('onboarding.skip')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  hero: { height: '42%' },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 28 },
  brand: { fontFamily: fonts.displayExtra, fontSize: 22, color: c.ink, marginBottom: 16 },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 32,
    color: c.ink,
    letterSpacing: -0.6,
    marginBottom: 10,
  },
  sub: { fontSize: 15, fontWeight: '500', color: c.grayMuted, lineHeight: 22 },
  dots: { flexDirection: 'row', gap: 6, marginTop: 28, marginBottom: 24 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#DADADA' },
  dotOn: { width: 22, backgroundColor: c.accent },
  primary: {
    backgroundColor: c.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  skip: { textAlign: 'center', fontSize: 14, fontWeight: '600', color: c.grayMid },
});
