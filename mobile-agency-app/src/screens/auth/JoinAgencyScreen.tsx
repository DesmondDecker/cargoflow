import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Field } from '../../components/Field';
import { Button } from '../../components/Button';
import { colors, spacing, typography } from '../../theme/theme';
import { AuthStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';

type Props = NativeStackScreenProps<AuthStackParamList, 'JoinAgency'>;

export function JoinAgencyScreen({ navigation }: Props) {
  const joinAgency = useAuthStore((s) => s.joinAgency);
  const loading = useAuthStore((s) => s.loading);
  const storeError = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const [agencyCode, setAgencyCode] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const onSubmit = async () => {
    setValidationError(null);
    clearError();
    if (!agencyCode || !password || !name) {
      setValidationError('Agency code, password, and your name are required.');
      return;
    }
    try {
      await joinAgency({ agencyCode: agencyCode.trim().toUpperCase(), password, name: name.trim(), phone: phone.trim() || undefined });
    } catch {
      // The store already captured the specific backend message in `error`.
    }
  };

  const displayedError = validationError || storeError;

  return (
    <Screen>
      <Text style={styles.title}>Join an Agency</Text>
      <Text style={styles.subtitle}>
        Ask your supervisor for the agency code and the current agency password. Your name is how you'll show up in every
        activity log — enter it exactly as you want colleagues to see it.
      </Text>

      <Field label="Agency Code" placeholder="e.g. K3F9XQ" autoCapitalize="characters" value={agencyCode} onChangeText={setAgencyCode} />
      <Field label="Agency Password" placeholder="••••••••" secureTextEntry value={password} onChangeText={setPassword} />
      <Field label="Your Full Name" placeholder="e.g. Ibrahim Bangura" value={name} onChangeText={setName} />
      <Field label="Phone Number (optional)" placeholder="e.g. 076123456" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />

      {displayedError ? <Text style={styles.error}>{displayedError}</Text> : null}

      <Button title="Join Agency" onPress={onSubmit} loading={loading} style={styles.submit} />

      <View style={styles.linkRow}>
        <Text style={styles.linkText}>Already a member? </Text>
        <Text style={styles.link} onPress={() => navigation.navigate('Login')}>
          Log in
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
