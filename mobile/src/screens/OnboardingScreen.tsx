import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { useI18n } from '../i18n/I18nContext';
import type { TKey } from '../i18n/translations';
import { Icon, IconName } from '../components/Icon';

const { width } = Dimensions.get('window');

type Slide = {
  title: TKey;
  body: TKey;
  icon: IconName;
  chips: { icon: IconName; label: string }[];
};

const SLIDES: Slide[] = [
  { title: 'onboarding.t1', body: 'onboarding.b1', icon: 'link', chips: [{ icon: 'link', label: 'Instagram' }, { icon: 'scan', label: 'TikTok' }] },
  { title: 'onboarding.t2', body: 'onboarding.b2', icon: 'calendar', chips: [{ icon: 'calendar', label: 'Mon–Sun' }, { icon: 'bulb', label: 'kcal' }] },
  { title: 'onboarding.t3', body: 'onboarding.b3', icon: 'cart', chips: [{ icon: 'cart', label: 'By aisle' }, { icon: 'plus', label: 'One tap' }] },
  { title: 'onboarding.t4', body: 'onboarding.b4', icon: 'receipt', chips: [{ icon: 'receipt', label: 'Receipt' }, { icon: 'sync', label: 'Saved' }] },
];

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const c = useTheme();
  const { t } = useI18n();
  const styles = makeStyles(c);
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<Animated.ScrollView>(null);
  const float = useRef(new Animated.Value(0)).current;

  // Gentle continuous float on the hero art.
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ).start();
  }, [float]);

  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [-8, 8] });
  const floatYInv = float.interpolate({ inputRange: [0, 1], outputRange: [8, -8] });

  const finish = () => onDone();

  const next = () => {
    if (index < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: (index + 1) * width, animated: true });
    } else {
      finish();
    }
  };

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {SLIDES.map((slide, i) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
          const artScale = scrollX.interpolate({ inputRange, outputRange: [0.8, 1, 0.8], extrapolate: 'clamp' });
          const artOpacity = scrollX.interpolate({ inputRange, outputRange: [0, 1, 0], extrapolate: 'clamp' });
          const textShift = scrollX.interpolate({ inputRange, outputRange: [40, 0, -40], extrapolate: 'clamp' });

          return (
            <View key={i} style={[styles.slide, { paddingTop: insets.top + 30 }]}>
              <Animated.View style={[styles.artWrap, { opacity: artOpacity, transform: [{ scale: artScale }] }]}>
                <Animated.View style={[styles.heroCard, { transform: [{ translateY: floatY }] }]}>
                  <Icon name={slide.icon} size={72} color="#fff" />
                </Animated.View>
                <Animated.View style={[styles.chip, styles.chipTL, { transform: [{ translateY: floatYInv }] }]}>
                  <Icon name={slide.chips[0].icon} size={15} color={c.accent} />
                  <Text style={styles.chipText}>{slide.chips[0].label}</Text>
                </Animated.View>
                <Animated.View style={[styles.chip, styles.chipBR, { transform: [{ translateY: floatY }] }]}>
                  <Icon name={slide.chips[1].icon} size={15} color={c.sage} />
                  <Text style={styles.chipText}>{slide.chips[1].label}</Text>
                </Animated.View>
              </Animated.View>

              <Animated.View style={{ transform: [{ translateX: textShift }], opacity: artOpacity }}>
                <Text style={styles.title}>{t(slide.title)}</Text>
                <Text style={styles.body}>{t(slide.body)}</Text>
              </Animated.View>
            </View>
          );
        })}
      </Animated.ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 18 }]}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const dotW = scrollX.interpolate({ inputRange, outputRange: [7, 22, 7], extrapolate: 'clamp' });
            const dotO = scrollX.interpolate({ inputRange, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' });
            return <Animated.View key={i} style={[styles.dot, { width: dotW, opacity: dotO }]} />;
          })}
        </View>

        <Pressable style={styles.primary} onPress={next}>
          <Text style={styles.primaryText}>{index < SLIDES.length - 1 ? t('onboarding.next') : t('onboarding.start')}</Text>
        </Pressable>

        <Pressable onPress={finish} hitSlop={10}>
          <Text style={styles.skip}>{t('onboarding.skip')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    slide: { width, flex: 1, paddingHorizontal: 28, alignItems: 'center' },
    artWrap: { height: 320, width: '100%', alignItems: 'center', justifyContent: 'center', marginBottom: 30 },
    heroCard: {
      width: 168,
      height: 168,
      borderRadius: 46,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: c.accent,
      shadowOffset: { width: 0, height: 18 },
      shadowOpacity: 0.35,
      shadowRadius: 30,
      elevation: 10,
    },
    chip: {
      position: 'absolute',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 9,
      paddingHorizontal: 13,
      borderRadius: 999,
      shadowColor: '#211C18',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.1,
      shadowRadius: 14,
      elevation: 4,
    },
    chipTL: { top: 56, left: 24 },
    chipBR: { bottom: 50, right: 24 },
    chipText: { fontSize: 13, fontWeight: '700', color: c.ink },
    title: {
      fontFamily: fonts.display,
      fontSize: 30,
      lineHeight: 35,
      color: c.ink,
      letterSpacing: -0.6,
      textAlign: 'center',
      marginBottom: 12,
    },
    body: { fontSize: 16, fontWeight: '500', color: c.grayMuted, lineHeight: 24, textAlign: 'center', paddingHorizontal: 6 },
    footer: { paddingHorizontal: 28, paddingTop: 10 },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginBottom: 22 },
    dot: { height: 7, borderRadius: 4, backgroundColor: c.accent },
    primary: {
      backgroundColor: c.accent,
      borderRadius: 16,
      paddingVertical: 17,
      alignItems: 'center',
      marginBottom: 12,
      shadowColor: c.accent,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 18,
      elevation: 6,
    },
    primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    skip: { textAlign: 'center', fontSize: 14, fontWeight: '600', color: c.grayMid, paddingVertical: 8 },
  });
