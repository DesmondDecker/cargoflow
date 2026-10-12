import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Field } from '../../components/Field';
import { Button } from '../../components/Button';
import { colors, spacing, typography } from '../../theme/theme';
import { AuthStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);
  const storeError = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const [agencyCode, setAgencyCode] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const onSubmit = async () => {
    setValidationError(null);
    clearError();
    if (!agencyCode || !identifier || !password) {
      setValidationError('Fill in the agency code, your name or phone, and the password.');
      return;
    }
    try {
      await login({ agencyCode: agencyCode.trim().toUpperCase(), identifier: identifier.trim(), password });
    } catch {
      // The store already captured the specific backend message in `error`
      // (e.g. "Incorrect agency password") — nothing further to do here.
    }
  };

  const displayedError = validationError || storeError;

  return (
    <Screen>
      <Text style={styles.title}>Log In</Text>
      <Text style={styles.subtitle}>Enter your agency code, then your name or phone, and the agency password.</Text>

      <Field label="Agency Code" placeholder="e.g. K3F9XQ" autoCapitalize="characters" value={agencyCode} onChangeText={setAgencyCode} />
      <Field label="Your Name or Phone" placeholder="e.g. Ibrahim or 076123456" value={identifier} onChangeText={setIdentifier} />
      <Field label="Agency Password" placeholder="••••••••" secureTextEntry value={password} onChangeText={setPassword} />

      {displayedError ? <Text style={styles.error}>{displayedError}</Text> : null}

      <Button title="Log In" onPress={onSubmit} loading={loading} style={styles.submit} />

      <View style={styles.linkRow}>
        <Text style={styles.linkText}>New here? </Text>
        <Text style={styles.link} onPress={() => navigation.navigate('JoinAgency')}>
          Join an agency
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl },
  error: { color: colors.urgent, marginBottom: spacing.md },
  submit: { marginTop: spacing.sm },
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  linkText: { ...typography.body, color: colors.textSecondary },
  link: { ...typography.bodyMedium, color: colors.orange },
});
