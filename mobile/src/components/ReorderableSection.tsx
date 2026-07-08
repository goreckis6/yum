import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { Icon } from './Icon';

// Wraps a "widget" section (e.g. the nutrition dashboard, the water tracker)
// with small up/down handles so the user can reorder it like a home-screen
// widget. Kept dependency-free (no gesture/reanimated lib) so it doesn't
// require a native rebuild.
export function ReorderableSection({
  children,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: {
  children: React.ReactNode;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={styles.wrap}>
      {children}
      <View style={styles.handles}>
        <Pressable
          style={[styles.handle, isFirst && styles.handleDisabled]}
          onPress={onMoveUp}
          disabled={isFirst}
          hitSlop={6}
        >
          <Icon name="chevron-up" size={12} color={isFirst ? c.border : c.grayMuted} />
        </Pressable>
        <Pressable
          style={[styles.handle, isLast && styles.handleDisabled]}
          onPress={onMoveDown}
          disabled={isLast}
          hitSlop={6}
        >
          <Icon name="chevron-down" size={12} color={isLast ? c.border : c.grayMuted} />
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrap: { position: 'relative', paddingTop: 12 },
    handles: {
      position: 'absolute', top: 0, right: 14, zIndex: 1,
      flexDirection: 'row', gap: 1,
      backgroundColor: c.surfaceAlt, borderRadius: 999,
      paddingHorizontal: 4, paddingVertical: 2,
      borderWidth: 1, borderColor: c.border,
    },
    handle: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
    handleDisabled: { opacity: 0.35 },
  });
