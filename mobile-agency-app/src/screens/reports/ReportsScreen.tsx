import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { ChipRow } from '../../components/ChipRow';
import { fetchReportSummary, ReportSummary } from '../../api/reportsApi';
import { apiErrorMessage } from '../../api/client';
import { downloadAndShare } from '../../utils/download';
import { colors, spacing, typography } from '../../theme/theme';

type Period = '7' | '30' | '90' | '365' | 'all';
const PERIODS: { key: Period; label: string }[] = [
  { key: '7', label: '7 days' },
  { key: '30', label: '30 days' },
  { key: '90', label: '90 days' },
  { key: '365', label: '1 year' },
  { key: 'all', label: 'All time' },
];

const money = (n: number, currency: string) => `${currency} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, tone ? { color: tone } : null]}>{value}</Text>
      <Text style={typography.caption}>{label}</Text>
    </View>
  );
}

export function ReportsScreen() {
  const [period, setPeriod] = useState<Period>('30');
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setReport(await fetchReportSummary(period));
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [period]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const exportCsv = async (kind: 'containers' | 'expenses') => {
    setExporting(kind);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await downloadAndShare(kind === 'containers' ? '/reports/containers.csv' : `/reports/expenses.csv?days=${period}`, `${kind}-${today}.csv`, 'text/csv', kind === 'containers' ? 'Containers' : 'Expenses');
    } catch (err) {
      Alert.alert('Could not export', apiErrorMessage(err));
    } finally {
      setExporting(null);
    }
  };

  const c = report?.containers;
  return (
    <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.orange} />}>
      <View style={styles.stack}>
        <Text style={typography.h1}>Reports</Text>
        <Text style={typography.caption}>Your agency's containers, documents and expenses. The period applies to new containers and expenses; open-container counts are always current.</Text>
        <ChipRow options={PERIODS} value={period} onChange={setPeriod} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading && !report ? <ActivityIndicator color={colors.orange} /> : null}

        {c ? (
          <>
            <Card style={styles.stack}>
              <Text style={typography.h3}>Containers</Text>
              <View style={styles.statRow}>
                <Stat label="Open now" value={c.open} />
                <Stat label="Added in period" value={c.addedInPeriod} />
                <Stat label="All time" value={c.total} />
              </View>
              <View style={styles.statRow}>
                <Stat label="Urgent" value={c.attention.urgent} tone={colors.urgent} />
                <Stat label="Need attention" value={c.attention.attention} tone={colors.attention} />
                <Stat label="On track" value={c.attention.normal} tone={colors.normal} />
              </View>
              <Text style={typography.bodyMedium}>By status</Text>
              {c.byStatus.map((s) => <Text key={s.status} style={typography.caption}>{s.status}: {s.count}</Text>)}
              <Text style={typography.bodyMedium}>By shipping line</Text>
              {c.byCarrier.map((s) => <Text key={s.carrier} style={typography.caption}>{s.carrier}: {s.count}</Text>)}
              <Button title="Export containers (CSV)" variant="outline" onPress={() => exportCsv('containers')} loading={exporting === 'containers'} disabled={exporting !== null} />
            </Card>

            <Card style={styles.stack}>
              <Text style={typography.h3}>Documents</Text>
              <View style={styles.statRow}>
                <Stat label="Verified" value={report!.documents.verified} tone={colors.normal} />
                <Stat label="Need review" value={report!.documents.needsReview} tone={colors.attention} />
              </View>
            </Card>

            <Card style={styles.stack}>
              <Text style={typography.h3}>Expenses</Text>
              {report!.finance.byCurrency.length === 0 ? <Text style={typography.caption}>No expenses in this period.</Text> : null}
              {report!.finance.byCurrency.map((r) => (
                <View key={r.currency} style={styles.stack}>
                  <Text style={typography.bodyMedium}>{r.currency} · {r.count} expense{r.count === 1 ? '' : 's'}</Text>
                  <Text style={typography.caption}>Approved {money(r.approved, r.currency)} · Pending {money(r.pending, r.currency)} · Rejected {money(r.rejected, r.currency)}</Text>
                </View>
              ))}
              {report!.finance.approvedByCategory.length > 0 ? <Text style={typography.bodyMedium}>Approved, by category</Text> : null}
              {report!.finance.approvedByCategory.map((r) => <Text key={`${r.currency}-${r.category}`} style={typography.caption}>{r.category}: {money(r.total, r.currency)}</Text>)}
              <Text style={typography.caption}>Currencies are never added together or converted.</Text>
              <Button title="Export expenses (CSV)" variant="outline" onPress={() => exportCsv('expenses')} loading={exporting === 'expenses'} disabled={exporting !== null} />
            </Card>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  statRow: { flexDirection: 'row', gap: spacing.md },
  stat: { flex: 1, gap: 2 },
  statValue: { fontSize: 24, fontWeight: '800', color: colors.navy },
  error: { color: colors.urgent },
});
