import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { fetchLetter, letterDownloadRequest, saveLetter } from '../../api/lettersApi';
import { apiErrorMessage } from '../../api/client';
import { Letter } from '../../types/api';
import { ContainersStackParamList } from '../../navigation/types';
import { formatShortDateTime } from '../../utils/status';
import { downloadAndShare } from '../../utils/download';
import { colors, spacing, typography } from '../../theme/theme';

type Props = NativeStackScreenProps<ContainersStackParamList, 'LetterEditor'>;

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function LetterEditorScreen({ route, navigation }: Props) {
  const { letterId } = route.params;
  const [letter, setLetter] = useState<Letter | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);

  const apply = (l: Letter) => {
    setLetter(l);
    setValues(l.fields);
    navigation.setOptions({ title: l.template.title });
  };

  useFocusEffect(
    useCallback(() => {
      fetchLetter(letterId).then(apply).catch((err) => setError(apiErrorMessage(err)));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [letterId])
  );

  const changed = useMemo(() => {
    if (!letter) return {};
    const out: Record<string, string> = {};
    for (const f of letter.template.fields) {
      if ((values[f.key] ?? '') !== (letter.fields[f.key] ?? '')) out[f.key] = values[f.key] ?? '';
    }
    return out;
  }, [letter, values]);
  const dirty = Object.keys(changed).length > 0;

  const emptyRequired = useMemo(() => (letter ? letter.template.fields.filter((f) => f.required && !(values[f.key] ?? '').trim()) : []), [letter, values]);

  const save = async (): Promise<Letter | null> => {
    if (!dirty) return letter;
    setBusy('save');
    setError(null);
    try {
      const saved = await saveLetter(letterId, changed);
      apply(saved);
      return saved;
    } catch (err) {
      setError(apiErrorMessage(err));
      return null;
    } finally {
      setBusy(null);
    }
  };

  // The Word file is rebuilt on the server from the saved values, so what is
  // shared is always exactly what is on screen once it has been saved.
  const share = async () => {
    setError(null);
    const saved = await save();
    if (!saved) return;
    if (saved.missing.length > 0) {
      const labels = saved.template.fields.filter((f) => saved.missing.includes(f.key)).map((f) => f.label);
      Alert.alert('Not ready yet', `Fill in: ${labels.join(', ')}`);
      return;
    }
    setBusy('share');
    try {
      const fresh = await fetchLetter(letterId); // also refreshes an expired login before the download below
      const reference = (fresh.fields.bl_number || fresh.fields.bl_numbers || 'letter').replace(/[^A-Za-z0-9_-]+/g, '-');
      const fileName = `${fresh.templateKey}_${reference}.docx`;
      if (Platform.OS === 'web') {
        await downloadAndShare(`/letters/${letterId}/download`, fileName, DOCX_MIME, fresh.template.title);
        apply(await fetchLetter(letterId));
        return;
      }

      const { url, headers } = await letterDownloadRequest(letterId);
      const file = await File.downloadFileAsync(url, new File(Paths.cache, `${fresh.templateKey}_${reference}.docx`), { headers, idempotent: true });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Saved', `The letter was saved to ${file.uri}, but sharing is not available on this device.`);
        return;
      }
      await Sharing.shareAsync(file.uri, { mimeType: DOCX_MIME, UTI: 'org.openxmlformats.wordprocessingml.document', dialogTitle: fresh.template.title });
      apply(await fetchLetter(letterId));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  if (!letter) {
    return <Screen>{error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.orange} style={{ marginTop: spacing.xl }} />}</Screen>;
  }

  return (
    <Screen>
      <View style={styles.stack}>
        <Text style={typography.h2}>{letter.template.title}</Text>
        <Text style={typography.caption}>Addressed to {letter.template.carrier}. Filled in from this shipment and the client's record. Check every field, then download the Word file.</Text>

        {letter.warnings.length > 0 ? (
          <Card style={styles.warning}>
            {letter.warnings.map((w) => <Text key={w} style={styles.warningText}>{w}</Text>)}
          </Card>
        ) : null}

        {letter.template.fields.map((f) => {
          const empty = f.required && !(values[f.key] ?? '').trim();
          return (
            <View key={f.key}>
              <Field
                label={`${f.label}${f.required ? ' *' : ''}`}
                value={values[f.key] ?? ''}
                onChangeText={(t) => setValues((v) => ({ ...v, [f.key]: t }))}
                placeholder={f.hint}
                multiline={f.multiline}
                autoCapitalize="none"
                maxLength={500}
              />
              {empty ? <Text style={styles.required}>Required</Text> : null}
            </View>
          );
        })}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button title={dirty ? 'Save changes' : 'Saved'} variant="outline" onPress={save} loading={busy === 'save'} disabled={!dirty || busy !== null} />
        <Button title="Download Word file" onPress={share} loading={busy === 'share'} disabled={busy !== null || emptyRequired.length > 0} />
        {emptyRequired.length > 0 ? <Text style={typography.caption}>{emptyRequired.length} required field{emptyRequired.length === 1 ? '' : 's'} still empty.</Text> : null}

        <Card style={styles.stack}>
          <Text style={typography.bodyMedium}>Edit history</Text>
          {letter.history.map((h, i) => (
            <Text key={`${h.editedAt}-${i}`} style={typography.caption}>{formatShortDateTime(h.editedAt)} · {h.editedByName}</Text>
          ))}
          {letter.lastDownloadedAt ? <Text style={typography.caption}>Last downloaded {formatShortDateTime(letter.lastDownloadedAt)}</Text> : null}
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  error: { color: colors.urgent },
  required: { color: colors.urgent, fontSize: 12, marginTop: -spacing.sm, marginBottom: spacing.xs },
  warning: { backgroundColor: colors.attentionBg, gap: spacing.xs },
  warningText: { color: colors.attention, fontWeight: '600' },
});
