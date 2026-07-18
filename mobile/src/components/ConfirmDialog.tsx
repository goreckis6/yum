import React, { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';

interface Props {
  visible: boolean;
  title?: string;
  message: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  tertiaryLabel: string;
  onTertiary: () => void;
}

// A centred, on-brand confirmation dialog (used for the duplicate-recipe
// warning). A filled primary action, an optional outlined secondary, and a
// quiet tertiary — styled to match the app instead of the system Alert.
export function ConfirmDialog({
  visible, title, message, primaryLabel, onPrimary, secondaryLabel, onSecondary, tertiaryLabel, onTertiary,
}: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onTertiary}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onTertiary} />
        <View style={styles.card}>
          <View style={styles.badge}>
            <Text style={styles.badgeMark}>!</Text>
          </View>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          <Text style={styles.message}>{message}</Text>

          <Pressable style={styles.primary} onPress={onPrimary}>
            <Text style={styles.primaryText}>{primaryLabel}</Text>
          </Pressable>

          {secondaryLabel && onSecondary ? (
            <Pressable style={styles.secondary} onPress={onSecondary}>
              <Text style={styles.secondaryText}>{secondaryLabel}</Text>
            </Pressable>
          ) : null}

          <Pressable style={styles.tertiary} onPress={onTertiary}>
            <Text style={styles.tertiaryText}>{tertiaryLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: c.scrim,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 28,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: c.surface,
      borderRadius: 22,
      paddingVertical: 24,
      paddingHorizontal: 20,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
    },
    badge: {
      width: 42, height: 42, borderRadius: 21,
      borderWidth: 2, borderColor: c.accent,
      alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    },
    badgeMark: { fontFamily: fonts.display, fontSize: 22, color: c.accent, lineHeight: 26 },
    title: { fontFamily: fonts.display, fontSize: 19, color: c.ink, textAlign: 'center', marginBottom: 6 },
    message: { fontSize: 15, fontWeight: '500', lineHeight: 21, color: c.grayMid, textAlign: 'center', marginBottom: 20 },

    primary: {
      alignSelf: 'stretch', backgroundColor: c.accent, borderRadius: 14,
      paddingVertical: 15, alignItems: 'center',
    },
    primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    secondary: {
      alignSelf: 'stretch', backgroundColor: 'transparent', borderRadius: 14,
      borderWidth: 1.5, borderColor: c.accent, paddingVertical: 14, alignItems: 'center', marginTop: 10,
    },
    secondaryText: { color: c.accent, fontSize: 15, fontWeight: '700' },

    tertiary: { alignSelf: 'stretch', paddingVertical: 14, alignItems: 'center', marginTop: 4 },
    tertiaryText: { color: c.accent, fontSize: 15, fontWeight: '700' },
  });
