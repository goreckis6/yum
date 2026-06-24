import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { extractRecipeFromImage, extractRecipeFromUrl } from '../api/recipes';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { Recipe } from '../types';
import { RootStackParamList } from '../navigation/types';
import { useI18n } from '../i18n/I18nContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Processing'>;

export function ProcessingScreen({ navigation, route }: Props) {
  const c = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [msgIndex, setMsgIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const isImageMode = 'imageBase64' in route.params;
  const URL_MESSAGES = [
    t('processing.url1'), t('processing.url2'), t('processing.url3'),
    t('processing.url4'), t('processing.url5'), t('processing.url6'),
  ];
  const IMAGE_MESSAGES = [
    t('processing.img1'), t('processing.img2'), t('processing.img3'),
    t('processing.img4'), t('processing.img5'),
  ];
  const MESSAGES = isImageMode ? IMAGE_MESSAGES : URL_MESSAGES;

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((i) => (i + 1) % MESSAGES.length);
    }, 700);

    const work = isImageMode
      ? extractRecipeFromImage(
          (route.params as { imageBase64: string; mimeType: string }).imageBase64,
          (route.params as { imageBase64: string; mimeType: string }).mimeType,
        )
      : extractRecipeFromUrl((route.params as { url: string }).url);

    work
      .then(({ recipe }) => {
        clearInterval(interval);
        const draft: Recipe = {
          ...recipe,
          id: `imp${Date.now()}`,
        };
        navigation.replace('ReviewImport', { draft });
      })
      .catch((err: Error) => {
        clearInterval(interval);
        setError(err.message);
      });

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={c.accent} style={styles.spinner} />
      <Text style={styles.title}>{error ? t('processing.error') : MESSAGES[msgIndex]}</Text>
      {error ? (
        <>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => navigation.goBack()}>
            <Text style={styles.hint}>{t('processing.back')}</Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.hint}>{t('processing.hint')}</Text>
      )}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    spinner: { marginBottom: 24 },
    title: {
      fontFamily: fonts.display,
      fontSize: 22,
      color: c.ink,
      textAlign: 'center',
      marginBottom: 8,
    },
    error: { fontSize: 14, color: '#B91C1C', textAlign: 'center', marginBottom: 12 },
    hint: { fontSize: 13, fontWeight: '500', color: c.grayMid, textAlign: 'center' },
  });
