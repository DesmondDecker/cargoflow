import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Field } from '../../components/Field';
import { Button } from '../../components/Button';
import { colors, spacing, typography } from '../../theme/theme';
import { upsertDemurrageTerm, fetchKnownCarriers } from '../../api/agencyApi';
import { apiErrorMessage } from '../../api/client';
import { MoreStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MoreStackParamList, 'AddDemurrageTerm'>;

export function AddDemurrageTermScreen({ navigation, route }: Props) {
  const existing = route.params?.existing;
  const [shippingLine, setShippingLine] = useState(existing?.shippingLine ?? '');
  const [freeStorageDays, setFreeStorageDays] = useState(existing?.freeStorageDays != null ? String(existing.freeStorageDays) : '');
  const [demurrageGraceDays, setDemurrageGraceDays] = useState(
    existing?.demurrageGraceDays != null ? String(existing.demurrageGraceDays) : ''
  );
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Global-table carriers plus whatever this agency's own containers have
  // actually shown — free-typing the name is what's here on edit (locked
  // below), but on add it has to match container.shippingLine exactly or
  // the term silently never applies, so a picker beats a text box.
  const [knownCarriers, setKnownCarriers] = useState<string[]>([]);
  useEffect(() => {
    if (existing) return;
    fetchKnownCarriers().then(setKnownCarriers).catch(() => {
      // No suggestions is a degraded experience, not a blocker — free-typing still works.
    });
  }, [existing]);

  const suggestions =
    !existing && shippingLine.trim()
      ? knownCarriers.filter((c) => c.toLowerCase().includes(shippingLine.trim().toLowerCase()) && c !== shippingLine)
      : [];

  const onSave = async () => {
    if (!shippingLine.trim()) {
      setError('Shipping line is required — use the exact name shown on the container (e.g. "Maersk", "CMA CGM").');
      return;
    }
    const free = freeStorageDays.trim() ? Number(freeStorageDays) : null;
    const grace = demurrageGraceDays.trim() ? Number(demurrageGraceDays) : null;
    if ((free != null && (Number.isNaN(free) || free < 0)) || (grace != null && (Number.isNaN(grace) || grace < 0))) {
      setError('Days must be a positive number.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await upsertDemurrageTerm({
        shippingLine: shippingLine.trim(),
        freeStorageDays: free,
        demurrageGraceDays: grace,
        notes: notes.trim() || undefined,
      });
      navigation.goBack();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Field
        label="Shipping Line"
        value={shippingLine}
        onChangeText={setShippingLine}
        placeholder='Start typing, e.g. "Maersk"'
        autoFocus={!existing}
        editable={!existing}
      />
      {suggestions.length > 0 ? (
        <FlatList
          data={suggestions.slice(0, 6)}
          keyExtractor={(item) => item}
          style={styles.resultsList}
          renderItem={({ item }) => (
            <Pressable style={styles.resultRow} onPress={() => setShippingLine(item)}>
              <Text style={styles.resultText}>{item}</Text>
            </Pressable>
          )}
        />
      ) : null}
      {existing ? (
        <Text style={styles.lockedNote}>Shipping line can&apos;t be changed on an existing entry — remove it and add a new one instead.</Text>
      ) : null}

      <Field
        label="Free Storage Days"
        value={freeStorageDays}
        onChangeText={setFreeStorageDays}
        placeholder="Leave blank to use the app default (4)"
        keyboardType="number-pad"
      />
      <Field
        label="Demurrage Grace Days"
        value={demurrageGraceDays}
        onChangeText={setDemurrageGraceDays}
        placeholder="Leave blank to use the app default (7)"
        keyboardType="number-pad"
      />
      <Field
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        placeholder="Optional — e.g. where these terms came from"
        multiline
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        title={saving ? 'Saving…' : 'Save Terms'}
        onPress={onSave}
        loading={saving}
        style={styles.button}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  resultsList: { maxHeight: 160, marginTop: -spacing.sm, marginBottom: spacing.md },
  resultRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultText: { ...typography.body },
  lockedNote: { ...typography.caption, color: colors.textSecondary, marginTop: -spacing.sm, marginBottom: spacing.md },
  error: { color: colors.urgent, marginBottom: spacing.md },
  button: { marginTop: spacing.sm },
});
