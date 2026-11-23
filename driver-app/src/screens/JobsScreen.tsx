import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { JobCard } from '../components/JobCard';
import { Card } from '../components/Card';
import { SyncBanner } from '../components/SyncBanner';
import { fetchJobs, setAvailability } from '../api/driverApi';
import { apiErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { loadOpenJobs, openJobsWithPending, saveOpenJobs } from '../offline/jobCache';
import { isNetworkError } from '../offline/queue';
import { MainStackParamList } from '../navigation/types';
import { Job } from '../types';
import { colors, radius, spacing, typography } from '../theme/theme';

const POLL_MS = 30000;

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function Tile({ icon, tint, bg, label, value }: { icon: keyof typeof Ionicons.glyphMap; tint: string; bg: string; label: string; value: number }) {
  return (
    <Card style={styles.tile}>
      <View style={[styles.tileIcon, { backgroundColor: bg }]}><Ionicons name={icon} size={18} color={tint} /></View>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={typography.caption}>{label}</Text>
    </Card>
  );
}

export function JobsScreen() {
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { driver, setDriver } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showingSaved, setShowingSaved] = useState(false);
  const [togglingAvailability, setTogglingAvailability] = useState(false);
  const focused = useRef(false);

  const load = useCallback(async (silent = false) => {
    try {
      const fresh = await fetchJobs();
      await saveOpenJobs(fresh);
      setJobs(await openJobsWithPending(fresh));
      setShowingSaved(false);
      setError(null);
    } catch (err) {
      if (isNetworkError(err)) {
        // No signal: show what was last saved, with any changes made since laid over it.
        setJobs(await openJobsWithPending(await loadOpenJobs()));
        setShowingSaved(true);
        setError(null);
      } else if (!silent) {
        setError(apiErrorMessage(err));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reload when the tab is focused and poll while it is, so a job an agency
  // assigns shows up without pulling to refresh.
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      load();
      return () => {
        focused.current = false;
      };
    }, [load])
  );
  useEffect(() => {
    const id = setInterval(() => {
      if (focused.current) load(true);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const toggleAvailability = async (value: boolean) => {
    setTogglingAvailability(true);
    try {
      setDriver(await setAvailability(value));
    } catch (err) {
      setError(isNetworkError(err) ? 'You are offline. Availability can only be changed with a connection.' : apiErrorMessage(err));
    } finally {
      setTogglingAvailability(false);
    }
  };

  const counts = useMemo(
    () => ({
      open: jobs.length,
      waiting: jobs.filter((j) => j.status === 'pending').length,
      moving: jobs.filter((j) => j.status === 'picked_up' || j.status === 'in_transit').length,
    }),
    [jobs]
  );
  const verified = driver?.verificationStatus === 'verified';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <FlatList
        contentContainerStyle={styles.list}
        data={jobs}
        keyExtractor={(j) => j._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View>
              <Text style={typography.h1}>{greeting()}, {driver?.name?.split(' ')[0] || 'driver'}</Text>
              <Text style={typography.caption}>Here are your jobs.</Text>
            </View>
            <SyncBanner />
            {showingSaved ? <Text style={styles.saved}>Showing the jobs saved on this phone.</Text> : null}
            <View style={styles.tiles}>
              <Tile icon="briefcase-outline" tint={colors.info} bg={colors.infoBg} label="Open jobs" value={counts.open} />
              <Tile icon="alert-circle-outline" tint={colors.attention} bg={colors.attentionBg} label="Need reply" value={counts.waiting} />
              <Tile icon="car-outline" tint={colors.normal} bg={colors.normalBg} label="On the road" value={counts.moving} />
            </View>
            <Card style={styles.availability}>
              <View style={{ flex: 1 }}>
                <Text style={typography.bodyMedium}>{driver?.availability ? 'Available for jobs' : 'Not available'}</Text>
                <Text style={typography.caption}>
                  {verified ? 'Agencies can find and assign you while this is on.' : 'Agencies only see verified drivers. Open Profile to request verification.'}
                </Text>
              </View>
              <Switch value={!!driver?.availability} onValueChange={toggleAvailability} disabled={togglingAvailability} trackColor={{ true: colors.orange }} />
            </Card>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        renderItem={({ item }) => <JobCard job={item} onPress={() => nav.navigate('JobDetail', { jobId: item._id })} />}
        ListEmptyComponent={
          loading ? <ActivityIndicator color={colors.orange} style={{ marginTop: spacing.xl }} /> : <Text style={styles.empty}>No open jobs right now. New jobs from agencies appear here.</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg },
  header: { gap: spacing.md, marginBottom: spacing.md },
  saved: { ...typography.caption, textAlign: 'center' },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: { flex: 1, gap: 2, padding: spacing.md },
  tileIcon: { width: 30, height: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  tileValue: { fontSize: 24, fontWeight: '800', color: colors.navy },
  availability: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  error: { color: colors.urgent },
  empty: { ...typography.caption, textAlign: 'center', marginTop: spacing.xl },
});
