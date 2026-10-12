import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Field } from '../../components/Field';
import { Button } from '../../components/Button';
import { colors, spacing, typography } from '../../theme/theme';
import { fetchAgencyProfile, updateAgencyProfile } from '../../api/agencyApi';
import { apiErrorMessage } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { MoreStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MoreStackParamList, 'EditAgencyProfile'>;

export function EditAgencyProfileScreen({ navigation }: Props) {
  const agency = useAuthStore((s) => s.agency);
  const [agencyCode, setAgencyCode] = useState('');
  const [name, setName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const profile = await fetchAgencyProfile();
        setAgencyCode(profile.agencyCode);
        setName(profile.name);
        setContactEmail(profile.contactEmail || '');
        setContactPhone(profile.contactPhone || '');
        setAddress(profile.address || '');
      } catch (err) {
        setError(apiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onSave = async () => {
    if (!name.trim()) {
      setError('Agency name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateAgencyProfile({
        name: name.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
        address: address.trim(),
      });
      // Store only carries id/name/agencyCode (AgencySummary) — that's all
      // that's shown elsewhere in the app (e.g. MoreScreen), so only name
      // can actually change here; contact fields live purely in the API.
      useAuthStore.setState({ agency: agency ? { ...agency, name: updated.name } : agency });
      navigation.goBack();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Screen><Text style={typography.body}>Loading…</Text></Screen>;

  return (
    <Screen>
      <Field label="Agency Name" value={name} onChangeText={setName} placeholder="e.g. Bangura Freight Agency" />

      <Field label="Agency Code" value={agencyCode} editable={false} style={styles.locked} />
      <Text style={styles.lockedNote}>
        The join code staff use to sign up — locked here since changing it would break anyone mid-onboarding with the
        old code. Contact support if it genuinely needs to change.
      </Text>

      <Field label="Contact Email" value={contactEmail} onChangeText={setContactEmail} placeholder="Optional" keyboardType="email-address" autoCapitalize="none" />
      <Field label="Contact Phone" value={contactPhone} onChangeText={setContactPhone} placeholder="Optional" keyboardType="phone-pad" />
      <Field label="Address" value={address} onChangeText={setAddress} placeholder="Optional" multiline />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title={saving ? 'Saving…' : 'Save Changes'} onPress={onSave} loading={saving} style={styles.button} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  locked: { backgroundColor: colors.background, color: colors.textMuted },
  lockedNote: { ...typography.caption, color: colors.textSecondary, marginTop: -spacing.md, marginBottom: spacing.lg },
  error: { color: colors.urgent, marginBottom: spacing.md },
  button: { marginTop: spacing.sm },
});
