import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { fetchProfile } from '../api/driverApi';
import { apiErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { MainStackParamList } from '../navigation/types';
import { Vehicle, VerificationStatus } from '../types';
import { colors, spacing, typography } from '../theme/theme';

const VERIFICATION_TEXT: Record<VerificationStatus, { title: string; body: string }> = {
  unverified: { title: 'Not verified', body: 'Add a vehicle, then send your driving licence for review. Agencies can only assign jobs to verified drivers.' },
  pending: { title: 'Under review', body: 'A CargoFlow admin is reviewing your licence. You will be able to receive jobs once approved.' },
  verified: { title: 'Verified', body: 'Agencies can find and assign you jobs when you are set as available.' },
  rejected: { title: 'Not approved', body: 'Your licence was not approved. Send a clearer photo of a valid licence to try again.' },
};

export function ProfileScreen() {
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { driver, setDriver, logout } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchProfile()
        .then((p) => {
          setDriver(p.driver);
          setVehicles(p.vehicles);
          setError(null);
        })
        .catch((err) => setError(apiErrorMessage(err)));
    }, [setDriver])
  );

  if (!driver) return null;
  const v = VERIFICATION_TEXT[driver.verificationStatus];
  const canRequest = driver.verificationStatus === 'unverified' || driver.verificationStatus === 'rejected';

  return (
    <Screen>
      <View style={styles.stack}>
        <Text style={typography.h1}>{driver.name}</Text>
        <Text style={typography.caption}>
          {driver.phone}
          {driver.ratingCount > 0 ? `  ·  ${driver.ratingAverage.toFixed(1)} ★ (${driver.ratingCount})` : '  ·  No ratings yet'}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Card style={styles.stack}>
          <Text style={typography.h3}>{v.title}</Text>
          <Text style={typography.caption}>{v.body}</Text>
          {canRequest ? <Button title="Request verification" onPress={() => nav.navigate('RequestVerification')} /> : null}
        </Card>

        <Text style={typography.h3}>Vehicles</Text>
        {vehicles.length === 0 ? <Text style={typography.caption}>No vehicles yet. Add the truck you drive.</Text> : null}
        {vehicles.map((veh) => (
          <Card key={veh._id}>
            <Text style={typography.bodyMedium}>{veh.vehicleType} · {veh.plateNumber}</Text>
            <Text style={typography.caption}>Carries {veh.containerCompatibility.join(', ')}</Text>
          </Card>
        ))}
        <Button title="Add vehicle" variant="outline" onPress={() => nav.navigate('AddVehicle')} />

        <Button title="Settings" variant="outline" onPress={() => nav.navigate('Settings')} />

        <Button
          title="Sign out"
          variant="outline"
          onPress={() => Alert.alert('Sign out?', 'You will need your phone number and password to sign in again.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: () => logout() },
          ])}
          style={{ marginTop: spacing.lg }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  error: { color: colors.urgent },
});
