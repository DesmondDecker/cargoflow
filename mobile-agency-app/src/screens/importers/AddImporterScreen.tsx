import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Field } from '../../components/Field';
import { Button } from '../../components/Button';
import { colors, spacing } from '../../theme/theme';
import { createImporter } from '../../api/reportsApi';
import { apiErrorMessage } from '../../api/client';
import { ImportersStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ImportersStackParamList, 'AddImporter'>;

export function AddImporterScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSave = async () => {
    if (!name.trim()) {
      setError('Importer name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await createImporter({
        name: name.trim(),
        contactPerson: contactPerson.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
      });
      navigation.replace('ImporterProfile', { importerId: result.importer._id, importerName: result.importer.name });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Field label="Importer / Company Name" value={name} onChangeText={setName} placeholder="e.g. Bangura Traders" autoFocus />
      <Field label="Contact Person" value={contactPerson} onChangeText={setContactPerson} placeholder="Optional" />
      <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="Optional" keyboardType="phone-pad" />
      <Field label="Email" value={email} onChangeText={setEmail} placeholder="Optional" keyboardType="email-address" autoCapitalize="none" />
      <Field label="Address" value={address} onChangeText={setAddress} placeholder="Optional" multiline />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title={saving ? 'Saving…' : 'Save Importer'} onPress={onSave} loading={saving} style={styles.button} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.urgent, marginBottom: spacing.md },
  button: { marginTop: spacing.sm },
});
