import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { ChipRow } from '../../components/ChipRow';
import { usePrefsStore, ContainerFilter } from '../../store/prefsStore';
import { fetchTrackingSources, TrackingSourceSummary } from '../../api/containerApi';
import { clearSyncFailures, getSyncFailures, SyncFailure } from '../../offline/outbox';
import { getIsOnline, onSyncStatusChange, replayQueue, SyncStatus } from '../../offline/syncEngine';
import { colors, spacing, typography } from '../../theme/theme';

const FILTERS: { key: ContainerFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'urgent', label: 'Urgent' },
  { key: 'attention', label: 'Attention' },
  { key: 'normal', label: 'Normal' },
];

export function AppPreferencesScreen() {
  const defaultContainerFilter = usePrefsStore((s) => s.defaultContainerFilter);
  const showCarrierBreakdown = usePrefsStore((s) => s.showCarrierBreakdown);
  const setPrefs = usePrefsStore((s) => s.set);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [failures, setFailures] = useState<SyncFailure[]>([]);
  const [sources, setSources] = useState<TrackingSourceSummary[] | null>(null);
  const [sourcesError, setSourcesError] = useState(false);

  useEffect(() => {
    fetchTrackingSources().then(setSources).catch(() => setSourcesError(true));
  }, []);

  useEffect(() => {
    let active = true;
    const loadFailures = () => {
      getSyncFailures()
        .then((items) => { if (active) setFailures(items); })
        .catch((error: unknown) => console.error('Could not load offline sync failures', error));
    };
    loadFailures();
    const unsubscribe = onSyncStatusChange((status, count) => {
      setSyncStatus(status);
      setPending(count);
      loadFailures();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const syncNow = async () => {
    if (!getIsOnline()) {
      Alert.alert('You are offline', 'Changes will sync automatically once you are back online.');
      return;
    }
    setSyncing(true);
    try {
      await replayQueue();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Screen>
      <View style={styles.stack}>
        <Text style={typography.h1}>App preferences</Text>

        <Card style={styles.stack}>
          <Text style={typography.bodyMedium}>Containers list opens on</Text>
          <Text style={typography.caption}>Which filter the Containers tab starts with.</Text>
          <ChipRow options={FILTERS} value={defaultContainerFilter} onChange={(key) => setPrefs({ defaultContainerFilter: key })} />
        </Card>

        <Card style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={typography.bodyMedium}>Shipping line breakdown</Text>
            <Text style={typography.caption}>Show containers-by-carrier on the Home screen.</Text>
          </View>
          <Switch value={showCarrierBreakdown} onValueChange={(v) => setPrefs({ showCarrierBreakdown: v })} trackColor={{ true: colors.orange }} />
        </Card>

        <Card style={styles.stack}>
          <Text style={typography.bodyMedium}>Offline sync</Text>
          <Text style={typography.caption}>
            {syncStatus === 'offline' ? 'Offline.' : syncStatus === 'syncing' ? 'Syncing…' : 'Online.'} {pending > 0 ? `${pending} change${pending === 1 ? '' : 's'} waiting to sync.` : 'Nothing waiting to sync.'}
          </Text>
          <Button title="Sync now" variant="outline" onPress={syncNow} loading={syncing} disabled={pending === 0} />
          {failures.length > 0 ? (
            <View style={styles.stack}>
              <Text style={[typography.bodyMedium, { color: colors.urgent }]}>Could not be saved to the server</Text>
              {failures.map((f) => (
                <Text key={`${f.at}-${f.summary}`} style={typography.caption}>{f.summary}: {f.reason}</Text>
              ))}
              <Button title="Dismiss" variant="outline" onPress={() => { clearSyncFailures().then(() => setFailures([])).catch((error: unknown) => console.error('Could not clear offline sync failures', error)); }} />
            </View>
          ) : null}
        </Card>

        <Card style={styles.stack}>
          <Text style={typography.bodyMedium}>Live tracking sources</Text>
          <Text style={typography.caption}>
            What the server is set up to look up for each shipping line, in order: the carrier's own API, then MarineTraffic, then the public-page scraper. Every line can also be checked on its public page and captured from there. This shows what is switched on, not whether a source is working right now.
          </Text>
          {sourcesError ? <Text style={typography.caption}>Could not load this.</Text> : null}
          {sources?.map((c) => (
            <View key={c.carrier} style={styles.sourceRow}>
              <Text style={typography.bodyMedium}>{c.carrier}</Text>
              <Text style={typography.caption}>{c.liveSources.length > 0 ? c.liveSources.join(' → ') : 'Public page and capture only'}</Text>
            </View>
          ))}
        </Card>

        <Text style={styles.version}>CargoFlow {Constants.expoConfig?.version ?? ''}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  sourceRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  version: { ...typography.caption, textAlign: 'center', marginTop: spacing.md },
});
