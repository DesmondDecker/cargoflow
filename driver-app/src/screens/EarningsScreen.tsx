import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { fetchEarnings, EarningsData } from '../api/driverApi';
import { apiErrorMessage } from '../api/client';
import { isNetworkError } from '../offline/queue';
import { formatDate } from '../utils/format';
import { colors, spacing, typography } from '../theme/theme';

const money = (n: number, currency: string) => `${currency} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export function EarningsScreen() {
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await fetchEarnings());
      setError(null);
    } catch (err) {
      setError(isNetworkError(err) ? 'You are offline. Earnings need a connection.' : apiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      <View style={styles.stack}>
        <Text style={typography.h1}>Earnings</Text>
        <Text style={typography.caption}>
          Fees agencies agreed for jobs you delivered. These are agreed amounts, not a record that you have been paid. Settle payment with the agency.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator color={colors.orange} style={{ marginTop: spacing.xl }} /> : null}

        {data && data.totals.length === 0 && !loading ? (
          <Card><Text style={typography.caption}>No delivered jobs with an agreed fee yet. When an agency sets a fee on a job and you deliver it, it shows up here.</Text></Card>
        ) : null}

        {data?.totals.map((t) => (
          <Card key={t.currency} style={styles.stack}>
            <Text style={typography.label}>{t.currency} · {t.jobs} job{t.jobs === 1 ? '' : 's'}</Text>
            <View style={styles.row}>
              <View style={styles.cell}><Text style={styles.value}>{money(t.week, t.currency)}</Text><Text style={typography.caption}>Last 7 days</Text></View>
              <View style={styles.cell}><Text style={styles.value}>{money(t.month, t.currency)}</Text><Text style={typography.caption}>This month</Text></View>
            </View>
            <Text style={typography.caption}>All time: {money(t.allTime, t.currency)}</Text>
          </Card>
        ))}

        {data && data.deliveredWithoutFee > 0 ? (
          <Text style={typography.caption}>{data.deliveredWithoutFee} delivered job{data.deliveredWithoutFee === 1 ? ' has' : 's have'} no agreed fee, so {data.deliveredWithoutFee === 1 ? 'it is' : 'they are'} not counted.</Text>
        ) : null}

        {data && data.recent.length > 0 ? <Text style={typography.h3}>Recent jobs</Text> : null}
        {data?.recent.map((r) => (
          <Card key={r.jobId} style={styles.recent}>
            <View style={{ flex: 1 }}>
              <Text style={typography.bodyMedium}>{r.containerNumber}</Text>
              <Text style={typography.caption}>{formatDate(r.completedAt)}</Text>
            </View>
            <Text style={typography.bodyMedium}>{money(r.fee, r.currency)}</Text>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  cell: { flex: 1, gap: 2 },
  value: { fontSize: 18, fontWeight: '800', color: colors.navy },
  recent: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  error: { color: colors.urgent },
});
