import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Field } from '../../components/Field';
import { Button } from '../../components/Button';
import { colors, radius, spacing, typography } from '../../theme/theme';
import { fetchImporters, createImporter } from '../../api/reportsApi';
import { fetchBillsOfLading, createBillOfLading, BillOfLading } from '../../api/billOfLadingApi';
import { createContainer } from '../../api/containerApi';
import { apiErrorMessage } from '../../api/client';
import { Importer, ContainerSize } from '../../types/api';
import { ContainersStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ContainersStackParamList, 'AddContainer'>;

const SIZES: ContainerSize[] = ['20ft', '40ft', '40ft HC', '45ft'];

export function AddContainerScreen({ navigation }: Props) {
  // --- Importer ---
  const [importerQuery, setImporterQuery] = useState('');
  const [importerResults, setImporterResults] = useState<Importer[]>([]);
  const [selectedImporter, setSelectedImporter] = useState<Importer | null>(null);
  const [showNewImporter, setShowNewImporter] = useState(false);
  const [newImporterName, setNewImporterName] = useState('');
  const [newImporterPhone, setNewImporterPhone] = useState('');
  const [creatingImporter, setCreatingImporter] = useState(false);

  // --- Bill of Lading ---
  const [blOptions, setBlOptions] = useState<BillOfLading[]>([]);
  const [blLoading, setBlLoading] = useState(false);
  const [selectedBl, setSelectedBl] = useState<BillOfLading | null>(null);
  const [showNewBl, setShowNewBl] = useState(false);
  const [newBlNumber, setNewBlNumber] = useState('');
  const [newShippingLine, setNewShippingLine] = useState('');
  const [newVessel, setNewVessel] = useState('');
  const [creatingBl, setCreatingBl] = useState(false);

  // --- Container ---
  const [containerNumber, setContainerNumber] = useState('');
  const [size, setSize] = useState<ContainerSize>('20ft');
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const searchImporters = useCallback(async (query: string) => {
    setImporterQuery(query);
    if (!query.trim()) {
      setImporterResults([]);
      return;
    }
    try {
      const result = await fetchImporters({ search: query });
      setImporterResults(result.importers);
    } catch {
      // A failed search just shows no suggestions — not worth surfacing as a page-level error.
    }
  }, []);

  const loadBillsFor = useCallback(async (importerId: string) => {
    setBlLoading(true);
    setSelectedBl(null);
    try {
      const bls = await fetchBillsOfLading({ importerId });
      setBlOptions(bls);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBlLoading(false);
    }
  }, []);

  const onSelectImporter = (importer: Importer) => {
    setSelectedImporter(importer);
    setShowNewImporter(false);
    setImporterResults([]);
    setImporterQuery(importer.name);
    loadBillsFor(importer._id);
  };

  const onCreateImporter = async () => {
    if (!newImporterName.trim()) {
      setError('Importer name is required.');
      return;
    }
    setCreatingImporter(true);
    setError(null);
    try {
      const result = await createImporter({ name: newImporterName.trim(), phone: newImporterPhone.trim() || undefined });
      onSelectImporter(result.importer);
      setShowNewImporter(false);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setCreatingImporter(false);
    }
  };

  const onCreateBl = async () => {
    if (!selectedImporter) return;
    if (!newBlNumber.trim()) {
      setError('B/L number is required.');
      return;
    }
    setCreatingBl(true);
    setError(null);
    try {
      const bl = await createBillOfLading({
        importerId: selectedImporter._id,
        blNumber: newBlNumber.trim(),
        shippingLine: newShippingLine.trim() || undefined,
        vesselName: newVessel.trim() || undefined,
      });
      setSelectedBl(bl);
      setBlOptions((prev) => [bl, ...prev]);
      setShowNewBl(false);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setCreatingBl(false);
    }
  };

  const onSave = async () => {
    if (!selectedImporter) {
      setError('Choose or create an importer first.');
      return;
    }
    if (!selectedBl) {
      setError('Choose or create a bill of lading first.');
      return;
    }
    if (!containerNumber.trim()) {
      setError('Container number is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const container = await createContainer({
        containerNumber: containerNumber.trim(),
        importerId: selectedImporter._id,
        blId: selectedBl._id,
        size,
      });
      navigation.replace('ContainerCaseFile', { containerId: container._id, containerNumber: container.containerNumber });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.sectionTitle}>1. Importer</Text>
      <Card style={styles.card}>
        {selectedImporter ? (
          <View style={styles.selectedRow}>
            <View>
              <Text style={styles.selectedName}>{selectedImporter.name}</Text>
              <Text style={styles.selectedMeta}>Importer selected</Text>
            </View>
            <Pressable onPress={() => { setSelectedImporter(null); setSelectedBl(null); setBlOptions([]); setImporterQuery(''); }}>
              <Text style={styles.changeLink}>Change</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Field label="Search importers" value={importerQuery} onChangeText={searchImporters} placeholder="Start typing a name..." />
            {importerResults.length > 0 ? (
              <FlatList
                data={importerResults}
                keyExtractor={(item) => item._id}
                style={styles.resultsList}
                renderItem={({ item }) => (
                  <Pressable style={styles.resultRow} onPress={() => onSelectImporter(item)}>
                    <Text style={styles.resultText}>{item.name}</Text>
                  </Pressable>
                )}
              />
            ) : null}

            {showNewImporter ? (
              <View style={styles.inlineForm}>
                <Field label="New Importer Name" value={newImporterName} onChangeText={setNewImporterName} placeholder="e.g. Bangura Traders" />
                <Field label="Phone (optional)" value={newImporterPhone} onChangeText={setNewImporterPhone} keyboardType="phone-pad" />
                <Button title={creatingImporter ? 'Creating…' : 'Create & Use'} onPress={onCreateImporter} loading={creatingImporter} />
              </View>
            ) : (
              <Pressable onPress={() => setShowNewImporter(true)}>
                <Text style={styles.addNewLink}>+ New importer</Text>
              </Pressable>
            )}
          </>
        )}
      </Card>

      <Text style={[styles.sectionTitle, !selectedImporter && styles.sectionDisabled]}>2. Bill of Lading</Text>
      <Card style={[styles.card, !selectedImporter && styles.cardDisabled]}>
        {!selectedImporter ? (
          <Text style={styles.helperText}>Choose an importer first.</Text>
        ) : selectedBl ? (
          <View style={styles.selectedRow}>
            <View>
              <Text style={styles.selectedName}>{selectedBl.blNumber}</Text>
              <Text style={styles.selectedMeta}>{selectedBl.shippingLine || 'Bill of lading selected'}</Text>
            </View>
            <Pressable onPress={() => setSelectedBl(null)}>
              <Text style={styles.changeLink}>Change</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {blLoading ? <Text style={styles.helperText}>Loading bills of lading…</Text> : null}
            {blOptions.map((bl) => (
              <Pressable key={bl._id} style={styles.resultRow} onPress={() => setSelectedBl(bl)}>
                <Text style={styles.resultText}>{bl.blNumber}{bl.shippingLine ? ` — ${bl.shippingLine}` : ''}</Text>
              </Pressable>
            ))}
            {showNewBl ? (
              <View style={styles.inlineForm}>
                <Field label="B/L Number" value={newBlNumber} onChangeText={setNewBlNumber} autoCapitalize="characters" placeholder="e.g. MEDU1234567" />
                <Field label="Shipping Line (optional)" value={newShippingLine} onChangeText={setNewShippingLine} />
                <Field label="Vessel (optional)" value={newVessel} onChangeText={setNewVessel} />
                <Button title={creatingBl ? 'Creating…' : 'Create & Use'} onPress={onCreateBl} loading={creatingBl} />
              </View>
            ) : (
              <Pressable onPress={() => setShowNewBl(true)}>
                <Text style={styles.addNewLink}>+ New bill of lading</Text>
              </Pressable>
            )}
          </>
        )}
      </Card>

      <Text style={[styles.sectionTitle, !selectedBl && styles.sectionDisabled]}>3. Container</Text>
      <Card style={[styles.card, !selectedBl && styles.cardDisabled]}>
        <Field
          label="Container Number"
          value={containerNumber}
          onChangeText={setContainerNumber}
          placeholder="e.g. MSCU1234567"
          autoCapitalize="characters"
          editable={!!selectedBl}
        />
        <Text style={styles.label}>SIZE</Text>
        <View style={styles.sizeRow}>
          {SIZES.map((s) => (
            <Pressable
              key={s}
              onPress={() => setSize(s)}
              disabled={!selectedBl}
              style={[styles.sizeChip, size === s && styles.sizeChipActive]}
            >
              <Text style={[styles.sizeChipText, size === s && styles.sizeChipTextActive]}>{s}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title={saving ? 'Registering…' : 'Register Container'} onPress={onSave} loading={saving} style={styles.saveButton} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { ...typography.label, textTransform: 'uppercase', marginBottom: spacing.sm, marginTop: spacing.md },
  sectionDisabled: { color: colors.textMuted },
  card: { marginBottom: spacing.md },
  cardDisabled: { opacity: 0.6 },
  helperText: { ...typography.caption },
  selectedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectedName: { ...typography.bodyMedium },
  selectedMeta: { ...typography.caption, marginTop: 2 },
  changeLink: { color: colors.orange, fontWeight: '600' },
  resultsList: { maxHeight: 160, marginTop: spacing.xs },
  resultRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultText: { ...typography.body },
  addNewLink: { color: colors.orange, fontWeight: '600', marginTop: spacing.sm },
  inlineForm: { marginTop: spacing.sm, gap: 0 },
  label: { ...typography.label, marginTop: spacing.md, marginBottom: spacing.xs },
  sizeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sizeChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  sizeChipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  sizeChipText: { ...typography.caption, fontWeight: '600' },
  sizeChipTextActive: { color: colors.white },
  error: { color: colors.urgent, marginVertical: spacing.md },
  saveButton: { marginTop: spacing.sm, marginBottom: spacing.xxl },
});
