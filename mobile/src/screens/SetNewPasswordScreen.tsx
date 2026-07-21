import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';

// Shown after the user opens a password-reset link (recovering === true). They
// set a new password; on success AuthContext clears `recovering` and the app
// continues to the normal signed-in flow.
export function SetNewPasswordScreen() {
  const c = useTheme();
  const styles = makeStyles(c);
  const insets = useSafeAreaInsets();
  const { updatePassword } = useAuth();

  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setBusy(true);
    const res = await updatePassword(password);
    setBusy(false);
    if (res.error) setError(res.error);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: c.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.inner, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>
        <Image source={require('../../assets/logo-mark.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>Set a new password</Text>
        <Text style={styles.subtitle}>Enter a new password for your account.</Text>

        <TextInput
          style={styles.field}
          value={password}
          onChangeText={setPassword}
          placeholder="New password"
          placeholderTextColor={c.gray}
          secureTextEntry
          autoFocus
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={[styles.btn, busy && styles.btnDisabled]} onPress={save} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save password</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'flex-start' },
  logo: { width: 72, height: 72, marginBottom: 20 },
  title: { fontFamily: fonts.display, fontSize: 24, color: c.ink, textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 15, fontWeight: '500', color: c.grayMuted, textAlign: 'center', marginBottom: 28 },
  field: {
    alignSelf: 'stretch',
    backgroundColor: c.surface, borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 14,
    fontSize: 15, fontWeight: '500', color: c.ink,
    marginBottom: 12, borderWidth: 1, borderColor: c.border,
  },
  error: { alignSelf: 'stretch', fontSize: 13, fontWeight: '600', color: c.dangerText, marginBottom: 10 },
  btn: {
    alignSelf: 'stretch', backgroundColor: c.accent, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
