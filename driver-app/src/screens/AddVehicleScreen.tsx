import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { addVehicle } from '../api/driverApi';
import { apiErrorMessage } from '../api/client';
import { MainStackParamList } from '../navigation/types';
import { CONTAINER_SIZES, ContainerSize, VEHICLE_TYPES, VehicleType } from '../types';
import { colors, radius, spacing, typography } from '../theme/theme';

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipOn]}>
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

export function AddVehicleScreen({ navigation }: NativeStackScreenProps<MainStackParamList, 'AddVehicle'>) {
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(null);
  const [plate, setPlate] = useState('');
  const [sizes, setSizes] = useState<ContainerSize[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (s: ContainerSize) => setSizes((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  const submit = async () => {
    if (!vehicleType) return;
    setBusy(true);
    setError(null);
    try {
      await addVehicle({ vehicleType, plateNumber: plate.trim(), containerCompatibility: sizes });
      navigation.goBack();
    } catch (err) {
      setError(apiErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.stack}>
        <Text style={typography.h1}>Add vehicle</Text>
        <Text style={typography.label}>VEHICLE TYPE</Text>
        <View style={styles.row}>
          {VEHICLE_TYPES.map((t) => <Chip key={t} label={t} selected={vehicleType === t} onPress={() => setVehicleType(t)} />)}
        </View>
        <Field label="Plate number" value={plate} onChangeText={setPlate} autoCapitalize="characters" />
        <Text style={typography.label}>CONTAINER SIZES IT CAN CARRY</Text>
        <View style={styles.row}>
          {CONTAINER_SIZES.map((s) => <Chip key={s} label={s} selected={sizes.includes(s)} onPress={() => toggle(s)} />)}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Save vehicle" onPress={submit} loading={busy} disabled={!vehicleType || !plate.trim() || sizes.length === 0} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  chipOn: { borderColor: colors.orange, backgroundColor: colors.orange },
  chipText: { fontWeight: '600', color: colors.textPrimary },
  chipTextOn: { color: colors.white },
  error: { color: colors.urgent },
});
