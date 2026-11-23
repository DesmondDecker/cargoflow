import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { StatusChip } from '../components/StatusChip';
import { fetchJob } from '../api/driverApi';
import { performAction } from '../offline/actions';
import { findCachedJob } from '../offline/jobCache';
import { isNetworkError, NewAction } from '../offline/queue';
import { SyncBanner } from '../components/SyncBanner';
import { apiErrorMessage } from '../api/client';
import { MainStackParamList } from '../navigation/types';
import { containerNumberOf, Job } from '../types';
import { formatDate, formatDateTime } from '../utils/format';
import { colors, spacing, typography } from '../theme/theme';

type Props = NativeStackScreenProps<MainStackParamList, 'JobDetail'>;

const mapsUrl = (place: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;

function Place({ label, place }: { label: string; place: string }) {
  return (
    <View style={styles.place}>
      <View style={{ flex: 1 }}>
        <Text style={typography.label}>{label}</Text>
        <Text style={typography.body}>{place}</Text>
      </View>
      <Pressable onPress={() => Linking.openURL(mapsUrl(place))} hitSlop={8}>
        <Text style={styles.link}>Directions</Text>
      </Pressable>
    </View>
  );
}

export function JobDetailScreen({ route, navigation }: Props) {
  const { jobId } = route.params;
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setJob(await fetchJob(jobId));
      setError(null);
    } catch (err) {
      const saved = isNetworkError(err) ? await findCachedJob(jobId) : undefined;
      if (saved) {
        setJob(saved);
        setError(null);
      } else {
        setError(apiErrorMessage(err));
      }
    } finally {
      setRefreshing(false);
    }
  }, [jobId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Online the change happens now. With no signal it is saved on the phone and
  // sent when the connection returns; the screen shows the new state either way.
  const run = async (action: NewAction) => {
    setBusy(true);
    setError(null);
    try {
      const { queued } = await performAction(action);
      if (queued) Alert.alert('Saved on this phone', 'You are offline. This will be sent automatically when you are back online.');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const decline = () =>
    Alert.alert('Decline this job?', 'The agency will be told and can assign another driver.', [
      { text: 'Keep job', style: 'cancel' },
      { text: 'Decline', style: 'destructive', onPress: () => run({ kind: 'respond', jobId, decision: 'decline' }) },
    ]);

  if (!job) {
    return (
      <Screen>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.orange} style={{ marginTop: spacing.xl }} />}
      </Screen>
    );
  }

  const container = typeof job.containerId === 'string' ? null : job.containerId;
  const pod = job.proofOfDelivery;

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      <View style={styles.stack}>
        <SyncBanner />
        <View style={styles.top}>
          <Text style={typography.h1}>{containerNumberOf(job)}</Text>
          <StatusChip status={job.status} />
        </View>
        {container?.size || container?.shippingLine ? (
          <Text style={typography.caption}>{[container.size, container.shippingLine].filter(Boolean).join(' · ')}</Text>
        ) : null}

        <Card style={styles.stack}>
          <Place label="PICK UP" place={job.pickupLocation} />
          <Place label="DELIVER TO" place={job.destination} />
          {job.requiredDate ? <Text style={typography.caption}>Needed by {formatDate(job.requiredDate)}</Text> : null}
        </Card>

        {job.contactName || job.contactPhone ? (
          <Card style={styles.place}>
            <View style={{ flex: 1 }}>
              <Text style={typography.label}>CONTACT</Text>
              <Text style={typography.body}>{job.contactName || 'On-site contact'}</Text>
              {job.contactPhone ? <Text style={typography.caption}>{job.contactPhone}</Text> : null}
            </View>
            {job.contactPhone ? (
              <Pressable onPress={() => Linking.openURL(`tel:${job.contactPhone}`)} hitSlop={8}>
                <Text style={styles.link}>Call</Text>
              </Pressable>
            ) : null}
          </Card>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {job.status === 'pending' ? (
          <View style={styles.stack}>
            <Button title="Accept job" onPress={() => run({ kind: 'respond', jobId, decision: 'accept' })} loading={busy} />
            <Button title="Decline" variant="outline" onPress={decline} disabled={busy} />
          </View>
        ) : null}
        {job.status === 'accepted' ? (
          <Button title="Mark picked up" onPress={() => run({ kind: 'status', jobId, status: 'picked_up' })} loading={busy} />
        ) : null}
        {job.status === 'picked_up' ? (
          <Button title="Start trip (in transit)" onPress={() => run({ kind: 'status', jobId, status: 'in_transit' })} loading={busy} variant="secondary" />
        ) : null}
        {job.status === 'picked_up' || job.status === 'in_transit' ? (
          <Button title="Complete delivery" onPress={() => navigation.navigate('CompleteDelivery', { jobId })} disabled={busy} />
        ) : null}

        {job.status === 'delivered' && pod ? (
          <Card style={styles.stack}>
            <Text style={typography.h3}>Delivered</Text>
            <Text style={typography.caption}>{formatDateTime(pod.completedAt)}</Text>
            {pod.notes ? <Text style={typography.body}>{pod.notes}</Text> : null}
            {pod.photoUrl ? <Text style={styles.link} onPress={() => Linking.openURL(pod.photoUrl!)}>View delivery photo</Text> : null}
            {pod.signatureUrl ? <Text style={styles.link} onPress={() => Linking.openURL(pod.signatureUrl!)}>View signature</Text> : null}
            {pod.gps ? <Text style={styles.link} onPress={() => Linking.openURL(mapsUrl(`${pod.gps!.lat},${pod.gps!.lng}`))}>View delivery location</Text> : null}
          </Card>
        ) : null}
        {job.rating ? (
          <Card>
            <Text style={typography.bodyMedium}>Agency rating: {'★'.repeat(job.rating.stars)}{'☆'.repeat(Math.max(0, 5 - job.rating.stars))}</Text>
            {job.rating.comment ? <Text style={typography.caption}>{job.rating.comment}</Text> : null}
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  place: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  link: { color: colors.info, fontWeight: '600' },
  error: { color: colors.urgent },
});
