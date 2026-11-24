import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Field } from '../../components/Field';
import { Button } from '../../components/Button';
import { IdCardSection } from '../../components/IdCardSection';
import { colors, spacing, typography } from '../../theme/theme';
import { createImporter, fetchImporterProfile, updateImporter } from '../../api/reportsApi';
import { apiErrorMessage } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { Importer } from '../../types/api';
import { enqueueOutbox, isNetworkError } from '../../offline/outbox';
import { Alert } from 'react-native';
import { ImportersStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ImportersStackParamList, 'AddImporter'>;

// One form for adding a client and for editing one. These details also feed
// the letters (address lines, city, country, contact person), so they are
// worth keeping complete.
export function AddImporterScreen({ navigation, route }: Props) {
  const importerId = route.params?.importerId;
  const role = useAuthStore((s) => s.user?.role);
  const [loaded, setLoaded] = useState(!importerId);
  const [importer, setImporter] = useState<Importer | null>(null);
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [tin, setTin] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!importerId) return;
    navigation.setOptions({ title: 'Edit client' });
    fetchImporterProfile(importerId)
      .then(({ importer: i }) => {
        setImporter(i);
        setName(i.name);
        setContactPerson(i.contactPerson ?? '');
        setPhone(i.phone ?? '');
        setEmail(i.email ?? '');
        setAddress(i.address ?? '');
        setAddressLine2(i.addressLine2 ?? '');
        setCity(i.city ?? '');
        setCountry(i.country ?? '');
        setTin(i.tin ?? '');
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoaded(true));
  }, [importerId, navigation]);

  const onSave = async () => {
    if (!name.trim()) {
      setError('Client name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    const fields = {
      contactPerson: contactPerson.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      addressLine2: addressLine2.trim(),
      city: city.trim(),
      country: country.trim(),
      tin: tin.trim(),
    };
    try {
      if (importerId) {
        await updateImporter(importerId, { name: name.trim(), ...fields });
        navigation.goBack();
      } else {
        const result = await createImporter({ name: name.trim(), ...fields });
        navigation.replace('ImporterProfile', { importerId: result.importer._id, importerName: result.importer.name });
      }
    } catch (err) {
      if (isNetworkError(err)) {
        // No signal: keep the change on the phone and send it when online.
        await enqueueOutbox(importerId ? 'importer_update' : 'importer_create', importerId ? { id: importerId, name: name.trim(), input: { name: name.trim(), ...fields } } : { name: name.trim(), input: { name: name.trim(), ...fields } });
        Alert.alert('Saved on this phone', 'You are offline. The client will be saved to the server automatically when you are back online.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      } else {
        setError(apiErrorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return <Screen><ActivityIndicator color={colors.orange} style={{ marginTop: spacing.xl }} /></Screen>;
  }

  return (
    <Screen>
      <Field label="Client / Company Name" value={name} onChangeText={setName} placeholder="e.g. Bangura Traders" autoFocus={!importerId} />
      <Field label="Contact Person" value={contactPerson} onChangeText={setContactPerson} placeholder="Optional. Used as the signer on letters" />
      <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="Optional" keyboardType="phone-pad" />
      <Field label="Email" value={email} onChangeText={setEmail} placeholder="Optional" keyboardType="email-address" autoCapitalize="none" />
      <Field label="TIN (taxpayer identification number)" value={tin} onChangeText={setTin} placeholder="Optional" autoCapitalize="characters" />
      <Text style={styles.section}>Address (used on letters)</Text>
      <Field label="Address line 1" value={address} onChangeText={setAddress} placeholder="Optional" />
      <Field label="Address line 2" value={addressLine2} onChangeText={setAddressLine2} placeholder="Optional" />
      <Field label="City" value={city} onChangeText={setCity} placeholder="e.g. Freetown" />
      <Field label="Country" value={country} onChangeText={setCountry} placeholder="e.g. Sierra Leone" />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title={saving ? 'Saving…' : importerId ? 'Save changes' : 'Save client'} onPress={onSave} loading={saving} style={styles.button} />

      {importerId ? (
        <IdCardSection
          importerId={importerId}
          hasFront={!!importer?.hasIdCardFront}
          hasBack={!!importer?.hasIdCardBack}
          canView={role === 'owner' || role === 'admin'}
          onChanged={(updated) => setImporter((prev) => (prev ? { ...prev, hasIdCardFront: updated.hasIdCardFront, hasIdCardBack: updated.hasIdCardBack } : prev))}
        />
      ) : (
        <Text style={styles.hint}>Save the client first, then you can add ID card photos.</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { ...typography.label, marginTop: spacing.sm, marginBottom: spacing.xs },
  error: { color: colors.urgent, marginBottom: spacing.md },
  button: { marginTop: spacing.sm, marginBottom: spacing.lg },
  hint: { ...typography.caption, textAlign: 'center' },
});
