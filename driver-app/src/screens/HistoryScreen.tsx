import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { JobCard } from '../components/JobCard';
import { fetchJobHistory } from '../api/driverApi';
import { loadHistoryJobs, saveHistoryJobs } from '../offline/jobCache';
import { isNetworkError } from '../offline/queue';
import { apiErrorMessage } from '../api/client';
import { MainStackParamList } from '../navigation/types';
import { Job } from '../types';
import { colors, spacing, typography } from '../theme/theme';

export function HistoryScreen() {
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const fresh = await fetchJobHistory();
      await saveHistoryJobs(fresh);
      setJobs(fresh);
      setError(null);
    } catch (err) {
      if (isNetworkError(err)) {
        setJobs(await loadHistoryJobs());
        setError('Offline: showing the history saved on this phone.');
      } else {
        setError(apiErrorMessage(err));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <FlatList
        contentContainerStyle={styles.list}
        data={jobs}
        keyExtractor={(j) => j._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListHeaderComponent={
          <>
            <Text style={typography.h1}>History</Text>
            <Text style={styles.sub}>Your last 50 finished jobs.</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </>
        }
        renderItem={({ item }) => <JobCard job={item} onPress={() => nav.navigate('JobDetail', { jobId: item._id })} />}
        ListEmptyComponent={loading ? <ActivityIndicator color={colors.orange} style={{ marginTop: spacing.xl }} /> : <Text style={styles.empty}>Delivered and declined jobs will show here.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg },
  sub: { ...typography.caption, marginBottom: spacing.md },
  error: { color: colors.urgent, marginBottom: spacing.sm },
  empty: { ...typography.caption, textAlign: 'center', marginTop: spacing.xl },
});
