import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { changeAgencyPassword } from '../../api/authApi';
import { apiErrorMessage } from '../../api/client';
import { MoreStackParamList } from '../../navigation/types';
import { colors, spacing, typography } from '../../theme/theme';

export function ChangeAgencyPasswordScreen({ navigation }: NativeStackScreenProps<MoreStackParamList, 'ChangeAgencyPassword'>) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (next.length < 8) return setError('The new password must be at least 8 characters.');
    if (next !== confirm) return setError('The new passwords do not match.');
    setBusy(true);
    setError(null);
    try {
      await changeAgencyPassword(current, next);
      Alert.alert('Agency password changed', 'New staff will need the new password to join. People already signed in are not affected.');
      navigation.goBack();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.stack}>
        <Text style={typography.h1}>Agency password</Text>
        <Text style={typography.caption}>This password only lets new staff join. Each person logs in with their own PIN, so changing it does not sign anyone out.</Text>
        <Field label="Current password" value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" />
        <Field label="New password (8+ characters)" value={next} onChangeText={setNext} secureTextEntry autoCapitalize="none" />
        <Field label="New password again" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Change password" onPress={submit} loading={busy} disabled={busy || !current || !next || !confirm} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  error: { color: colors.urgent },
});
