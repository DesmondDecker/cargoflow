import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { createCustomsSubmission, fetchCustomsSubmission, resubmitCustomsSubmission } from '../../api/customsApi';
import { apiErrorMessage } from '../../api/client';
import { CustomsFields, CustomsSubmission } from '../../types/api';
import { CustomsStackParamList } from '../../navigation/types';
import { formatShortDateTime } from '../../utils/status';
import { colors, spacing, typography } from '../../theme/theme';

type Props = NativeStackScreenProps<CustomsStackParamList, 'CustomsSubmission'>;

const EMPTY: CustomsFields = { cvcNumber: '', billOfLadingNumber: '', shippingAgency: '', containerNumber: '', documentName: '', itsNumber: '' };

const FIELDS: { key: keyof CustomsFields; label: string; hint?: string }[] = [
  { key: 'cvcNumber', label: 'CVC number' },
  { key: 'billOfLadingNumber', label: 'Bill of lading number' },
  { key: 'shippingAgency', label: 'Shipping agency', hint: 'e.g. Maersk Line Sierra Leone' },
  { key: 'containerNumber', label: 'Container number', hint: '4 letters and 7 digits' },
  { key: 'documentName', label: 'Document name' },
  { key: 'itsNumber', label: 'ITS number' },
];

const ACTIONS: Record<string, string> = {
  submitted: 'Sent to Customs',
  resubmitted: 'Corrected and sent again',
  approved: 'Approved by Customs',
  returned: 'Returned by Customs',
  email_sent: 'AGL notified by email',
  email_failed: 'AGL email failed',
  email_not_configured: 'AGL email not sent',
};

// One screen for a new submission, for fixing a returned one, and for looking
// at one that is waiting or approved (read-only, with its history).
export function CustomsSubmissionScreen({ route, navigation }: Props) {
  const submissionId = route.params?.submissionId;
  const prefill = route.params?.prefill;
  const [submission, setSubmission] = useState<CustomsSubmission | null>(null);
  const [values, setValues] = useState<CustomsFields>({ ...EMPTY, ...prefill });
  const [loading, setLoading] = useState(!!submissionId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!submissionId) return;
    fetchCustomsSubmission(submissionId)
      .then((s) => {
        setSubmission(s);
        setValues({ cvcNumber: s.cvcNumber, billOfLadingNumber: s.billOfLadingNumber, shippingAgency: s.shippingAgency, containerNumber: s.containerNumber, documentName: s.documentName, itsNumber: s.itsNumber });
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [submissionId]);

  const editable = !submission || submission.status === 'returned';
  const complete = FIELDS.every((f) => values[f.key].trim().length > 0);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = submission ? await resubmitCustomsSubmission(submission._id, values) : await createCustomsSubmission(values);
      Alert.alert('Sent to Customs', result.warnings.length ? result.warnings.join('\n\n') : 'You will see the result here, and get a notification when Customs decides.');
      navigation.goBack();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Screen><ActivityIndicator color={colors.orange} style={{ marginTop: spacing.xl }} /></Screen>;

  return (
    <Screen>
      <View style={styles.stack}>
        <Text style={typography.h1}>{submission ? submission.containerNumber : 'New submission'}</Text>

        {submission?.status === 'returned' ? (
          <Card style={styles.returnedCard}>
            <Text style={styles.returnedTitle}>Returned by Customs</Text>
            <Text style={styles.returnedText}>{submission.returnReason}</Text>
            <Text style={typography.caption}>Fix the details below and send it again.</Text>
          </Card>
        ) : null}
        {submission?.status === 'approved' ? (
          <Card style={styles.approvedCard}>
            <Text style={styles.approvedTitle}>Approved</Text>
            <Text style={typography.bodyMedium}>{submission.approvalReference}</Text>
            <Text style={typography.caption}>{submission.reviewedByName} · {formatShortDateTime(submission.reviewedAt)}</Text>
          </Card>
        ) : null}
        {submission?.status === 'pending' ? <Text style={typography.caption}>Waiting for Customs. Sent {formatShortDateTime(submission.submittedAt)}. You cannot change it while it is being reviewed.</Text> : null}

        {FIELDS.map((f) => (
          <Field
            key={f.key}
            label={f.label}
            value={values[f.key]}
            onChangeText={(t) => setValues((v) => ({ ...v, [f.key]: t }))}
            placeholder={f.hint}
            editable={editable}
            autoCapitalize={f.key === 'shippingAgency' || f.key === 'documentName' ? 'words' : 'characters'}
            autoCorrect={false}
          />
        ))}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {editable ? <Button title={submission ? 'Send again to Customs' : 'Send to Customs'} onPress={send} loading={busy} disabled={busy || !complete} /> : null}

        {submission ? (
          <Card style={styles.stack}>
            <Text style={typography.bodyMedium}>History</Text>
            {[...submission.history].reverse().map((h, i) => (
              <Text key={`${h.at}-${i}`} style={typography.caption}>{formatShortDateTime(h.at)} · {ACTIONS[h.action] ?? h.action} · {h.actorName}{h.note && h.action === 'returned' ? `: ${h.note}` : ''}</Text>
            ))}
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  error: { color: colors.urgent },
  returnedCard: { backgroundColor: colors.urgentBg, gap: spacing.xs },
  returnedTitle: { color: colors.urgent, fontWeight: '800' },
  returnedText: { color: colors.urgent, fontWeight: '600' },
  approvedCard: { backgroundColor: colors.normalBg, gap: spacing.xs },
  approvedTitle: { color: colors.normal, fontWeight: '800' },
});
