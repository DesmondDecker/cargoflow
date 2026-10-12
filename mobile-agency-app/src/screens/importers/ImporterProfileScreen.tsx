import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { AttentionBadge } from '../../components/AttentionBadge';
import { colors, spacing, typography } from '../../theme/theme';
import { fetchImporterProfile } from '../../api/reportsApi';
import { apiErrorMessage } from '../../api/client';
import { ImporterProfile } from '../../types/api';
import { ImportersStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ImportersStackParamList, 'ImporterProfile'>;

function formatDate(value?: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ImporterProfileScreen({ route }: Props) {
  const { importerId } = route.params;
  const [data, setData] = useState<ImporterProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchImporterProfile(importerId));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [importerId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading && !data) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.orange} />
        </View>
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
        </View>
      </Screen>
    );
  }

  const { importer, summary, attentionContainers, upcomingDeadlines } = data;

  return (
    <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.orange} />}>
      <Text style={styles.title}>{importer.name}</Text>
      {importer.contactPerson ? <Text style={styles.subtitle}>{importer.contactPerson}</Text> : null}
      {importer.phone ? <Text style={styles.subtitle}>{importer.phone}</Text> : null}

      <View style={styles.statGrid}>
        <StatBox label="Active" value={summary.activeContainers} />
        <StatBox label="Historical" value={summary.historicalContainers} />
        <StatBox label="B/Ls" value={summary.billsOfLading} />
        <StatBox label="Documents" value={summary.documents} />
      </View>

      {attentionContainers.length > 0 ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Needs Attention ({attentionContainers.length})</Text>
          {attentionContainers.map((c) => (
            <View key={c._id} style={styles.row}>
              <Text style={styles.rowLabel}>{c.containerNumber}</Text>
              <AttentionBadge level={c.attentionLevel} />
            </View>
          ))}
        </Card>
      ) : null}

      {upcomingDeadlines.length > 0 ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Deadlines</Text>
          {upcomingDeadlines.map((d, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.rowLabel}>
                {d.containerNumber} — {d.ruleName}
              </Text>
              <Text style={styles.rowValue}>{formatDate(d.dueDate)}</Text>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <Card style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { color: colors.urgent },
  title: { ...typography.h1 },
  subtitle: { ...typography.body, color: colors.textSecondary },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.lg, marginBottom: spacing.md },
  statBox: { width: '47%', alignItems: 'center' },
  statValue: { fontSize: 26, fontWeight: '800', color: colors.navy },
  statLabel: { ...typography.caption, marginTop: 2 },
  section: { marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  rowLabel: { ...typography.body, flex: 1, marginRight: spacing.sm },
  rowValue: { ...typography.bodyMedium },
});
