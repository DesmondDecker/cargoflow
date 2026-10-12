import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Field } from '../../components/Field';
import { Button } from '../../components/Button';
import { colors, spacing, typography } from '../../theme/theme';
import { fetchCandidateDrivers, assignDriver } from '../../api/transportApi';
import { apiErrorMessage } from '../../api/client';
import { DriverCandidate } from '../../types/api';
import { ContainersStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ContainersStackParamList, 'FindDriver'>;

export function FindDriverScreen({ route, navigation }: Props) {
  const { containerId } = route.params;
  const [drivers, setDrivers] = useState<DriverCandidate[]>([]);
  const [containerSize, setContainerSize] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<DriverCandidate | null>(null);
  const [pickupLocation, setPickupLocation] = useState('');
  const [destination, setDestination] = useState('');
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCandidateDrivers(containerId);
      setDrivers(result.drivers);
      setContainerSize(result.containerSize);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [containerId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onAssign = async () => {
    if (!selected || !pickupLocation.trim() || !destination.trim()) {
      Alert.alert('Missing info', 'Enter both a pickup location and destination.');
      return;
    }
    const vehicle = selected.matchingVehicles[0];
    if (!vehicle) {
      Alert.alert('No compatible vehicle', 'This driver has no vehicle registered for this container size.');
      return;
    }
    setAssigning(true);
    try {
      await assignDriver(containerId, {
        driverId: selected._id,
        vehicleId: vehicle._id,
        pickupLocation: pickupLocation.trim(),
        destination: destination.trim(),
      });
      Alert.alert('Driver Assigned', `${selected.name} has been notified.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Could not assign driver', apiErrorMessage(err));
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.orange} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.header}>
        <Text style={styles.headerSubtitle}>
          {containerSize ? `Showing drivers with a ${containerSize} compatible vehicle` : 'Showing available drivers'}
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={drivers}
        keyExtractor={(d) => d._id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No verified drivers with a matching vehicle right now.</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => setSelected(item)}>
            <Card style={[styles.card, selected?._id === item._id && styles.cardSelected]}>
              <View style={styles.cardTop}>
                <Text style={styles.name}>{item.name}</Text>
                {item.ratingCount > 0 ? <Text style={styles.rating}>★ {item.ratingAverage.toFixed(1)}</Text> : null}
              </View>
              {item.location ? <Text style={styles.meta}>{item.location}</Text> : null}
              <Text style={styles.meta}>{item.matchingVehicles.map((v) => `${v.vehicleType} (${v.plateNumber})`).join(', ')}</Text>
              <Text style={styles.meta}>{item.completedJobs} completed jobs</Text>
            </Card>
          </Pressable>
        )}
      />

      {selected ? (
        <View style={styles.assignPanel}>
          <Text style={styles.assignTitle}>Assign {selected.name}</Text>
          <Field label="Pickup Location" placeholder="e.g. Queen Elizabeth II Quay" value={pickupLocation} onChangeText={setPickupLocation} />
          <Field label="Destination" placeholder="e.g. ABC Trading Warehouse, Freetown" value={destination} onChangeText={setDestination} />
          <Button title="Assign Driver" onPress={onAssign} loading={assigning} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  headerSubtitle: { ...typography.body, color: colors.textSecondary },
  error: { color: colors.urgent, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  list: { padding: spacing.lg, paddingTop: 0, gap: spacing.md, paddingBottom: spacing.xxl },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xxl },
  card: { marginBottom: spacing.md },
  cardSelected: { borderWidth: 2, borderColor: colors.orange },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  name: { ...typography.bodyMedium, fontSize: 16 },
  rating: { ...typography.bodyMedium, color: colors.attention },
  meta: { ...typography.caption, marginTop: 2 },
  assignPanel: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  assignTitle: { ...typography.h3, marginBottom: spacing.md },
});
