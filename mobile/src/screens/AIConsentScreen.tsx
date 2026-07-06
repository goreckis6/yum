import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { Icon } from '../components/Icon';
import { useI18n } from '../i18n/I18nContext';
import { LINKS } from '../config/links';

// First-launch AI consent (App Store Guideline 5.1.2). Shown before any AI
// feature can run; names the AI provider (OpenAI) explicitly and requires the
// user to agree before continuing.
export function AIConsentScreen({ onAgree }: { onAgree: () => void }) {
  const c = useTheme();
  const { t } = useI18n();
  const styles = makeStyles(c);
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Icon name="bulb" size={30} color={c.accent} />
        </View>
        <Text style={styles.title}>{t('aiConsent.title')}</Text>
        <Text style={styles.text}>{t('aiConsent.body')}</Text>

        {LINKS.privacy ? (
          <Pressable onPress={() => Linking.openURL(LINKS.privacy)} hitSlop={8}>
            <Text style={styles.link}>{t('aiConsent.privacy')}</Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable style={styles.agreeBtn} onPress={onAgree}>
        <Text style={styles.agreeText}>{t('aiConsent.agree')}</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingHorizontal: 24, justifyContent: 'space-between' },
    body: { flex: 1, justifyContent: 'center' },
    iconWrap: {
      width: 60,
      height: 60,
      borderRadius: 18,
      backgroundColor: c.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    title: {
      fontFamily: fonts.display,
      fontSize: 30,
      lineHeight: 34,
      color: c.ink,
      letterSpacing: -0.6,
      marginBottom: 16,
    },
    text: { fontSize: 16, lineHeight: 25, color: c.grayLight, fontWeight: '500' },
    link: { fontSize: 15, fontWeight: '700', color: c.accent, marginTop: 20 },
    agreeBtn: {
      backgroundColor: c.accent,
      borderRadius: 16,
      paddingVertical: 17,
      alignItems: 'center',
    },
    agreeText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  });
