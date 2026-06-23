import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { useI18n } from '../i18n/I18nContext';
import { Icon } from '../components/Icon';

const TOTAL = 3;
const REEL = '#E7C8A3'; // warm reel background (illustration, theme-independent)

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const c = useTheme();
  const { t } = useI18n();
  const styles = makeStyles(c);
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);

  const content = useRef(new Animated.Value(0)).current; // per-step entrance
  const prog = useRef(new Animated.Value(0)).current; // progress 0..TOTAL
  const pulse = useRef(new Animated.Value(0)).current; // share-target pulse
  const check = useRef(new Animated.Value(0)).current; // saved check pop

  useEffect(() => {
    content.setValue(0);
    Animated.timing(content, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.timing(prog, { toValue: step + 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    if (step === 1) {
      check.setValue(0);
      Animated.spring(check, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }).start();
    }
  }, [step]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ).start();
  }, [pulse]);

  const enter = {
    opacity: content,
    transform: [{ translateY: content.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
  };

  const advance = () => (step < TOTAL - 1 ? setStep(step + 1) : onDone());

  const cta =
    step === 0 ? t('onboarding.tryExample') : step === 1 ? t('onboarding.continue') : t('onboarding.start');

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      {/* Progress + skip */}
      <View style={styles.topRow}>
        <View style={styles.progress}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.segTrack}>
              <Animated.View
                style={[
                  styles.segFill,
                  { width: prog.interpolate({ inputRange: [i, i + 1], outputRange: ['0%', '100%'], extrapolate: 'clamp' }) },
                ]}
              />
            </View>
          ))}
        </View>
        <Pressable onPress={onDone} hitSlop={10}>
          <Text style={styles.skip}>{t('onboarding.skip')}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={enter}>
          {step !== 1 && <Text style={styles.eyebrow}>{t('onboarding.step', { n: step + 1, total: TOTAL })}</Text>}

          {step === 0 && (
            <>
              <Text style={styles.title}>{t('onboarding.s1title')}</Text>
              <Text style={styles.body}>{t('onboarding.s1body')}</Text>
              <View style={styles.reel}>
                <View style={styles.reelTop}>
                  <View style={styles.avatar} />
                  <Text style={styles.handle}>@kitchenstories</Text>
                </View>
                <Text style={styles.dish}>🍝</Text>
                <View style={styles.reelActions}>
                  <Icon name="heart" size={20} color="#fff" fill />
                  <Icon name="bulb" size={20} color="#fff" />
                  <View style={styles.shareGlyph}>
                    <Icon name="link" size={16} color="#fff" />
                  </View>
                </View>
                {/* Share sheet */}
                <View style={styles.sheet}>
                  <View style={styles.sheetGrip} />
                  <View style={styles.sheetRow}>
                    <Animated.View style={{ alignItems: 'center', transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }}>
                      <View style={styles.targetOn}>
                        <Image source={require('../../assets/logo-mark.png')} style={styles.targetImg} resizeMode="contain" />
                        <View style={styles.targetDot} />
                      </View>
                      <Text style={styles.targetLabelOn}>YumiShare</Text>
                    </Animated.View>
                    <View style={{ alignItems: 'center' }}>
                      <View style={styles.target}><Icon name="grid" size={20} color={c.grayMid} /></View>
                      <Text style={styles.targetLabel}>{t('onboarding.save')}</Text>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                      <View style={styles.target}><Icon name="plus" size={20} color={c.grayMid} /></View>
                      <Text style={styles.targetLabel}>{t('onboarding.more')}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </>
          )}

          {step === 1 && (
            <>
              <Animated.View style={[styles.checkWrap, { transform: [{ scale: check }] }]}>
                <View style={styles.checkCircle}><Text style={styles.checkMark}>✓</Text></View>
              </Animated.View>
              <Text style={styles.savedTitle}>{t('onboarding.savedTitle')} 🎉</Text>
              <Text style={[styles.body, styles.center]}>{t('onboarding.savedBody')}</Text>

              <View style={styles.card}>
                <View style={styles.cardHero}>
                  <View style={styles.sourcePill}>
                    <Icon name="link" size={12} color="#fff" />
                    <Text style={styles.sourceText}>@pastaqueen · TikTok</Text>
                  </View>
                  <Text style={styles.dishSm}>🍝</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.recipeTitle}>Creamy Tomato Rigatoni</Text>
                  <Text style={styles.recipeMeta}>★ 4.8 · 25 min</Text>
                  <View style={styles.statRow}>
                    {[['25′', t('recipe.total')], ['4', t('recipe.serves')], [t('recipe.levelEasy'), t('recipe.level')]].map(([v, l]) => (
                      <View key={l} style={styles.statBox}>
                        <Text style={styles.statNum}>{v}</Text>
                        <Text style={styles.statLabel}>{l}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.nutCard}>
                    <View style={styles.nutHead}>
                      <Text style={styles.nutTitle}>{t('recipe.nutrition')} <Text style={styles.nutSub}>· 4 {t('recipe.serves').toLowerCase()}</Text></Text>
                      <Text style={styles.nutKcal}>2,080 kcal</Text>
                    </View>
                    <View style={styles.macros}>
                      {[['72g', t('recipe.protein'), c.sage], ['272g', t('recipe.carbs'), c.gold], ['76g', t('recipe.fat'), c.accent]].map(([v, l, col]) => (
                        <View key={l} style={styles.macroCol}>
                          <View style={styles.macroTrack}><View style={[styles.macroFill, { backgroundColor: col as string, width: '70%' }]} /></View>
                          <Text style={styles.macroLabel}><Text style={styles.macroVal}>{v}</Text> {l}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </View>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.title}>{t('onboarding.s3title')}</Text>
              <Text style={styles.body}>{t('onboarding.s3body')}</Text>
              <View style={styles.featRow}>
                {[
                  { icon: 'calendar' as const, label: t('nav.planner') },
                  { icon: 'cart' as const, label: t('nav.grocery') },
                  { icon: 'receipt' as const, label: t('home.trackSpending') },
                ].map((f) => (
                  <View key={f.label} style={styles.feat}>
                    <View style={styles.featIcon}><Icon name={f.icon} size={26} color={c.accent} /></View>
                    <Text style={styles.featLabel}>{f.label}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable style={styles.primary} onPress={advance}>
          <Text style={styles.primaryText}>{cta}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingHorizontal: 22 },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
    progress: { flex: 1, flexDirection: 'row', gap: 7 },
    segTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: c.surfaceAlt, overflow: 'hidden' },
    segFill: { height: '100%', borderRadius: 2, backgroundColor: c.accent },
    skip: { fontSize: 14, fontWeight: '600', color: c.grayMid },
    scroll: { paddingBottom: 16 },
    eyebrow: { fontSize: 12, fontWeight: '800', color: c.accent, letterSpacing: 0.6, marginBottom: 8 },
    title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 35, color: c.ink, letterSpacing: -0.6, marginBottom: 10 },
    body: { fontSize: 15.5, fontWeight: '500', color: c.grayMuted, lineHeight: 23, marginBottom: 20 },
    center: { textAlign: 'center' },

    // reel mock
    reel: { backgroundColor: REEL, borderRadius: 24, padding: 16, minHeight: 380, overflow: 'hidden' },
    reelTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.7)' },
    handle: { color: '#fff', fontWeight: '700', fontSize: 13.5 },
    dish: { fontSize: 92, textAlign: 'center', marginTop: 36 },
    reelActions: { position: 'absolute', right: 14, top: 150, alignItems: 'center', gap: 18 },
    shareGlyph: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.18)', alignItems: 'center', justifyContent: 'center' },
    sheet: { position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: c.surface, borderRadius: 20, paddingTop: 10, paddingBottom: 16, paddingHorizontal: 16 },
    sheetGrip: { width: 38, height: 5, borderRadius: 3, backgroundColor: c.border, alignSelf: 'center', marginBottom: 14 },
    sheetRow: { flexDirection: 'row', justifyContent: 'space-around' },
    target: { width: 56, height: 56, borderRadius: 16, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
    targetOn: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
    targetImg: { width: 56, height: 56, borderRadius: 16 },
    targetDot: { position: 'absolute', top: 6, right: 6, width: 10, height: 10, borderRadius: 5, backgroundColor: c.sage, borderWidth: 1.5, borderColor: c.surface },
    targetLabel: { fontSize: 12, fontWeight: '600', color: c.grayMid },
    targetLabelOn: { fontSize: 12, fontWeight: '800', color: c.ink },

    // saved
    checkWrap: { alignItems: 'center', marginTop: 6, marginBottom: 14 },
    checkCircle: { width: 84, height: 84, borderRadius: 42, backgroundColor: c.sage, alignItems: 'center', justifyContent: 'center' },
    checkMark: { color: '#fff', fontSize: 42, fontWeight: '800', marginTop: -4 },
    savedTitle: { fontFamily: fonts.display, fontSize: 28, color: c.ink, textAlign: 'center', marginBottom: 6 },
    card: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 20, overflow: 'hidden', marginTop: 6 },
    cardHero: { height: 110, backgroundColor: REEL, alignItems: 'center', justifyContent: 'center' },
    sourcePill: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.4)', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999 },
    sourceText: { color: '#fff', fontSize: 11.5, fontWeight: '700' },
    dishSm: { fontSize: 56 },
    cardBody: { padding: 16 },
    recipeTitle: { fontFamily: fonts.display, fontSize: 21, color: c.ink, letterSpacing: -0.3 },
    recipeMeta: { fontSize: 13, fontWeight: '600', color: c.grayMid, marginTop: 4, marginBottom: 14 },
    statRow: { flexDirection: 'row', gap: 9, marginBottom: 14 },
    statBox: { flex: 1, backgroundColor: c.surfaceAlt, borderRadius: 13, paddingVertical: 11, alignItems: 'center' },
    statNum: { fontFamily: fonts.display, fontSize: 16, fontWeight: '700', color: c.ink },
    statLabel: { fontSize: 11, fontWeight: '600', color: c.grayMid, marginTop: 2 },
    nutCard: { backgroundColor: c.surfaceAlt, borderRadius: 14, padding: 14 },
    nutHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    nutTitle: { fontSize: 13, fontWeight: '700', color: c.ink },
    nutSub: { fontWeight: '500', color: c.grayMid },
    nutKcal: { fontSize: 15, fontWeight: '800', color: c.accent },
    macros: { flexDirection: 'row', gap: 9 },
    macroCol: { flex: 1 },
    macroTrack: { height: 6, borderRadius: 4, backgroundColor: c.border, overflow: 'hidden', marginBottom: 6 },
    macroFill: { height: '100%', borderRadius: 4 },
    macroLabel: { fontSize: 11, color: c.grayMid },
    macroVal: { color: c.ink, fontWeight: '700' },

    // step 3
    featRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
    feat: { flex: 1, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 18, paddingVertical: 20, alignItems: 'center', gap: 10 },
    featIcon: { width: 50, height: 50, borderRadius: 15, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' },
    featLabel: { fontSize: 12.5, fontWeight: '700', color: c.ink, textAlign: 'center' },

    footer: { paddingTop: 8 },
    primary: {
      backgroundColor: c.ink,
      borderRadius: 18,
      paddingVertical: 17,
      alignItems: 'center',
      shadowColor: '#211C18',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.2,
      shadowRadius: 18,
      elevation: 6,
    },
    primaryText: { color: c.bg, fontSize: 16, fontWeight: '700' },
  });
