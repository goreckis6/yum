import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { extractRecipeFromImage, extractRecipeFromUrl } from '../api/recipes';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { Recipe } from '../types';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Processing'>;

const URL_MESSAGES = [
  'Reading the recipe…',
  'Removing blog intro…',
  'Extracting ingredients…',
  'Converting to WW / WBT…',
  'Cleaning up steps…',
  'Almost done…',
];

const IMAGE_MESSAGES = [
  'Analysing photo…',
  'Identifying ingredients…',
  'Building recipe…',
  'Estimating nutrition…',
  'Almost done…',
];

export function ProcessingScreen({ navigation, route }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [msgIndex, setMsgIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const isImageMode = 'imageBase64' in route.params;
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
      <Text style={styles.title}>{error ? 'Something went wrong' : MESSAGES[msgIndex]}</Text>
      {error ? (
        <>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => navigation.goBack()}>
            <Text style={styles.hint}>Tap to go back</Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.hint}>Reading the caption and building your recipe…</Text>
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
