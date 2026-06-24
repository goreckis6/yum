import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { Icon } from './Icon';
import { useI18n } from '../i18n/I18nContext';
import { extractRecipeFromUrl } from '../api/recipes';
import { Recipe } from '../types';

type Step = 'menu' | 'link' | 'loading';

const RECENT_KEY = '@yumshare/recent_links';
const MAX_RECENT = 10;
const SWIPE_THRESHOLD = 72;

const LOADING_MSGS = [
  'Szef kuchni Yumi analizuje przepis…',
  'Wyciągamy składniki…',
  'Usuwamy wstęp bloga…',
  'Przeliczamy wartości odżywcze…',
  'Prawie gotowe…',
];

async function loadRecent(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveRecent(links: string[]) {
  try { await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(links)); } catch {}
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onScan: () => void;
  onScanBarcode: () => void;
  onScanReceipt: () => void;
  onRecipeReady: (draft: Recipe) => void;
  onManualRecipe: () => void;
}

export function AddSheet({ visible, onClose, onScan, onScanBarcode, onScanReceipt, onRecipeReady, onManualRecipe }: Props) {
  const c = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [step, setStep] = useState<Step>('menu');
  const [url, setUrl] = useState('');
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const [msgIdx, setMsgIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const inputRef = useRef<TextInput>(null);

  // Load recent links once on mount
  useEffect(() => { loadRecent().then(setRecent); }, []);

  useEffect(() => {
    if (!visible) {
      setStep('menu');
      setUrl('');
      setClipUrl(null);
      setError(null);
      setMsgIdx(0);
    }
  }, [visible]);

  useEffect(() => {
    if (step === 'link') {
      Clipboard.getStringAsync().then((text) => {
        if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
          setClipUrl(text);
        }
      });
      // Don't auto-focus — keyboard opens only when user taps the input
    }
  }, [step]);

  useEffect(() => {
    if (step !== 'loading') return;
    const id = setInterval(() => setMsgIdx((i) => (i + 1) % LOADING_MSGS.length), 900);
    return () => clearInterval(id);
  }, [step]);

  const crossFade = useCallback((fn: () => void) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
      fn();
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
  }, [fadeAnim]);

  const goLink = () => crossFade(() => setStep('link'));
  const goBack = () => { Keyboard.dismiss(); crossFade(() => { setStep('menu'); setError(null); }); };

  const pushRecent = useCallback((u: string) => {
    const next = [u, ...recent.filter((r) => r !== u)].slice(0, MAX_RECENT);
    setRecent(next);
    saveRecent(next);
  }, [recent]);

  const removeRecent = useCallback((u: string) => {
    const next = recent.filter((r) => r !== u);
    setRecent(next);
    saveRecent(next);
  }, [recent]);

  const clearAllRecent = useCallback(() => {
    setRecent([]);
    saveRecent([]);
  }, []);

  const submit = async (finalUrl?: string) => {
    const u = (finalUrl ?? url).trim() || clipUrl || '';
    if (!u) return;
    Keyboard.dismiss();
    crossFade(() => { setStep('loading'); setError(null); });
    try {
      const { recipe } = await extractRecipeFromUrl(u);
      pushRecent(u);
      const draft: Recipe = { ...recipe, id: `imp${Date.now()}` };
      onClose();
      onRecipeReady(draft);
    } catch (err: any) {
      crossFade(() => { setStep('link'); setError(err?.message ?? 'Błąd – spróbuj ponownie'); });
    }
  };

  const canSubmit = url.trim().length > 0 || !!clipUrl;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* KAV pushes the sheet up when keyboard opens */}
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Backdrop — only dismisses on menu step */}
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={step === 'menu' ? onClose : Keyboard.dismiss}
        />

        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Animated.View style={{ opacity: fadeAnim }}>
            {step === 'menu' && (
              <MenuView
                styles={styles} c={c} t={t}
                onLink={goLink}
                onScan={() => { onClose(); onScan(); }}
                onManualRecipe={() => { onClose(); onManualRecipe(); }}
                onScanBarcode={() => { onClose(); onScanBarcode(); }}
                onScanReceipt={() => { onClose(); onScanReceipt(); }}
              />
            )}
            {step === 'link' && (
              <LinkView
                styles={styles} c={c} t={t}
                url={url} setUrl={setUrl}
                clipUrl={clipUrl} error={error}
                canSubmit={canSubmit}
                recent={recent}
                onBack={goBack}
                onSubmit={() => submit()}
                onSubmitUrl={(u: string) => submit(u)}
                onRemoveRecent={removeRecent}
                onClearAll={clearAllRecent}
                inputRef={inputRef}
              />
            )}
            {step === 'loading' && (
              <LoadingView styles={styles} c={c} msg={LOADING_MSGS[msgIdx]} />
            )}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ─── SwipeRow ───────────────────────────────────────────────── */

function SwipeRow({ url, styles, c, onSelect, onRemove }: {
  url: string; styles: any; c: ThemeColors;
  onSelect: () => void; onRemove: () => void;
}) {
  const tx = useRef(new Animated.Value(0)).current;

  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dy) < 14,
    onPanResponderMove: (_, g) => { if (g.dx < 0) tx.setValue(g.dx); },
    onPanResponderRelease: (_, g) => {
      if (g.dx < -SWIPE_THRESHOLD) {
        Animated.timing(tx, { toValue: -300, duration: 180, useNativeDriver: true }).start(onRemove);
      } else {
        Animated.spring(tx, { toValue: 0, useNativeDriver: true }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(tx, { toValue: 0, useNativeDriver: true }).start();
    },
  }), []);

  const domain = (() => { try { return new URL(url).hostname.replace('www.', ''); } catch { return url; } })();

  return (
    <View style={styles.recentRowOuter}>
      {/* Delete background */}
      <View style={styles.recentDeleteBg}>
        <Text style={styles.recentDeleteLabel}>Usuń</Text>
      </View>
      <Animated.View style={[styles.recentRow, { transform: [{ translateX: tx }] }]} {...pan.panHandlers}>
        <Pressable style={styles.recentRowInner} onPress={onSelect}>
          <Icon name="link" size={14} color={c.grayMid} />
          <Text style={styles.recentDomain} numberOfLines={1}>{domain}</Text>
          <Text style={styles.recentUrlText} numberOfLines={1}>{url}</Text>
        </Pressable>
        <Pressable onPress={onRemove} hitSlop={8} style={styles.recentXBtn}>
          <Text style={styles.recentXText}>✕</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/* ─── Sub-views ──────────────────────────────────────────────── */

function MenuView({ styles, c, t, onLink, onScan, onManualRecipe, onScanBarcode, onScanReceipt }: any) {
  return (
    <>
      <Text style={styles.title}>{t('addSheet.title')}</Text>
      <Text style={styles.sectionLabel}>{t('addSheet.sectionRecipes')}</Text>

      <Pressable style={styles.bigOptionAccent} onPress={onLink}>
        <View style={styles.bigIconAccent}>
          <Icon name="link" size={24} color="#fff" />
        </View>
        <View style={styles.optionText}>
          <Text style={styles.bigTitleLight}>{t('addSheet.pasteLink')}</Text>
          <Text style={styles.bigSubLight}>{t('addSheet.pasteLinkSub')}</Text>
        </View>
        <Text style={styles.chevronLight}>›</Text>
      </Pressable>

      <View style={styles.rowTwo}>
        <Pressable style={styles.halfOption} onPress={onScan}>
          <View style={[styles.halfIcon, { backgroundColor: c.sageSoft }]}>
            <Icon name="scan" size={22} color={c.sage} />
          </View>
          <Text style={styles.halfTitle}>{t('addSheet.scanRecipe')}</Text>
          <Text style={styles.halfSub}>{t('addSheet.scanRecipeSub')}</Text>
        </Pressable>
        <Pressable style={styles.halfOption} onPress={onManualRecipe}>
          <View style={[styles.halfIcon, { backgroundColor: c.accentSoft }]}>
            <Icon name="pencil" size={20} color={c.accent} />
          </View>
          <Text style={styles.halfTitle}>{t('addSheet.manualRecipe')}</Text>
          <Text style={styles.halfSub}>{t('addSheet.manualRecipeSub')}</Text>
        </Pressable>
      </View>

      <Text style={[styles.sectionLabel, { marginTop: 4 }]}>{t('addSheet.sectionTools')}</Text>

      <Pressable style={styles.toolRow} onPress={onScanBarcode}>
        <View style={[styles.toolIcon, { backgroundColor: c.accentSoft }]}>
          <Icon name="barcode" size={20} color={c.accent} />
        </View>
        <View style={styles.optionText}>
          <Text style={styles.toolTitle}>{t('addSheet.scanBarcode')}</Text>
          <Text style={styles.toolSub}>{t('addSheet.scanBarcodeSub')}</Text>
        </View>
        <Text style={styles.chevronDark}>›</Text>
      </Pressable>

      <Pressable style={[styles.toolRow, { marginBottom: 0 }]} onPress={onScanReceipt}>
        <View style={[styles.toolIcon, { backgroundColor: c.warning }]}>
          <Icon name="receipt" size={20} color={c.gold} />
        </View>
        <View style={styles.optionText}>
          <Text style={styles.toolTitle}>{t('addSheet.scanReceipt')}</Text>
          <Text style={styles.toolSub}>{t('addSheet.scanReceiptSub')}</Text>
        </View>
        <Text style={styles.chevronDark}>›</Text>
      </Pressable>
    </>
  );
}

function LinkView({ styles, c, t, url, setUrl, clipUrl, error, canSubmit, recent,
  onBack, onSubmit, onSubmitUrl, onRemoveRecent, onClearAll, inputRef }: any) {

  const hasRecent = recent.length > 0;

  return (
    <>
      <View style={styles.linkHeader}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{t('addSheet.pasteLink')}</Text>
      </View>

      {/* Clipboard suggestion — only when no manual input yet */}
      {clipUrl && !url && (
        <Pressable style={styles.clipCard} onPress={() => setUrl(clipUrl)}>
          <View style={styles.clipIconBox}>
            <Icon name="link" size={16} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.clipBadge}>Skopiowany link</Text>
            <Text style={styles.clipUrl} numberOfLines={1}>{clipUrl}</Text>
          </View>
          <Text style={styles.clipPasteBtn}>Wklej</Text>
        </Pressable>
      )}

      <View style={[styles.inputWrap, url ? styles.inputFocused : null]}>
        <Icon name="link" size={16} color={c.gray} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={t('addSheet.linkPlaceholder')}
          placeholderTextColor={c.gray}
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          onSubmitEditing={canSubmit ? onSubmit : undefined}
        />
        {url.length > 0 && (
          <Pressable onPress={() => setUrl('')} hitSlop={8}>
            <Text style={styles.clearBtn}>✕</Text>
          </Pressable>
        )}
      </View>

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <Pressable
        style={[styles.submitBtn, !canSubmit && styles.submitDisabled]}
        onPress={canSubmit ? onSubmit : undefined}
      >
        <Text style={styles.submitText}>{t('addSheet.confirmLink')}</Text>
      </Pressable>

      {/* Recent links */}
      {hasRecent && (
        <>
          <View style={styles.recentHeader}>
            <Text style={styles.recentTitle}>Ostatnie linki</Text>
            <Pressable onPress={onClearAll} hitSlop={8}>
              <Text style={styles.recentClearAll}>Usuń wszystkie</Text>
            </Pressable>
          </View>
          <ScrollView
            style={styles.recentList}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {recent.map((u: string) => (
              <SwipeRow
                key={u}
                url={u}
                styles={styles}
                c={c}
                onSelect={() => { setUrl(u); onSubmitUrl(u); }}
                onRemove={() => onRemoveRecent(u)}
              />
            ))}
          </ScrollView>
        </>
      )}
    </>
  );
}

function LoadingView({ styles, c, msg }: any) {
  return (
    <View style={styles.loadingWrap}>
      <ActivityIndicator size="large" color={c.accent} style={{ marginBottom: 20 }} />
      <Text style={styles.loadingMsg}>{msg}</Text>
      <Text style={styles.loadingHint}>To może chwilę potrwać…</Text>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    kav: { flex: 1, justifyContent: 'flex-end', backgroundColor: c.scrim },
    sheet: {
      backgroundColor: c.bg,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 20,
      paddingBottom: Platform.OS === 'ios' ? 10 : 36,
      paddingTop: 12,
      maxHeight: '88%',
    },
    handle: {
      width: 42, height: 5, borderRadius: 3,
      backgroundColor: c.border, alignSelf: 'center', marginBottom: 16,
    },
    title: { fontFamily: fonts.display, fontSize: 22, color: c.ink, marginBottom: 14 },
    sectionLabel: {
      fontSize: 11, fontWeight: '700', color: c.grayMid,
      textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 9,
    },

    bigOptionAccent: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: c.accent, borderRadius: 18, padding: 16, marginBottom: 10,
    },
    bigIconAccent: {
      width: 50, height: 50, borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
    },
    optionText: { flex: 1 },
    bigTitleLight: { fontSize: 16, fontWeight: '700', color: '#fff' },
    bigSubLight: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.72)', marginTop: 2 },
    chevronLight: { color: 'rgba(255,255,255,0.65)', fontSize: 22 },

    rowTwo: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    halfOption: {
      flex: 1, backgroundColor: c.surface,
      borderRadius: 16, padding: 13,
      borderWidth: 1, borderColor: c.border,
    },
    halfIcon: {
      width: 40, height: 40, borderRadius: 11,
      alignItems: 'center', justifyContent: 'center', marginBottom: 8,
    },
    halfTitle: { fontSize: 13.5, fontWeight: '700', color: c.ink, marginBottom: 2 },
    halfSub: { fontSize: 11, fontWeight: '500', color: c.grayMid, lineHeight: 15 },

    toolRow: {
      flexDirection: 'row', alignItems: 'center', gap: 13,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      borderRadius: 16, padding: 12, marginBottom: 8,
    },
    toolIcon: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    toolTitle: { fontSize: 14, fontWeight: '700', color: c.ink },
    toolSub: { fontSize: 11.5, fontWeight: '500', color: c.grayMid, marginTop: 1 },
    chevronDark: { color: c.grayMid, fontSize: 22 },

    /* Link step */
    linkHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
    backBtn: {
      width: 34, height: 34, borderRadius: 17,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      alignItems: 'center', justifyContent: 'center',
    },
    backIcon: { fontSize: 22, color: c.ink, marginTop: -2 },

    clipCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: c.accentSoft, borderRadius: 14, padding: 11, marginBottom: 12,
    },
    clipIconBox: {
      width: 32, height: 32, borderRadius: 8,
      backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center',
    },
    clipBadge: { fontSize: 10.5, fontWeight: '700', color: c.accent, marginBottom: 2 },
    clipUrl: { fontSize: 12.5, fontWeight: '600', color: c.ink },
    clipPasteBtn: {
      backgroundColor: c.accent, color: '#fff', fontWeight: '700',
      fontSize: 12, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999,
    },

    inputWrap: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: c.surface, borderRadius: 14,
      paddingHorizontal: 14, borderWidth: 1.5, borderColor: c.border, marginBottom: 12,
    },
    inputFocused: { borderColor: c.accent },
    input: { flex: 1, fontSize: 14.5, fontWeight: '500', color: c.ink, paddingVertical: 13 },
    clearBtn: { color: c.grayMid, fontSize: 15, paddingHorizontal: 4 },
    errorText: { fontSize: 13, color: '#B91C1C', fontWeight: '600', marginBottom: 10 },
    submitBtn: {
      backgroundColor: c.accent, borderRadius: 14,
      paddingVertical: 15, alignItems: 'center', marginBottom: 16,
    },
    submitDisabled: { backgroundColor: c.border },
    submitText: { color: '#fff', fontWeight: '700', fontSize: 15.5 },

    /* Recent links */
    recentHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
    },
    recentTitle: { fontSize: 12, fontWeight: '700', color: c.grayMid, textTransform: 'uppercase', letterSpacing: 0.6 },
    recentClearAll: { fontSize: 12.5, fontWeight: '700', color: '#DC2626' },
    recentList: { maxHeight: 200 },

    recentRowOuter: { position: 'relative', marginBottom: 6, borderRadius: 12, overflow: 'hidden' },
    recentDeleteBg: {
      position: 'absolute', right: 0, top: 0, bottom: 0, width: 80,
      backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center',
    },
    recentDeleteLabel: { fontSize: 12, fontWeight: '700', color: '#DC2626' },
    recentRow: { backgroundColor: c.surface, borderRadius: 12 },
    recentRowInner: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 12, paddingVertical: 10, flex: 1,
    },
    recentDomain: { fontSize: 12.5, fontWeight: '700', color: c.ink, flexShrink: 0, maxWidth: 90 },
    recentUrlText: { fontSize: 11.5, fontWeight: '400', color: c.grayMid, flex: 1 },
    recentXBtn: { paddingHorizontal: 12, paddingVertical: 10 },
    recentXText: { color: c.grayMid, fontSize: 14 },

    /* Loading step */
    loadingWrap: { alignItems: 'center', paddingVertical: 36 },
    loadingMsg: { fontFamily: fonts.display, fontSize: 19, color: c.ink, textAlign: 'center', marginBottom: 6 },
    loadingHint: { fontSize: 13, fontWeight: '500', color: c.grayMid },
  });
