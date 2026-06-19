import React, { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { Icon } from './Icon';

interface Props {
  visible: boolean;
  onClose: () => void;
  onImportLink: () => void;
  onScan: () => void;
}

export function AddSheet({ visible, onClose, onImportLink, onScan }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Add a recipe</Text>
          <Text style={styles.sub}>Import from a link or scan a photo</Text>

          <Pressable style={styles.option} onPress={onImportLink}>
            <View style={styles.iconOnAccent}>
              <Icon name="link" size={22} color="#fff" />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>Paste Recipe Link</Text>
              <Text style={styles.optionSub}>Blog, YouTube, Instagram, TikTok</Text>
            </View>
          </Pressable>

          <Pressable style={[styles.option, styles.optionLight]} onPress={onScan}>
            <View style={styles.iconLight}>
              <Icon name="camera" size={22} color={c.accent} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitleDark}>Scan Recipe</Text>
              <Text style={styles.optionSubGray}>Photo, screenshot, cookbook</Text>
            </View>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: c.scrim,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: c.bg,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      paddingHorizontal: 20,
      paddingBottom: 36,
      paddingTop: 12,
    },
    handle: {
      width: 42,
      height: 5,
      borderRadius: 3,
      backgroundColor: c.border,
      alignSelf: 'center',
      marginBottom: 18,
    },
    title: {
      fontFamily: fonts.display,
      fontSize: 22,
      color: c.ink,
      marginBottom: 3,
    },
    sub: { fontSize: 13.5, fontWeight: '600', color: c.grayMid, marginBottom: 18 },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: c.accent,
      borderRadius: 18,
      padding: 16,
      marginBottom: 10,
    },
    optionLight: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    iconOnAccent: {
      width: 46,
      height: 46,
      borderRadius: 13,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconLight: {
      width: 46,
      height: 46,
      borderRadius: 13,
      backgroundColor: c.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionText: { flex: 1 },
    optionTitle: { fontSize: 15.5, fontWeight: '700', color: '#fff' },
    optionTitleDark: { fontSize: 15.5, fontWeight: '700', color: c.ink },
    optionSub: { fontSize: 12.5, fontWeight: '500', color: 'rgba(255,255,255,0.78)', marginTop: 1 },
    optionSubGray: { fontSize: 12.5, fontWeight: '500', color: c.grayMid, marginTop: 1 },
  });
