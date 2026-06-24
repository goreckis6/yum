import React, { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { Icon } from './Icon';
import { useI18n } from '../i18n/I18nContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  onImportLink: () => void;
  onScan: () => void;
  onScanBarcode: () => void;
  onScanReceipt: () => void;
}

export function AddSheet({ visible, onClose, onImportLink, onScan, onScanBarcode, onScanReceipt }: Props) {
  const c = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(c), [c]);

  const handle = (fn: () => void) => () => { onClose(); fn(); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t('addSheet.title')}</Text>
          <Text style={styles.sub}>{t('addSheet.sub')}</Text>

          {/* Wklej link — primary accent */}
          <Pressable style={styles.optionAccent} onPress={handle(onImportLink)}>
            <View style={styles.iconOnAccent}>
              <Icon name="link" size={22} color="#fff" />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitleLight}>{t('addSheet.pasteLink')}</Text>
              <Text style={styles.optionSubLight}>{t('addSheet.pasteLinkSub')}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>

          {/* Skanuj przepis */}
          <Pressable style={styles.optionLight} onPress={handle(onScan)}>
            <View style={[styles.iconColored, { backgroundColor: c.sageSoft }]}>
              <Icon name="scan" size={22} color={c.sage} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitleDark}>{t('addSheet.scanRecipe')}</Text>
              <Text style={styles.optionSubGray}>{t('addSheet.scanRecipeSub')}</Text>
            </View>
            <Text style={styles.chevronDark}>›</Text>
          </Pressable>

          {/* Skanuj kod kreskowy */}
          <Pressable style={styles.optionLight} onPress={handle(onScanBarcode)}>
            <View style={[styles.iconColored, { backgroundColor: c.accentSoft }]}>
              <Icon name="barcode" size={22} color={c.accent} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitleDark}>{t('addSheet.scanBarcode')}</Text>
              <Text style={styles.optionSubGray}>{t('addSheet.scanBarcodeSub')}</Text>
            </View>
            <Text style={styles.chevronDark}>›</Text>
          </Pressable>

          {/* Paragon */}
          <Pressable style={styles.optionLight} onPress={handle(onScanReceipt)}>
            <View style={[styles.iconColored, { backgroundColor: c.warning }]}>
              <Icon name="receipt" size={22} color={c.gold} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitleDark}>{t('addSheet.scanReceipt')}</Text>
              <Text style={styles.optionSubGray}>{t('addSheet.scanReceiptSub')}</Text>
            </View>
            <Text style={styles.chevronDark}>›</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: c.scrim, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: c.bg,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      paddingHorizontal: 20,
      paddingBottom: 40,
      paddingTop: 12,
    },
    handle: {
      width: 42, height: 5, borderRadius: 3,
      backgroundColor: c.border, alignSelf: 'center', marginBottom: 18,
    },
    title: { fontFamily: fonts.display, fontSize: 22, color: c.ink, marginBottom: 3 },
    sub: { fontSize: 13.5, fontWeight: '600', color: c.grayMid, marginBottom: 16 },
    optionAccent: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: c.accent, borderRadius: 18, padding: 16, marginBottom: 10,
    },
    optionLight: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      borderRadius: 18, padding: 14, marginBottom: 10,
    },
    iconOnAccent: {
      width: 46, height: 46, borderRadius: 13,
      backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center',
    },
    iconColored: {
      width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    },
    optionText: { flex: 1 },
    optionTitleLight: { fontSize: 15.5, fontWeight: '700', color: '#fff' },
    optionTitleDark: { fontSize: 15.5, fontWeight: '700', color: c.ink },
    optionSubLight: { fontSize: 12.5, fontWeight: '500', color: 'rgba(255,255,255,0.78)', marginTop: 1 },
    optionSubGray: { fontSize: 12.5, fontWeight: '500', color: c.grayMid, marginTop: 1 },
    chevron: { color: 'rgba(255,255,255,0.7)', fontSize: 22 },
    chevronDark: { color: c.grayMid, fontSize: 22 },
  });
