import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { Icon } from './Icon';
import { useI18n } from '../i18n/I18nContext';
import { extractRecipeFromUrl } from '../api/recipes';
import { Recipe } from '../types';
import { useApp } from '../context/AppContext';
import { usePremium } from '../context/PremiumContext';
import { PREMIUM_UNLIMITED } from '../config/credits';

type Step = 'menu' | 'link' | 'loading';

interface Props {
  visible: boolean;
  onClose: () => void;
  onScan: () => void;
  onScanBarcode: () => void;
  onScanReceipt: () => void;
  onRecipeReady: (draft: Recipe) => void;
  onManualRecipe: () => void;
  onOutOfCredits: () => void;
}

export function AddSheet({ visible, onClose, onScan, onScanBarcode, onScanReceipt, onRecipeReady, onManualRecipe, onOutOfCredits }: Props) {
  const c = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { credits, setCredits } = useApp();
  const { isPremium } = usePremium();
  const unlimited = PREMIUM_UNLIMITED && isPremium;

  const loadingMsgs = [
    t('processing.url1'), t('processing.url2'), t('processing.url3'),
    t('processing.url4'), t('processing.url5'),
  ];

  const [step, setStep] = useState<Step>('menu');
  const [url, setUrl] = useState('');
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const [msgIdx, setMsgIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const inputRef = useRef<TextInput>(null);

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
    }
  }, [step]);

  useEffect(() => {
    if (step !== 'loading') return;
    const id = setInterval(() => setMsgIdx((i) => (i + 1) % loadingMsgs.length), 900);
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

  const submit = async (finalUrl?: string) => {
    const u = (finalUrl ?? url).trim() || clipUrl || '';
    if (!u) return;
    // Out of free imports → close and show the paywall upsell.
    if (!unlimited && credits <= 0) {
      onClose();
      onOutOfCredits();
      return;
    }
    Keyboard.dismiss();
    crossFade(() => { setStep('loading'); setError(null); });
    try {
      const res = await extractRecipeFromUrl(u);
      const recipe = res.recipe;
      // Guard against "not a recipe" links (random videos, unrelated pages):
      // the extractor returns an empty shell — show a helpful hint instead of a
      // blank draft.
      const noTitle = !recipe?.title?.trim();
      const noContent =
        (recipe?.ingredients?.length ?? 0) === 0 && (recipe?.steps?.length ?? 0) === 0;
      if (noTitle || noContent) {
        crossFade(() => { setStep('link'); setError(t('addSheet.notRecipe')); });
        return;
      }
      // Server already spent the credit for a real recipe — mirror its balance.
      if (typeof res.credits === 'number') setCredits(res.credits);
      const draft: Recipe = { ...recipe, id: `imp${Date.now()}` };
      onClose();
      onRecipeReady(draft);
    } catch (err: any) {
      if (err?.code === 'no_credits') {
        setCredits(0);
        onClose();
        onOutOfCredits();
        return;
      }
      crossFade(() => { setStep('link'); setError(err?.message ?? t('addSheet.linkError')); });
    }
  };

  const canSubmit = url.trim().length > 0 || !!clipUrl;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={step === 'menu' ? onClose : Keyboard.dismiss}
        />

        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Animated.View style={[{ opacity: fadeAnim }, styles.content]}>
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
                onBack={goBack}
                onSubmit={() => submit()}
                onSubmitClip={() => submit(clipUrl ?? '')}
                inputRef={inputRef}
              />
            )}
            {step === 'loading' && (
              <LoadingView styles={styles} c={c} t={t} msg={loadingMsgs[msgIdx]} />
            )}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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

function LinkView({ styles, c, t, url, setUrl, clipUrl, error, canSubmit,
  onBack, onSubmit, onSubmitClip, inputRef }: any) {
  return (
    <>
      <View style={styles.linkHeader}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{t('addSheet.pasteLink')}</Text>
      </View>

      {clipUrl && !url && (
        <Pressable style={styles.clipCard} onPress={() => onSubmitClip()}>
          <View style={styles.clipIconBox}>
            <Icon name="link" size={16} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.clipBadge}>{t('addSheet.clipBadge')}</Text>
            <Text style={styles.clipUrl} numberOfLines={1}>{clipUrl}</Text>
          </View>
          <Text style={styles.clipPasteBtn}>{t('addSheet.clipPaste')}</Text>
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
    </>
  );
}

function LoadingView({ styles, c, t, msg }: any) {
  return (
    <View style={styles.loadingWrap}>
      <ActivityIndicator size="large" color={c.accent} style={{ marginBottom: 20 }} />
      <Text style={styles.loadingMsg}>{msg}</Text>
      <Text style={styles.loadingHint}>{t('addSheet.loadingHint')}</Text>
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
      minHeight: '50%',
      maxHeight: '88%',
    },
    handle: {
      width: 42, height: 5, borderRadius: 3,
      backgroundColor: c.border, alignSelf: 'center', marginBottom: 16,
    },
    // No flex here: the sheet grows to fit the current view's content (capped by
    // the sheet's maxHeight), instead of being pinned to minHeight and clipping.
    content: {},
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
    errorText: { fontSize: 13, color: c.dangerText, fontWeight: '600', marginBottom: 10 },
    submitBtn: {
      backgroundColor: c.accent, borderRadius: 14,
      paddingVertical: 15, alignItems: 'center', marginBottom: 16,
    },
    submitDisabled: { backgroundColor: c.border },
    submitText: { color: '#fff', fontWeight: '700', fontSize: 15.5 },

    /* Loading step */
    loadingWrap: { minHeight: 280, alignItems: 'center', justifyContent: 'center', paddingVertical: 36 },
    loadingMsg: { fontFamily: fonts.display, fontSize: 19, color: c.ink, textAlign: 'center', marginBottom: 6 },
    loadingHint: { fontSize: 13, fontWeight: '500', color: c.grayMid },
  });
