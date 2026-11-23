import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { SearchBar } from '../../components/SearchBar';
import { bookStorage, fetchStorageCandidates, StorageCandidate } from '../../api/storageApi';
import { apiErrorMessage } from '../../api/client';
import { ContainersStackParamList } from '../../navigation/types';
import { colors, radius, spacing, typography } from '../../theme/theme';

type Props = NativeStackScreenProps<ContainersStackParamList, 'FindStorage'>;

const AMENITY_LABEL: Record<string, string> = {
  secured_247: '24/7 security',
  cctv: 'CCTV',
  forklift_onsite: 'Forklift',
  loading_dock: 'Loading dock',
  climate_controlled: 'Climate controlled',
  fire_suppression: 'Fire suppression',
  weighbridge: 'Weighbridge',
};
const UNIT_LABEL = { sqm: 'sqm', container_slot: 'container slot' } as const;

const DAY_MS = 86400000;
const toDay = (d: Date) => d.toISOString().slice(0, 10);
const validDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && toDay(new Date(`${v}T00:00:00Z`)) === v;
const money = (n: number) => `SLE ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

// Storage is a REQUEST: the warehouse must accept it before space is held, and
// the price shown is an estimate (units x days x the listed price). Only
// verified warehouses with space free are listed.
export function FindStorageScreen({ route, navigation }: Props) {
  const { containerId } = route.params;
  const [location, setLocation] = useState('');
  const [items, setItems] = useState<StorageCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<StorageCandidate | null>(null);
  const [units, setUnits] = useState('1');
  const [start, setStart] = useState(toDay(new Date()));
  const [end, setEnd] = useState(toDay(new Date(Date.now() + 7 * DAY_MS)));
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchStorageCandidates(containerId, location.trim() || undefined));
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [containerId, location]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const unitsNum = Number(units);
  const days = validDay(start) && validDay(end) ? Math.max(1, Math.ceil((new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / DAY_MS)) : 0;
  const estimate = selected && Number.isFinite(unitsNum) && unitsNum > 0 && days > 0 ? selected.pricePerUnitPerDay * unitsNum * days : null;

  const submit = async () => {
    if (!selected) return;
    if (!Number.isFinite(unitsNum) || unitsNum <= 0) return setFormError('Enter how many units you need.');
    if (unitsNum > selected.availableCapacity) return setFormError(`Only ${selected.availableCapacity} ${UNIT_LABEL[selected.capacityUnit]} available.`);
    if (!validDay(start) || !validDay(end)) return setFormError('Dates must look like 2026-11-05.');
    if (new Date(`${end}T00:00:00Z`) <= new Date(`${start}T00:00:00Z`)) return setFormError('The end date must be after the start date.');
    setBusy(true);
    setFormError(null);
    try {
      await bookStorage(containerId, {
        warehouseId: selected._id,
        unitsBooked: unitsNum,
        startDate: `${start}T00:00:00.000Z`,
        endDate: `${end}T00:00:00.000Z`,
        contactName: contactName.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setSelected(null);
      Alert.alert('Storage requested', `${selected.businessName} has been asked. Space is only held once they accept; you can follow it under More > Storage Bookings.`, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err) {
      setFormError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.stack}>
        <Text style={typography.h1}>Find storage</Text>
        <Text style={typography.caption}>Verified warehouses with space free. Sponsored listings are shown first and marked.</Text>
        <SearchBar value={location} onChangeText={setLocation} placeholder="Area, e.g. Cline Town" onSubmit={load} />
        <Button title="Search" variant="outline" onPress={load} disabled={loading} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator color={colors.orange} /> : null}
        {!loading && items.length === 0 && !error ? <Text style={typography.caption}>No verified warehouse with free space matches. Try another area, or clear the search.</Text> : null}

        {items.map((w) => (
          <Pressable key={w._id} onPress={() => { setSelected(w); setFormError(null); }}>
            <Card style={styles.stack}>
              <View style={styles.row}>
                <Text style={typography.bodyMedium}>{w.businessName}</Text>
                {w.sponsored ? <Text style={styles.sponsored}>Sponsored</Text> : null}
              </View>
              <Text style={typography.caption}>{w.location}</Text>
              <Text style={typography.caption}>{money(w.pricePerUnitPerDay)} per {UNIT_LABEL[w.capacityUnit]} per day · {w.availableCapacity} {UNIT_LABEL[w.capacityUnit]} free</Text>
              <Text style={typography.caption}>{w.ratingCount > 0 ? `${w.ratingAverage.toFixed(1)} ★ (${w.ratingCount})` : 'No ratings yet'}</Text>
              {w.amenities.length > 0 ? <Text style={typography.caption}>{w.amenities.map((a) => AMENITY_LABEL[a] ?? a).join(' · ')}</Text> : null}
            </Card>
          </Pressable>
        ))}
      </View>

      <Modal visible={selected !== null} animationType="slide" onRequestClose={() => setSelected(null)}>
        <SafeAreaView style={styles.modal}>
          <ScrollView contentContainerStyle={[styles.stack, { padding: spacing.lg }]} keyboardShouldPersistTaps="handled">
            <Text style={typography.h1}>{selected?.businessName}</Text>
            <Text style={typography.caption}>{selected?.location}</Text>
            <Field label={`How many ${selected ? UNIT_LABEL[selected.capacityUnit] : 'units'}? (${selected?.availableCapacity ?? 0} free)`} value={units} onChangeText={setUnits} keyboardType="decimal-pad" />
            <Field label="From (YYYY-MM-DD)" value={start} onChangeText={setStart} autoCapitalize="none" keyboardType="numbers-and-punctuation" />
            <Field label="Until (YYYY-MM-DD)" value={end} onChangeText={setEnd} autoCapitalize="none" keyboardType="numbers-and-punctuation" />
            <Field label="Contact name (optional)" value={contactName} onChangeText={setContactName} />
            <Field label="Contact phone (optional)" value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" />
            <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
            <Card>
              <Text style={typography.bodyMedium}>{estimate !== null ? `Estimated ${money(estimate)}` : 'Estimate needs units and valid dates'}</Text>
              <Text style={typography.caption}>{days > 0 ? `${days} day${days === 1 ? '' : 's'} × ${unitsNum || 0} × ${selected ? money(selected.pricePerUnitPerDay) : ''}. The warehouse confirms the final arrangement.` : ''}</Text>
            </Card>
            {formError ? <Text style={styles.error}>{formError}</Text> : null}
            <Button title="Request storage" onPress={submit} loading={busy} disabled={busy} />
            <Button title="Cancel" variant="outline" onPress={() => setSelected(null)} disabled={busy} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modal: { flex: 1, backgroundColor: colors.background },
  error: { color: colors.urgent },
  sponsored: { color: colors.info, backgroundColor: colors.infoBg, fontWeight: '700', fontSize: 12, paddingHorizontal: spacing.md, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden' },
});
