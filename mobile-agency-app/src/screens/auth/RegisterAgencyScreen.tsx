import React, { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Field } from '../../components/Field';
import { Button } from '../../components/Button';
import { colors, spacing, typography } from '../../theme/theme';
import { AuthStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';

type Props = NativeStackScreenProps<AuthStackParamList, 'RegisterAgency'>;

export function RegisterAgencyScreen({ navigation }: Props) {
  const registerAgency = useAuthStore((s) => s.registerAgency);
  const loading = useAuthStore((s) => s.loading);
  const storeError = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const [agencyName, setAgencyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const onSubmit = async () => {
    setValidationError(null);
    clearError();
    if (!agencyName || !ownerName || !password) {
      setValidationError('Agency name, your name, and a password are required.');
      return;
    }
    if (password.length < 8) {
      setValidationError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setValidationError('Passwords do not match.');
      return;
    }
    try {
      await registerAgency({
        agencyName: agencyName.trim(),
        ownerName: ownerName.trim(),
        ownerPhone: ownerPhone.trim() || undefined,
        password,
      });
      Alert.alert(
        'Agency created',
        'Your agency code is shown on the dashboard — share it, along with the password, with your staff so they can join.'
      );
    } catch {
      // The store already captured the specific backend message in `error`.
    }
  };

  const displayedError = validationError || storeError;

  return (
    <Screen>
      <Text style={styles.title}>Register Your Agency</Text>
      <Text style={styles.subtitle}>
        Free to get started — no payment required. You'll become the agency owner and get a unique agency code to hand
        out to staff along with the password you set here.
      </Text>

      <Field label="Agency / Company Name" placeholder="e.g. ABC Clearing Agents" value={agencyName} onChangeText={setAgencyName} />
      <Field label="Your Full Name" placeholder="e.g. Desmond Kamara" value={ownerName} onChangeText={setOwnerName} />
      <Field label="Your Phone Number (optional)" placeholder="e.g. 076123456" keyboardType="phone-pad" value={ownerPhone} onChangeText={setOwnerPhone} />
      <Field label="Set Agency Password" placeholder="At least 8 characters" secureTextEntry value={password} onChangeText={setPassword} />
      <Field label="Confirm Password" placeholder="Re-enter password" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />

      {displayedError ? <Text style={styles.error}>{displayedError}</Text> : null}

      <Button title="Create Agency" onPress={onSubmit} loading={loading} style={styles.submit} />

      <Text style={styles.linkRow}>
        <Text style={styles.linkText}>Already have an agency? </Text>
        <Text style={styles.link} onPress={() => navigation.navigate('Login')}>
          Log in
        </Text>
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl },
  error: { color: colors.urgent, marginBottom: spacing.md },
  submit: { marginTop: spacing.sm },
  linkRow: { textAlign: 'center', marginTop: spacing.xl },
  linkText: { ...typography.body, color: colors.textSecondary },
  link: { ...typography.bodyMedium, color: colors.orange },
});
