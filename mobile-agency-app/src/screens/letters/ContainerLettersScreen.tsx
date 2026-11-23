import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { createLetter, deleteLetter, fetchContainerLetters, fetchLetterTemplates } from '../../api/lettersApi';
import { fetchContainerCaseFile } from '../../api/containerApi';
import { apiErrorMessage } from '../../api/client';
import { LetterSummary, LetterTemplate } from '../../types/api';
import { ContainersStackParamList } from '../../navigation/types';
import { formatShortDateTime } from '../../utils/status';
import { colors, radius, spacing, typography } from '../../theme/theme';

type Props = NativeStackScreenProps<ContainersStackParamList, 'ContainerLetters'>;

export function ContainerLettersScreen({ route, navigation }: Props) {
  const { containerId } = route.params;
  const [letters, setLetters] = useState<LetterSummary[]>([]);
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [shippingLine, setShippingLine] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [list, tpl, caseFile] = await Promise.all([fetchContainerLetters(containerId), fetchLetterTemplates(), fetchContainerCaseFile(containerId)]);
      setLetters(list);
      setTemplates(tpl);
      setShippingLine(caseFile.container.shippingLine);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [containerId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const start = async (templateKey: string) => {
    setCreating(true);
    try {
      const letter = await createLetter(containerId, templateKey);
      setPickerOpen(false);
      navigation.navigate('LetterEditor', { letterId: letter._id });
    } catch (err) {
      Alert.alert('Could not start the letter', apiErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const confirmDelete = (letter: LetterSummary) =>
    Alert.alert('Delete this letter?', letter.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteLetter(letter._id);
            await load();
          } catch (err) {
            Alert.alert('Could not delete', apiErrorMessage(err));
          }
        },
      },
    ]);

  // Letters addressed to this container's shipping line come first.
  const ordered = [...templates].sort((a, b) => Number(b.carrier === shippingLine) - Number(a.carrier === shippingLine));

  return (
    <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.orange} />}>
      <View style={styles.stack}>
        <Text style={typography.h1}>Letters</Text>
        <Text style={typography.caption}>Start a letter and CargoFlow fills in what it knows about this shipment and the client. Fill in the rest, then download the Word file.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="New letter" onPress={() => setPickerOpen(true)} disabled={templates.length === 0} />

        {loading && letters.length === 0 ? <ActivityIndicator color={colors.orange} /> : null}
        {!loading && letters.length === 0 ? <Text style={typography.caption}>No letters for this container yet.</Text> : null}

        {letters.map((l) => (
          <Pressable key={l._id} onPress={() => navigation.navigate('LetterEditor', { letterId: l._id })} onLongPress={() => confirmDelete(l)}>
            <Card style={styles.stack}>
              <Text style={typography.bodyMedium}>{l.title}</Text>
              <Text style={typography.caption}>Updated {formatShortDateTime(l.updatedAt)} by {l.createdByName}</Text>
              {l.missingCount > 0 ? <Text style={styles.missing}>{l.missingCount} field{l.missingCount === 1 ? '' : 's'} still to fill in</Text> : <Text style={styles.ready}>Ready to download</Text>}
            </Card>
          </Pressable>
        ))}
        {letters.length > 0 ? <Text style={typography.caption}>Press and hold a letter to delete it.</Text> : null}
      </View>

      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={[styles.stack, { padding: spacing.lg }]}>
            <Text style={typography.h1}>Choose a letter</Text>
            {ordered.map((t) => (
              <Pressable key={t.key} disabled={creating} onPress={() => start(t.key)}>
                <Card style={styles.stack}>
                  <Text style={typography.bodyMedium}>{t.title}</Text>
                  <Text style={typography.caption}>{t.description}</Text>
                  {t.carrier === shippingLine ? <Text style={styles.match}>Matches this container's shipping line</Text> : null}
                </Card>
              </Pressable>
            ))}
            <Button title="Cancel" variant="outline" onPress={() => setPickerOpen(false)} disabled={creating} />
          </View>
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  modal: { flex: 1, backgroundColor: colors.background },
  error: { color: colors.urgent },
  missing: { color: colors.attention, fontWeight: '700', fontSize: 13 },
  ready: { color: colors.normal, fontWeight: '700', fontSize: 13 },
  match: { color: colors.info, fontWeight: '700', fontSize: 12, backgroundColor: colors.infoBg, alignSelf: 'flex-start', paddingHorizontal: spacing.md, paddingVertical: 2, borderRadius: radius.pill },
});
