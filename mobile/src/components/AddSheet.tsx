import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { Icon } from './Icon';

interface Props {
  visible: boolean;
  onClose: () => void;
  onImportLink: () => void;
  onScan: () => void;
}

export function AddSheet({ visible, onClose, onImportLink, onScan }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Add a recipe</Text>
          <Text style={styles.sub}>Import from a link or scan a photo</Text>

          <Pressable style={styles.option} onPress={onImportLink}>
            <View style={styles.iconDark}>
              <Icon name="link" size={22} color={colors.ink} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>Paste Recipe Link</Text>
              <Text style={styles.optionSub}>Blog, YouTube, Instagram, TikTok</Text>
            </View>
          </Pressable>

          <Pressable style={[styles.option, styles.optionLight]} onPress={onScan}>
            <View style={styles.iconLight}>
              <Icon name="camera" size={22} color="#fff" />
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(14,12,11,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg,
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
    backgroundColor: '#DADADA',
    alignSelf: 'center',
    marginBottom: 18,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
    marginBottom: 3,
  },
  sub: { fontSize: 13.5, fontWeight: '600', color: colors.grayMid, marginBottom: 18 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.ink,
    borderRadius: 16,
    padding: 15,
    marginBottom: 10,
  },
  optionLight: { backgroundColor: colors.surface },
  iconDark: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLight: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 20 },
  iconTextLight: { fontSize: 20 },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  optionTitleDark: { fontSize: 15, fontWeight: '700', color: colors.ink },
  optionSub: { fontSize: 12.5, fontWeight: '500', color: 'rgba(255,255,255,0.55)', marginTop: 1 },
  optionSubGray: { fontSize: 12.5, fontWeight: '500', color: colors.grayMid, marginTop: 1 },
});
