import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { RootStackParamList } from '../navigation/types';
import { Icon } from '../components/Icon';

type Props = NativeStackScreenProps<RootStackParamList, 'ImportUrl'>;

export function ImportUrlScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [url, setUrl] = useState('');
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);

  useEffect(() => {
    Clipboard.getStringAsync().then((text) => {
      if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
        setClipboardUrl(text);
      }
    });
  }, []);

  const submit = () => {
    const finalUrl = url.trim() || clipboardUrl || 'https://example.com/recipe';
    navigation.replace('Processing', { url: finalUrl });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backIcon}>‹</Text>
      </Pressable>

      <Text style={styles.title}>Paste recipe link</Text>
      <Text style={styles.sub}>
        Paste a link from any blog, YouTube, Instagram or TikTok. We read the caption and pull out the full recipe.
      </Text>

      <View style={[styles.inputWrap, url ? styles.inputFocused : null]}>
        <Icon name="link" size={18} color={colors.gray} />
        <TextInput
          style={styles.input}
          placeholder="Paste a recipe link"
          placeholderTextColor={colors.gray}
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
      </View>

      {!url && clipboardUrl && (
        <Pressable style={styles.clipboardCard} onPress={() => setUrl(clipboardUrl)}>
          <View style={styles.clipIcon}>
            <Icon name="link" size={18} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.clipBadge}>Detected in clipboard</Text>
            <Text style={styles.clipUrl} numberOfLines={1}>
              {clipboardUrl}
            </Text>
          </View>
          <Text style={styles.pasteBtn}>Paste</Text>
        </Pressable>
      )}

      <Pressable
        style={[styles.submit, !(url || clipboardUrl) && styles.submitDisabled]}
        onPress={submit}
      >
        <Text style={styles.submitText}>Read the recipe</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20, paddingTop: 16 },
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
  sub: { fontSize: 15, fontWeight: '500', color: colors.grayMuted, lineHeight: 22, marginBottom: 24 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingLeft: 16,
    paddingRight: 6,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  inputFocused: { borderColor: colors.ink },
  input: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.ink, paddingVertical: 13 },
  clipboardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    marginBottom: 24,
  },
  clipIcon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clipBadge: { fontSize: 11, fontWeight: '600', color: colors.grayMid, marginBottom: 3 },
  clipUrl: { fontSize: 13, fontWeight: '600', color: '#3A3A3A' },
  pasteBtn: {
    backgroundColor: colors.ink,
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  submit: {
    backgroundColor: colors.ink,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitDisabled: { backgroundColor: '#BDBDBD' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
