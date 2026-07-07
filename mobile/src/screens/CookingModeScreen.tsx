import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useApp } from '../context/AppContext';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { useI18n } from '../i18n/I18nContext';
import { RootStackParamList } from '../navigation/types';
import { cleanStep, isToTaste } from '../utils/scale';
import { convertAmount } from '../utils/amounts';
import { extractTimers, formatClock, formatTimer } from '../utils/timers';
import { Icon } from '../components/Icon';

type Props = NativeStackScreenProps<RootStackParamList, 'CookingMode'>;

interface RunningTimer {
  id: string;
  label: string;
  total: number;
  remaining: number;
  done: boolean;
}

// Owns the alarm audio. Mounted only once a timer is actually running, so
// entering Cooking Mode stays instant (no audio decode on the screen's mount),
// and the sound is preloaded well before the timer ends. Rings loudly (even on
// silent mode) + pulses haptics while `active`, with a 60s safety cap.
function AlarmController({ active }: { active: boolean }) {
  const player = useAudioPlayer(require('../../assets/beep.wav'));

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!active) return;
    const ring = () => {
      try {
        player.loop = true;
        player.volume = 1;
        player.seekTo(0);
        player.play();
      } catch {}
    };
    ring();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    // Retry shortly in case the asset wasn't loaded yet on the first play().
    const kick = setTimeout(ring, 400);
    const hap = setInterval(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }, 1400);
    const stop = setTimeout(() => {
      clearInterval(hap);
      try { player.pause(); } catch {}
    }, 60000);
    return () => {
      clearTimeout(kick);
      clearInterval(hap);
      clearTimeout(stop);
      try { player.pause(); player.loop = false; } catch {}
    };
  }, [active, player]);

  return null;
}

export function CookingModeScreen({ navigation, route }: Props) {
  useKeepAwake(); // screen never dims while cooking
  const c = useTheme();
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { getRecipe, logCooked, unitSystem } = useApp();

  const recipe = getRecipe(route.params.id);
  const steps = useMemo(
    () => (recipe?.steps ?? []).map(cleanStep).filter(Boolean),
    [recipe?.steps],
  );
  // Parse timers once up front (not on every render of every page).
  const timersByStep = useMemo(() => steps.map(extractTimers), [steps]);

  const listRef = useRef<FlatList>(null);
  const [index, setIndex] = useState(0);
  const [ingOpen, setIngOpen] = useState(false);
  const [timers, setTimers] = useState<RunningTimer[]>([]);

  // Single 1s tick drives every running timer, marking each done as it hits 0.
  useEffect(() => {
    if (!timers.some((tm) => !tm.done)) return;
    const iv = setInterval(() => {
      setTimers((prev) =>
        prev.map((tm) => {
          if (tm.done) return tm;
          const remaining = tm.remaining - 1;
          return remaining <= 0 ? { ...tm, remaining: 0, done: true } : { ...tm, remaining };
        }),
      );
    }, 1000);
    return () => clearInterval(iv);
  }, [timers]);

  // Any finished timer → the alarm (mounted below) rings until dismissed.
  const anyDone = timers.some((tm) => tm.done);

  const startTimer = useCallback((seconds: number, label: string) => {
    Haptics.selectionAsync().catch(() => {});
    setTimers((prev) => [
      ...prev,
      { id: `${Date.now()}-${seconds}`, label, total: seconds, remaining: seconds, done: false },
    ]);
  }, []);

  const dismissTimer = useCallback((id: string) => {
    setTimers((prev) => prev.filter((tm) => tm.id !== id));
  }, []);

  const goTo = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(steps.length - 1, i));
      listRef.current?.scrollToOffset({ offset: clamped * width, animated: true });
      setIndex(clamped);
      Haptics.selectionAsync().catch(() => {});
    },
    [steps.length, width],
  );

  if (!recipe || steps.length === 0) {
    return (
      <View style={[styles.container, styles.center]}>
        <StatusBar style={c.bg === '#1A1510' ? 'light' : 'dark'} />
        <Text style={styles.emptyText}>{t('cook.noSteps')}</Text>
        <Pressable style={styles.exitBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.exitText}>{t('common.close')}</Text>
        </Pressable>
      </View>
    );
  }

  const isLast = index === steps.length - 1;

  const finish = () => {
    logCooked(recipe.id);
    navigation.goBack();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style={c.bg === '#1A1510' ? 'light' : 'dark'} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.closeIcon}>×</Text>
        </Pressable>
        <View style={styles.topCenter}>
          <Text style={styles.topTitle} numberOfLines={1}>{recipe.title}</Text>
          <Text style={styles.topStep}>{t('cook.stepOf', { i: index + 1, n: steps.length })}</Text>
        </View>
        <Pressable style={styles.iconBtn} onPress={() => setIngOpen(true)} hitSlop={10}>
          <Icon name="cart" size={20} color={c.ink} />
        </Pressable>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${((index + 1) / steps.length) * 100}%` }]} />
      </View>

      {/* Alarm audio — only exists while a timer is running (keeps entry fast). */}
      {timers.length > 0 && <AlarmController active={anyDone} />}

      {/* Running timers banner (persists across step swipes) */}
      {timers.length > 0 && (
        <View style={styles.timerBanner}>
          {timers.map((tm) => (
            <Pressable
              key={tm.id}
              style={[styles.timerPill, tm.done && styles.timerPillDone]}
              onPress={() => dismissTimer(tm.id)}
            >
              <Text style={[styles.timerPillTime, tm.done && styles.timerPillTimeDone]}>
                {tm.done ? t('cook.timerDone') : formatClock(tm.remaining)}
              </Text>
              <Text style={[styles.timerPillLabel, tm.done && styles.timerPillTimeDone]}>
                {tm.done ? t('cook.timerStop') : `· ${tm.label}`}  ×
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Swipeable steps */}
      <FlatList
        ref={listRef}
        data={steps}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={3}
        removeClippedSubviews
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item, index: i }) => {
          const stepTimers = timersByStep[i] ?? [];
          return (
            <ScrollView
              style={{ width }}
              contentContainerStyle={styles.page}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.stepBadge}>{t('cook.step')} {i + 1}</Text>
              <Text style={styles.stepText}>{item}</Text>
              {stepTimers.length > 0 && (
                <View style={styles.timerRow}>
                  {stepTimers.map((st, k) => (
                    <Pressable
                      key={k}
                      style={styles.startTimerBtn}
                      onPress={() => startTimer(st.seconds, st.label)}
                    >
                      <Text style={styles.startTimerIcon}>▶</Text>
                      <Text style={styles.startTimerText}>
                        {t('cook.startTimer', { d: formatTimer(st.seconds) })}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </ScrollView>
          );
        }}
      />

      {/* Bottom nav */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 14 }]}>
        <Pressable
          style={[styles.navBtn, index === 0 && styles.navBtnDisabled]}
          onPress={() => goTo(index - 1)}
          disabled={index === 0}
        >
          <Text style={[styles.navText, index === 0 && styles.navTextDisabled]}>‹ {t('cook.prev')}</Text>
        </Pressable>
        {isLast ? (
          <Pressable style={styles.finishBtn} onPress={finish}>
            <Text style={styles.finishText}>{t('cook.finish')}</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.nextBtn} onPress={() => goTo(index + 1)}>
            <Text style={styles.nextText}>{t('cook.next')} ›</Text>
          </Pressable>
        )}
      </View>

      {/* Ingredient quick-peek */}
      <Modal visible={ingOpen} transparent animationType="slide" onRequestClose={() => setIngOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIngOpen(false)} />
        <View style={[styles.ingSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.grabber} />
          <Text style={styles.ingTitle}>{t('recipe.ingredients')}</Text>
          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
            {recipe.ingredients
              .slice()
              .sort((a, b) => Number(isToTaste(a.a)) - Number(isToTaste(b.a)))
              .map((ing, i) => (
                <View key={i} style={styles.ingRow}>
                  <Text style={styles.ingName}>{ing.n}</Text>
                  <Text style={styles.ingAmt}>{convertAmount(ing.a, unitSystem)}</Text>
                </View>
              ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    center: { alignItems: 'center', justifyContent: 'center', gap: 16 },
    emptyText: { fontFamily: fonts.body, fontSize: 16, color: c.grayLight },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 10,
    },
    iconBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeIcon: { fontSize: 26, color: c.ink, marginTop: -3 },
    topCenter: { flex: 1, alignItems: 'center' },
    topTitle: { fontFamily: fonts.display, fontSize: 15, color: c.ink, maxWidth: '92%' },
    topStep: { fontFamily: fonts.bodyBold, fontSize: 12, color: c.grayMid, marginTop: 1 },
    progressTrack: { height: 4, backgroundColor: c.surfaceAlt, marginHorizontal: 14, borderRadius: 2, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: c.accent, borderRadius: 2 },
    timerBanner: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 14, paddingTop: 12 },
    timerPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.accentSoft,
      borderWidth: 1,
      borderColor: c.accent,
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 999,
    },
    timerPillDone: { backgroundColor: c.dangerBg, borderColor: c.dangerText },
    timerPillTime: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.accent, fontVariant: ['tabular-nums'] },
    timerPillTimeDone: { color: c.dangerText },
    timerPillLabel: { fontFamily: fonts.body, fontSize: 13, color: c.grayLight },
    page: { paddingHorizontal: 26, paddingTop: 26, paddingBottom: 40, flexGrow: 1 },
    stepBadge: { fontFamily: fonts.bodyBold, fontSize: 14, letterSpacing: 1.5, color: c.accent, marginBottom: 14 },
    stepText: { fontFamily: fonts.display, fontSize: 30, lineHeight: 42, color: c.ink, letterSpacing: -0.3 },
    timerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 30 },
    startTimerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      backgroundColor: c.accent,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 16,
    },
    startTimerIcon: { color: '#fff', fontSize: 14 },
    startTimerText: { fontFamily: fonts.bodyBold, fontSize: 16, color: '#fff' },
    bottomBar: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    navBtn: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: 'center',
    },
    navBtnDisabled: { opacity: 0.4 },
    navText: { fontFamily: fonts.bodyBold, fontSize: 16, color: c.ink },
    navTextDisabled: { color: c.grayMid },
    nextBtn: { flex: 1.4, paddingVertical: 16, borderRadius: 16, backgroundColor: c.accent, alignItems: 'center' },
    nextText: { fontFamily: fonts.bodyBold, fontSize: 16, color: '#fff' },
    finishBtn: { flex: 1.4, paddingVertical: 16, borderRadius: 16, backgroundColor: c.sage, alignItems: 'center' },
    finishText: { fontFamily: fonts.bodyBold, fontSize: 16, color: '#fff' },
    exitBtn: { paddingVertical: 12, paddingHorizontal: 26, borderRadius: 14, backgroundColor: c.accent },
    exitText: { fontFamily: fonts.bodyBold, color: '#fff', fontSize: 15 },
    backdrop: { flex: 1, backgroundColor: c.scrim },
    ingSheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: c.bg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 8,
    },
    grabber: { width: 40, height: 5, borderRadius: 3, backgroundColor: c.border, alignSelf: 'center', marginBottom: 10 },
    ingTitle: { fontFamily: fonts.display, fontSize: 20, color: c.ink, marginBottom: 10 },
    ingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      gap: 12,
    },
    ingName: { fontFamily: fonts.body, fontSize: 15, color: c.ink, flex: 1, minWidth: 0 },
    ingAmt: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.ink, flexShrink: 0, maxWidth: '40%', textAlign: 'right' },
  });
