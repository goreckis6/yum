import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
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
  // Run the selected action only AFTER the modal has fully dismissed, otherwise
  // iOS refuses to present a second modal (e.g. the image picker) while this one
  // is still animating out — the picker silently never opens.
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const pending = useRef<(() => void) | null>(null);

  const handleSelect = (action: () => void) => {
    pending.current = action;
    onClose();
    // Android / web don't fire Modal.onDismiss, so fall back to a timer there.
    if (Platform.OS !== 'ios') {
      setTimeout(() => {
        pending.current?.();
        pending.current = null;
      }, 250);
    }
  };

  const runPending = () => {
    pending.current?.();
    pending.current = null;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={runPending}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          {options.map((o, i) => (
            <Pressable
              key={`${o.label}-${i}`}
              style={styles.option}
              onPress={() => handleSelect(o.onPress)}
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
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
  initialValue?: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}

// Text-input modal (replacement for the iOS-only Alert.prompt).
export function PromptModal({ visible, title, placeholder, confirmLabel = 'Create', keyboardType, initialValue, onCancel, onConfirm }: PromptModalProps) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [value, setValue] = useState(initialValue ?? '');
  useEffect(() => { if (visible) setValue(initialValue ?? ''); }, [visible, initialValue]);

  const submit = () => {
    const v = value.trim();
    if (!v) return;
    Keyboard.dismiss();
    setValue('');
    onConfirm(v);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor={c.gray}
            value={value}
            onChangeText={setValue}
            keyboardType={keyboardType}
            returnKeyType="done"
            onSubmitEditing={submit}
            autoFocus
          />
          <Pressable
            style={[styles.confirm, !value.trim() && styles.confirmDisabled]}
            onPress={submit}
          >
            <Text style={styles.confirmText}>{confirmLabel}</Text>
          </Pressable>
          <Pressable style={styles.cancel} onPress={() => { setValue(''); onCancel(); }}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: c.scrim,
      justifyContent: 'flex-end',
      padding: 14,
    },
    card: {
      backgroundColor: c.bg,
      borderRadius: 20,
      padding: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: c.border,
    },
    title: { fontFamily: fonts.display, fontSize: 18, color: c.ink, marginBottom: 4, textAlign: 'center' },
    message: { fontSize: 13, fontWeight: '500', color: c.grayMid, marginBottom: 10, textAlign: 'center' },
    option: {
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: c.surface,
      alignItems: 'center',
      marginTop: 8,
    },
    optionText: { fontSize: 15, fontWeight: '700', color: c.ink },
    optionDestructive: { color: c.dangerText },
    cancel: { paddingVertical: 14, alignItems: 'center', marginTop: 8 },
    cancelText: { fontSize: 15, fontWeight: '700', color: c.grayMid },
    input: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 14,
      fontSize: 15,
      fontWeight: '500',
      color: c.ink,
      marginTop: 8,
      marginBottom: 4,
    },
    confirm: {
      backgroundColor: c.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 8,
    },
    confirmDisabled: { backgroundColor: c.gray },
    confirmText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  });
