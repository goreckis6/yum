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
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { RootStackParamList } from '../navigation/types';
import { Icon } from '../components/Icon';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanRecipe'>;

interface PhotoDraft {
  uri: string;
  base64: string;
  mimeType: string;
}

export function ScanRecipeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [photo, setPhoto] = useState<PhotoDraft | null>(null);

  const pickImage = async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!perm.granted) return;

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
      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backIcon}>‹</Text>
      </Pressable>

      <Text style={styles.title}>Scan recipe</Text>
      <Text style={styles.sub}>
        Take a photo or pick from your gallery — a recipe card, screenshot, cookbook page, or finished dish.
      </Text>

      {photo ? (
        <>
          <View style={styles.previewWrap}>
            <Image source={{ uri: photo.uri }} style={styles.preview} resizeMode="cover" />
            <View style={styles.previewActions}>
              <Pressable style={styles.retakeBtn} onPress={() => pickImage(true)}>
                <Text style={styles.retakeBtnText}>Retake</Text>
              </Pressable>
              <Pressable style={styles.retakeBtn} onPress={() => pickImage(false)}>
                <Text style={styles.retakeBtnText}>Change photo</Text>
              </Pressable>
            </View>
          </View>

          <Pressable style={styles.btnPrimary} onPress={submit}>
            <Text style={styles.btnPrimaryText}>Extract recipe</Text>
          </Pressable>
        </>
      ) : (
        <>
          <View style={styles.placeholder}>
            <Icon name="camera" size={44} color={colors.gray} />
            <Text style={styles.placeholderText}>No photo selected</Text>
          </View>

          <Pressable style={styles.btnPrimary} onPress={() => pickImage(true)}>
            <Text style={styles.btnPrimaryText}>Take photo</Text>
          </Pressable>

          <Pressable style={styles.btnSecondary} onPress={() => pickImage(false)}>
            <Text style={styles.btnSecondaryText}>Choose from gallery</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  backIcon: { fontSize: 28, color: colors.ink },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 32,
    color: colors.ink,
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  sub: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.grayMuted,
    lineHeight: 22,
    marginBottom: 24,
  },
  placeholder: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 12,
  },
  placeholderIcon: { fontSize: 48 },
  placeholderText: { fontSize: 14, fontWeight: '600', color: colors.grayMid },
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
  retakeBtnText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  btnPrimary: {
    backgroundColor: colors.ink,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnSecondary: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  btnSecondaryText: { color: colors.ink, fontSize: 16, fontWeight: '700' },
});
