import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { changeMyPin } from '../../api/authApi';
import { apiErrorMessage, setTokens } from '../../api/client';
import { MoreStackParamList } from '../../navigation/types';
import { colors, spacing, typography } from '../../theme/theme';

function deviceId(): string {
  if (Platform.OS === 'android') return Application.getAndroidId?.() || 'android-unknown-device';
  return Application.applicationId || 'device-unknown';
}

export function ChangeMyPinScreen({ navigation }: NativeStackScreenProps<MoreStackParamList, 'ChangeMyPin'>) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!/^\d{6}$/.test(next)) return setError('The new PIN must be exactly 6 digits.');
    if (next !== confirm) return setError('The new PINs do not match.');
    setBusy(true);
    setError(null);
    try {
      const r = await changeMyPin(current, next, deviceId());
      await setTokens(r.accessToken, r.refreshToken); // this device stays signed in; others are signed out
      Alert.alert('PIN changed', 'Your other devices were signed out.');
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
        <Text style={typography.h1}>Change my PIN</Text>
        <Text style={typography.caption}>Your PIN is personal. Do not share it, even with your supervisor — they can reset it if you forget it.</Text>
        <Field label="Current PIN" value={current} onChangeText={setCurrent} secureTextEntry keyboardType="number-pad" maxLength={6} />
        <Field label="New PIN (6 digits)" value={next} onChangeText={setNext} secureTextEntry keyboardType="number-pad" maxLength={6} />
        <Field label="New PIN again" value={confirm} onChangeText={setConfirm} secureTextEntry keyboardType="number-pad" maxLength={6} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Change PIN" onPress={submit} loading={busy} disabled={busy || !current || !next || !confirm} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  error: { color: colors.urgent },
});
