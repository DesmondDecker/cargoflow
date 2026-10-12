import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Field } from '../../components/Field';
import { Button } from '../../components/Button';
import { colors, spacing, typography } from '../../theme/theme';
import { fetchAgencySettings, updateAgencyLabels, LabeledOption } from '../../api/agencyApi';
import { apiErrorMessage } from '../../api/client';
import { MoreStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MoreStackParamList, 'EditLabels'>;

// Relabels the fixed status pipeline and document types to match how this
// agency actually talks about them — "Under Clearance" could become
// "With Customs", say. What's NOT here on purpose: adding, removing, or
// reordering a status or document type. Those are wired into how the app
// behaves (driver dispatch, urgency flags, the daily digest) — see
// agencyController's own comment for the specifics — so this screen can
// only change the word shown, never the underlying step.
export function EditLabelsScreen({ navigation }: Props) {
  const [statusPipeline, setStatusPipeline] = useState<LabeledOption[]>([]);
  const [documentTypes, setDocumentTypes] = useState<LabeledOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const settings = await fetchAgencySettings();
        setStatusPipeline(settings.statusPipeline);
        setDocumentTypes(settings.documentTypes);
      } catch (err) {
        setError(apiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setStatusLabel = (key: string, label: string) =>
    setStatusPipeline((prev) => prev.map((s) => (s.key === key ? { ...s, label } : s)));
  const setDocTypeLabel = (key: string, label: string) =>
    setDocumentTypes((prev) => prev.map((d) => (d.key === key ? { ...d, label } : d)));

  const onSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateAgencyLabels({
        statusLabels: Object.fromEntries(statusPipeline.map((s) => [s.key, s.label.trim() || s.key])),
        documentTypeLabels: Object.fromEntries(documentTypes.map((d) => [d.key, d.label.trim() || d.key])),
      });
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
      <Text style={styles.intro}>
        Change what staff see for each step and document type. The underlying step stays the same either way — this
        only relabels it.
      </Text>

      <Text style={styles.sectionTitle}>Status Pipeline</Text>
      {statusPipeline.map((s) => (
        <View key={s.key} style={styles.row}>
          <Field label={s.key} value={s.label} onChangeText={(v) => setStatusLabel(s.key, v)} />
        </View>
      ))}

      <Text style={styles.sectionTitle}>Document Types</Text>
      {documentTypes.map((d) => (
        <View key={d.key} style={styles.row}>
          <Field label={d.key} value={d.label} onChangeText={(v) => setDocTypeLabel(d.key, v)} />
        </View>
      ))}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title={saving ? 'Saving…' : 'Save Labels'} onPress={onSave} loading={saving} style={styles.button} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.lg, lineHeight: 18 },
  sectionTitle: { ...typography.h3, marginTop: spacing.md, marginBottom: spacing.sm },
  row: { marginBottom: spacing.xs },
  error: { color: colors.urgent, marginVertical: spacing.md },
  button: { marginTop: spacing.md, marginBottom: spacing.xxl },
});
