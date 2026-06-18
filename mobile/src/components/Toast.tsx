import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

export function Toast({ message, visible }: { message: string; visible: boolean }) {
  if (!visible) return null;
  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.toast}>
        <Text style={styles.check}>✓</Text>
        <Text style={styles.text}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 104,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 90,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: colors.ink,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 14,
    shadowColor: '#211C18',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 8,
  },
  check: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
