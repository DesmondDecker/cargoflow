import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { useAuth } from '../auth/AuthContext';
import { apiErrorMessage } from '../api/client';
import { AuthStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/theme';

export function LoginScreen({ navigation }: NativeStackScreenProps<AuthStackParamList, 'Login'>) {
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await login(phone.trim(), password);
    } catch (err) {
      setError(apiErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.form}>
        <Text style={typography.h1}>CargoFlow Driver</Text>
        <Text style={styles.sub}>Sign in to see your jobs.</Text>
        <Field label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoCapitalize="none" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Sign in" onPress={submit} loading={busy} disabled={!phone.trim() || !password} />
        <Pressable onPress={() => navigation.navigate('Signup')}>
          <Text style={styles.link}>New driver? Create an account</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </Screen>
  );
}

export function SignupScreen({ navigation }: NativeStackScreenProps<AuthStackParamList, 'Signup'>) {
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signup(name.trim(), phone.trim(), password);
    } catch (err) {
      setError(apiErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.form}>
        <Text style={typography.h1}>Create account</Text>
        <Text style={styles.sub}>After signing up, add your vehicle and request verification. Agencies can only assign jobs to verified drivers.</Text>
        <Field label="Full name" value={name} onChangeText={setName} />
        <Field label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoCapitalize="none" />
        <Field label="Password (8+ characters)" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Create account" onPress={submit} loading={busy} disabled={!name.trim() || !phone.trim() || password.length < 8} />
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.link}>I already have an account</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, paddingTop: spacing.xl },
  sub: { ...typography.caption, marginBottom: spacing.sm },
  error: { color: colors.urgent },
  link: { color: colors.info, textAlign: 'center', paddingVertical: spacing.md, fontWeight: '600' },
});
