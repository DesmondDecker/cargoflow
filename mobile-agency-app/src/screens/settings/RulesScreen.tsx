import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { AgencyRules, fetchAgencySettings, updateAgencyRules } from '../../api/agencyApi';
import { apiErrorMessage } from '../../api/client';
import { colors, radius, spacing, typography } from '../../theme/theme';

const DOCS: { key: string; label: string }[] = [
  { key: 'CTN', label: 'CTN' },
  { key: 'BL', label: 'Bill of Lading' },
  { key: 'Invoice', label: 'Invoice' },
  { key: 'PackingList', label: 'Packing List' },
  { key: 'CustomsDeclaration', label: 'Customs Declaration' },
  { key: 'Other', label: 'Other' },
];

// The agency's working rules. What stays fixed, on purpose, is the status
// pipeline itself: driver dispatch, the attention flags and the daily digest
// all compare against those exact statuses, so they can be renamed (Customize
// Labels) but not added, removed or reordered.
export function RulesScreen() {
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<AgencyRules | null>(null);
  const [required, setRequired] = useState<string[]>([]);
  const [windowDays, setWindowDays] = useState('');
  const [freeDays, setFreeDays] = useState('');
  const [graceDays, setGraceDays] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = (r: AgencyRules) => {
    setSaved(r);
    setRequired(r.requiredDocumentTypes);
    setWindowDays(String(r.attentionWindowDays));
    setFreeDays(String(r.defaultFreeStorageDays));
    setGraceDays(String(r.defaultGraceDays));
  };

  useEffect(() => {
    fetchAgencySettings().then((s) => apply(s.rules)).catch((err) => setError(apiErrorMessage(err))).finally(() => setLoading(false));
  }, []);

  const toggle = (key: string) => setRequired((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));

  const save = async () => {
    if (!saved) return;
    const numbers = { attentionWindowDays: Number(windowDays), defaultFreeStorageDays: Number(freeDays), defaultGraceDays: Number(graceDays) };
    if (Object.values(numbers).some((n) => !Number.isInteger(n))) return setError('Days must be whole numbers.');
    setBusy(true);
    setError(null);
    try {
      const result = await updateAgencyRules({ requiredDocumentTypes: required, ...numbers });
      apply(result.rules);
      Alert.alert('Saved', `${result.updatedContainers} open container${result.updatedContainers === 1 ? '' : 's'} updated to the new rules.`);
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
        <Text style={typography.h1}>Rules & Deadlines</Text>
        <Text style={typography.caption}>These apply to every container in your agency. When you save, all open containers are brought up to date straight away.</Text>

        <Card style={styles.stack}>
          <Text style={typography.bodyMedium}>Documents every container needs</Text>
          <Text style={typography.caption}>A container is flagged until each of these is uploaded.</Text>
          <View style={styles.chips}>
            {DOCS.map((d) => {
              const on = required.includes(d.key);
              return (
                <Pressable key={d.key} onPress={() => toggle(d.key)} style={[styles.chip, on && styles.chipOn]}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{d.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Card style={styles.stack}>
          <Text style={typography.bodyMedium}>Deadline warnings</Text>
          <Field label="Flag a deadline this many days ahead (1 to 14)" value={windowDays} onChangeText={setWindowDays} keyboardType="number-pad" />
        </Card>

        <Card style={styles.stack}>
          <Text style={typography.bodyMedium}>When a shipping line has no terms entered</Text>
          <Text style={typography.caption}>Used only for lines without their own terms under Grace Periods. Those terms always win.</Text>
          <Field label="Free storage days (0 to 60)" value={freeDays} onChangeText={setFreeDays} keyboardType="number-pad" />
          <Field label="Demurrage grace days (0 to 90)" value={graceDays} onChangeText={setGraceDays} keyboardType="number-pad" />
        </Card>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Save rules" onPress={save} loading={busy} disabled={busy} />
        <Text style={typography.caption}>The status steps (Pending Documents through Closed) are fixed because drivers, alerts and the daily summary depend on them. You can rename them under Customize Labels.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  chipOn: { borderColor: colors.orange, backgroundColor: colors.orange },
  chipText: { fontWeight: '600', color: colors.textPrimary },
  chipTextOn: { color: colors.white },
  error: { color: colors.urgent },
});
