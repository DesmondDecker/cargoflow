import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { resetTeamMemberPin } from '../../api/authApi';
import { apiErrorMessage } from '../../api/client';
import { MoreStackParamList } from '../../navigation/types';
import { colors, spacing, typography } from '../../theme/theme';

export function ResetPinScreen({ navigation, route }: NativeStackScreenProps<MoreStackParamList, 'ResetPin'>) {
  const { userId, name } = route.params;
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!/^\d{6}$/.test(pin)) return setError('The PIN must be exactly 6 digits.');
    setBusy(true);
    setError(null);
    try {
      const msg = await resetTeamMemberPin(userId, pin);
      Alert.alert('PIN reset', msg);
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
        <Text style={typography.h1}>Reset PIN for {name}</Text>
        <Text style={typography.caption}>They are signed out now. Tell them the new PIN in person, then ask them to change it from More → Users & Permissions.</Text>
        <Field label="New PIN (6 digits)" value={pin} onChangeText={setPin} secureTextEntry keyboardType="number-pad" maxLength={6} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Set PIN" onPress={submit} loading={busy} disabled={busy || !pin} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  error: { color: colors.urgent },
});
