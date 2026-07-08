import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { Icon } from './Icon';

// Wraps a "widget" section (e.g. the nutrition dashboard, the water tracker)
// with small up/down handles so the user can reorder it like a home-screen
// widget. Kept dependency-free (no gesture/reanimated lib) so it doesn't
// require a native rebuild. A long-press jumps straight to the top/bottom.
export function ReorderableSection({
  children,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onMoveTop,
  onMoveBottom,
}: {
  children: React.ReactNode;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMoveTop: () => void;
  onMoveBottom: () => void;
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
          onLongPress={onMoveTop}
          disabled={isFirst}
          hitSlop={8}
        >
          <Icon name="chevron-up" size={11} color={c.grayMuted} />
        </Pressable>
        <Pressable
          style={[styles.handle, isLast && styles.handleDisabled]}
          onPress={onMoveDown}
          onLongPress={onMoveBottom}
          disabled={isLast}
          hitSlop={8}
        >
          <Icon name="chevron-down" size={11} color={c.grayMuted} />
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrap: { position: 'relative', paddingTop: 10 },
    handles: {
      position: 'absolute', top: 0, right: 16, zIndex: 1,
      flexDirection: 'row', gap: 3,
    },
    handle: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center', opacity: 0.55 },
    handleDisabled: { opacity: 0.2 },
  });
