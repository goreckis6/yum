import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

export interface SheetOption {
  label: string;
  destructive?: boolean;
  onPress: () => void;
}

interface ActionSheetProps {
  visible: boolean;
  title: string;
  message?: string;
  options: SheetOption[];
  onClose: () => void;
}

// A simple option list modal that works on both web and native (unlike
// Alert.alert, which is a no-op in react-native-web).
export function ActionSheet({ visible, title, message, options, onClose }: ActionSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          {options.map((o, i) => (
            <Pressable
              key={`${o.label}-${i}`}
              style={styles.option}
              onPress={() => {
                onClose();
                o.onPress();
              }}
            >
              <Text style={[styles.optionText, o.destructive && styles.optionDestructive]}>{o.label}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface PromptModalProps {
  visible: boolean;
  title: string;
  placeholder?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}

// Text-input modal (replacement for the iOS-only Alert.prompt).
export function PromptModal({ visible, title, placeholder, confirmLabel = 'Create', onCancel, onConfirm }: PromptModalProps) {
  const [value, setValue] = useState('');
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor={colors.gray}
            value={value}
            onChangeText={setValue}
            autoFocus
          />
          <Pressable
            style={[styles.confirm, !value.trim() && styles.confirmDisabled]}
            onPress={() => {
              const v = value.trim();
              if (!v) return;
              setValue('');
              onConfirm(v);
            }}
          >
            <Text style={styles.confirmText}>{confirmLabel}</Text>
          </Pressable>
          <Pressable style={styles.cancel} onPress={() => { setValue(''); onCancel(); }}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    padding: 14,
  },
  card: {
    backgroundColor: colors.bg,
    borderRadius: 20,
    padding: 16,
    marginBottom: 8,
  },
  title: { fontFamily: fonts.display, fontSize: 18, color: colors.ink, marginBottom: 4, textAlign: 'center' },
  message: { fontSize: 13, fontWeight: '500', color: colors.grayMid, marginBottom: 10, textAlign: 'center' },
  option: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    marginTop: 8,
  },
  optionText: { fontSize: 15, fontWeight: '700', color: colors.ink },
  optionDestructive: { color: '#DC2626' },
  cancel: { paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  cancelText: { fontSize: 15, fontWeight: '700', color: colors.grayMid },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    fontWeight: '500',
    color: colors.ink,
    marginTop: 8,
    marginBottom: 4,
  },
  confirm: {
    backgroundColor: colors.ink,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  confirmDisabled: { backgroundColor: '#BDBDBD' },
  confirmText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
