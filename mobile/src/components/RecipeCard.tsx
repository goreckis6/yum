import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { CoverArt } from './CoverArt';

interface Props {
  title: string;
  rating: string;
  timeStr: string;
  sourceApp: string;
  tint: string;
  imageUrl?: string;
  cover?: string;
  onPress: () => void;
}

export function RecipeCard({ title, rating, timeStr, sourceApp, tint, imageUrl, cover, onPress }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={[styles.imageWrap, { backgroundColor: tint }]}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.photo} resizeMode="cover" />
        ) : cover ? (
          <CoverArt cover={cover} title={title} fontSize={16} />
        ) : null}
        <View style={styles.ratingBadge}>
          <Text style={styles.star}>★</Text>
          <Text style={styles.rating}>{rating}</Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.meta}>
          {timeStr} · {sourceApp}
        </Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: '#211C18',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.06,
      shadowRadius: 20,
      elevation: 3,
      marginBottom: 14,
    },
    imageWrap: {
      height: 118,
      position: 'relative',
    },
    photo: {
      ...StyleSheet.absoluteFillObject,
    },
    ratingBadge: {
      position: 'absolute',
      top: 8,
      right: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: 'rgba(255,255,255,0.92)',
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 999,
    },
    star: { fontSize: 11, color: c.gold },
    rating: { fontSize: 11, fontWeight: '700', color: '#241B12' },
    body: { paddingHorizontal: 12, paddingTop: 11, paddingBottom: 13 },
    title: {
      fontFamily: fonts.display,
      fontSize: 16.5,
      color: c.ink,
      lineHeight: 20,
      minHeight: 40,
    },
    meta: {
      marginTop: 6,
      fontSize: 12,
      fontWeight: '600',
      color: c.grayMid,
    },
  });
