import React, { useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { RootStackParamList } from '../navigation/types';
import { Icon } from '../components/Icon';
import { useI18n } from '../i18n/I18nContext';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanRecipe'>;

interface PhotoDraft {
  uri: string;
  base64: string;
  mimeType: string;
}

export function ScanRecipeScreen({ navigation }: Props) {
  const c = useTheme();
  const { t } = useI18n();
  const styles = makeStyles(c);
  const insets = useSafeAreaInsets();
  const [photo, setPhoto] = useState<PhotoDraft | null>(null);

  const pickImage = async (fromCamera: boolean) => {
    // Camera needs permission; the photo library uses the system picker which
    // works without one, so we only gate the camera.
    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.85,
          base64: true,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.85,
          base64: true,
        });

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) return;

    setPhoto({
      uri: asset.uri,
      base64: asset.base64,
      mimeType: asset.mimeType ?? 'image/jpeg',
    });
  };

  const submit = () => {
    if (!photo) return;
    navigation.replace('Processing', {
      imageBase64: photo.base64,
      mimeType: photo.mimeType,
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
        <Text style={styles.backIcon}>‹</Text>
      </Pressable>

      <Text style={styles.title}>{t('scanRecipe.title')}</Text>
      <Text style={styles.sub}>{t('scanRecipe.sub')}</Text>

      {photo ? (
        <>
          <View style={styles.previewWrap}>
            <Image source={{ uri: photo.uri }} style={styles.preview} resizeMode="cover" />
            <View style={styles.previewActions}>
              <Pressable style={styles.retakeBtn} onPress={() => pickImage(true)}>
                <Text style={styles.retakeBtnText}>{t('scanReceipt.retake')}</Text>
              </Pressable>
              <Pressable style={styles.retakeBtn} onPress={() => pickImage(false)}>
                <Text style={styles.retakeBtnText}>{t('scanReceipt.changePhoto')}</Text>
              </Pressable>
            </View>
          </View>

          <Pressable style={styles.btnPrimary} onPress={submit}>
            <Text style={styles.btnPrimaryText}>{t('scanRecipe.extract')}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <View style={styles.placeholder}>
            <Icon name="camera" size={44} color={c.gray} />
            <Text style={styles.placeholderText}>{t('scanRecipe.none')}</Text>
          </View>

          <Pressable style={styles.btnPrimary} onPress={() => pickImage(true)}>
            <Text style={styles.btnPrimaryText}>{t('scanReceipt.take')}</Text>
          </Pressable>

          <Pressable style={styles.btnSecondary} onPress={() => pickImage(false)}>
            <Text style={styles.btnSecondaryText}>{t('scanReceipt.gallery')}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  backIcon: { fontSize: 28, color: c.ink },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 32,
    color: c.ink,
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  sub: {
    fontSize: 15,
    fontWeight: '500',
    color: c.grayMuted,
    lineHeight: 22,
    marginBottom: 24,
  },
  placeholder: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 12,
  },
  placeholderIcon: { fontSize: 48 },
  placeholderText: { fontSize: 14, fontWeight: '600', color: c.grayMid },
  previewWrap: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
  },
  preview: { flex: 1 },
  previewActions: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    gap: 8,
  },
  retakeBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: 'center',
  },
  retakeBtnText: { fontSize: 13, fontWeight: '700', color: c.ink },
  btnPrimary: {
    backgroundColor: c.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnSecondary: {
    backgroundColor: c.surface,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  btnSecondaryText: { color: c.ink, fontSize: 16, fontWeight: '700' },
});
