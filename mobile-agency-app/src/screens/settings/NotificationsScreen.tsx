import React, { useCallback, useState } from 'react';
import { Alert, Platform, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { fetchNotificationPrefs, updateNotificationPrefs } from '../../api/authApi';
import { apiErrorMessage } from '../../api/client';
import { registerForPushNotifications } from '../../notifications/pushRegistration';
import { colors, spacing, typography } from '../../theme/theme';

export function NotificationsScreen() {
  const [dailySummary, setDailySummary] = useState(true);
  const [driverUpdates, setDriverUpdates] = useState(true);
  const [pushRegistered, setPushRegistered] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await fetchNotificationPrefs();
      setDailySummary(result.prefs.dailySummary);
      setDriverUpdates(result.prefs.driverUpdates);
      setPushRegistered(result.pushRegistered);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = async (key: 'dailySummary' | 'driverUpdates', value: boolean) => {
    const setter = key === 'dailySummary' ? setDailySummary : setDriverUpdates;
    setSaving(true);
    setter(value);
    try {
      await updateNotificationPrefs({ [key]: value });
    } catch (err) {
      setter(!value);
      Alert.alert('Could not save', apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const enable = async () => {
    setEnabling(true);
    try {
      await registerForPushNotifications();
      await load();
      Alert.alert('Done', 'If notifications still do not arrive, allow them for CargoFlow in your phone settings.');
    } finally {
      setEnabling(false);
    }
  };

  return (
    <Screen>
      <View style={styles.stack}>
        <Text style={typography.h1}>Notifications</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Card style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={typography.bodyMedium}>Morning summary</Text>
            <Text style={typography.caption}>One push at 08:30 with tracking updates, urgent containers, expired deadlines and missing documents. Sent to owners and admins only, and only when there is something to report.</Text>
          </View>
          <Switch value={dailySummary} onValueChange={(v) => toggle('dailySummary', v)} disabled={!loaded || saving} trackColor={{ true: colors.orange }} />
        </Card>
        <Card style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={typography.bodyMedium}>Driver updates</Text>
            <Text style={typography.caption}>A notification when a driver you assigned accepts, declines or delivers a job.</Text>
          </View>
          <Switch value={driverUpdates} onValueChange={(v) => toggle('driverUpdates', v)} disabled={!loaded || saving} trackColor={{ true: colors.orange }} />
        </Card>
        <Card style={styles.stack}>
          <Text style={typography.bodyMedium}>{Platform.OS === 'web' ? 'Browser notifications' : 'This device'}</Text>
          <Text style={typography.caption}>
            {Platform.OS === 'web'
              ? 'Push notifications are not configured for the web app. Use the CargoFlow mobile app for push alerts.'
              : pushRegistered
                ? 'Registered to receive notifications. Only the most recently signed-in device receives them.'
                : 'Not registered yet, so no notifications will arrive here.'}
          </Text>
          {Platform.OS === 'web' ? null : (
            <Button title={pushRegistered ? 'Register this device again' : 'Enable notifications on this device'} variant="outline" onPress={enable} loading={enabling} />
          )}
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  error: { color: colors.urgent },
});
