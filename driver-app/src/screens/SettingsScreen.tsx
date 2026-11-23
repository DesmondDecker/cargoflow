import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { fetchNotificationPrefs, updateNotificationPrefs } from '../api/driverApi';
import { apiErrorMessage, baseURL } from '../api/client';
import { registerForPushNotifications, PushResult } from '../notifications/pushRegistration';
import { clearFailed, FailedAction, flushQueue, getFailed, onQueueChange } from '../offline/queue';
import { useAuth } from '../auth/AuthContext';
import { formatDateTime } from '../utils/format';
import { colors, spacing, typography } from '../theme/theme';

const PUSH_MESSAGE: Record<PushResult, string> = {
  registered: 'This phone is set up for job notifications.',
  'no-device': 'Notifications only work on a real phone, not a simulator.',
  'no-project': 'Notifications are not configured in this build yet (the app needs an EAS project id).',
  denied: 'Notifications are blocked. Allow them for CargoFlow Driver in your phone settings.',
  failed: 'Could not set up notifications. Try again in a moment.',
};

const describe = (f: FailedAction): string =>
  f.action.kind === 'respond' ? `${f.action.decision === 'accept' ? 'Accepting' : 'Declining'} a job` : f.action.kind === 'status' ? `Marking a job ${f.action.status === 'picked_up' ? 'picked up' : 'in transit'}` : 'Completing a delivery';

export function SettingsScreen() {
  const { driver, logout } = useAuth();
  const [jobAlerts, setJobAlerts] = useState(true);
  const [pushRegistered, setPushRegistered] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState<FailedAction[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetchNotificationPrefs();
      setJobAlerts(r.prefs.jobAlerts);
      setPushRegistered(r.pushRegistered);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoaded(true);
    }
    setFailed(await getFailed());
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => onQueueChange((p) => { setPending(p); getFailed().then(setFailed); }), []);

  const toggle = async (value: boolean) => {
    setSaving(true);
    setJobAlerts(value);
    try {
      await updateNotificationPrefs({ jobAlerts: value });
    } catch (err) {
      setJobAlerts(!value);
      Alert.alert('Could not save', apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const enable = async () => {
    setEnabling(true);
    try {
      const result = await registerForPushNotifications();
      setPushMessage(PUSH_MESSAGE[result]);
      await load();
    } finally {
      setEnabling(false);
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      const { synced, failed: rejected } = await flushQueue();
      Alert.alert('Sync finished', `${synced} sent${rejected ? `, ${rejected} rejected` : ''}.${pending - synced - rejected > 0 ? ' The rest will send when you have a connection.' : ''}`);
    } finally {
      setSyncing(false);
    }
  };

  const signOut = () =>
    Alert.alert('Sign out?', pending > 0 ? `${pending} change${pending === 1 ? ' has' : 's have'} not been sent yet and will be lost if you sign out.` : 'You will need your phone number and password to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => logout() },
    ]);

  return (
    <Screen>
      <View style={styles.stack}>
        <Text style={typography.h1}>Settings</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Card style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={typography.bodyMedium}>New job alerts</Text>
            <Text style={typography.caption}>A notification when an agency assigns you a job.</Text>
          </View>
          <Switch value={jobAlerts} onValueChange={toggle} disabled={!loaded || saving} trackColor={{ true: colors.orange }} />
        </Card>

        <Card style={styles.stack}>
          <Text style={typography.bodyMedium}>This phone</Text>
          <Text style={typography.caption}>{pushMessage ?? (pushRegistered ? 'Set up for job notifications. Only the phone you signed in on last receives them.' : 'Not set up for notifications yet.')}</Text>
          <Button title={pushRegistered ? 'Set up again' : 'Turn on notifications'} variant="outline" onPress={enable} loading={enabling} />
        </Card>

        <Card style={styles.stack}>
          <Text style={typography.bodyMedium}>Offline changes</Text>
          <Text style={typography.caption}>{pending > 0 ? `${pending} change${pending === 1 ? '' : 's'} saved on this phone, waiting to send.` : 'Everything is sent.'}</Text>
          <Button title="Send now" variant="outline" onPress={syncNow} loading={syncing} disabled={pending === 0} />
          {failed.length > 0 ? (
            <View style={styles.stack}>
              <Text style={[typography.bodyMedium, { color: colors.urgent }]}>Rejected by the server</Text>
              {failed.map((f) => (
                <Text key={f.action.id} style={typography.caption}>{describe(f)} ({formatDateTime(f.failedAt)}): {f.reason}</Text>
              ))}
              <Button title="Dismiss" variant="outline" onPress={() => clearFailed().then(() => setFailed([]))} />
            </View>
          ) : null}
        </Card>

        <Card style={styles.stack}>
          <Text style={typography.bodyMedium}>Account</Text>
          <Text style={typography.caption}>{driver?.name} · {driver?.phone}</Text>
          <Text style={typography.caption}>CargoFlow Driver {Constants.expoConfig?.version ?? ''}</Text>
          <Text style={typography.caption}>Server: {baseURL}</Text>
        </Card>

        <Button title="Sign out" variant="outline" onPress={signOut} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  error: { color: colors.urgent },
});
