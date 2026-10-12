import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { colors, spacing, typography } from '../../theme/theme';
import { useAuthStore } from '../../store/authStore';
import { fetchDashboardStats } from '../../api/containerApi';
import { fetchLatestDigest } from '../../api/reportsApi';
import { apiErrorMessage } from '../../api/client';
import { DashboardStats, DailyDigest } from '../../types/api';
import { DashboardStackParamList } from '../../navigation/types';
import { onSyncStatusChange, SyncStatus } from '../../offline/syncEngine';

type Props = NativeStackScreenProps<DashboardStackParamList, 'DashboardHome'>;

export function DashboardScreen(_props: Props) {
  const user = useAuthStore((s) => s.user);
  const agency = useAuthStore((s) => s.agency);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [digest, setDigest] = useState<DailyDigest | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    return onSyncStatusChange((status, pending) => {
      setSyncStatus(status);
      setPendingCount(pending);
    });
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [statsResult, digestResult] = await Promise.allSettled([fetchDashboardStats(), fetchLatestDigest()]);
      if (statsResult.status === 'fulfilled') setStats(statsResult.value);
      if (digestResult.status === 'fulfilled') setDigest(digestResult.value.digest);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const urgentCount = stats?.byAttention.find((a) => a._id === 'urgent')?.count || 0;
  const attentionCount = stats?.byAttention.find((a) => a._id === 'attention')?.count || 0;
  const total = stats?.totalContainers || 0;

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange} />}>
      <Text style={styles.greeting}>Hi {user?.name?.split(' ')[0] || 'there'}</Text>
      <Text style={styles.agencyName}>{agency?.name}</Text>

      {syncStatus === 'offline' ? (
        <View style={styles.syncBanner}>
          <Text style={styles.syncBannerText}>
            📡 Offline{pendingCount > 0 ? ` — ${pendingCount} change${pendingCount > 1 ? 's' : ''} waiting to sync` : ''}
          </Text>
        </View>
      ) : syncStatus === 'syncing' ? (
        <View style={[styles.syncBanner, styles.syncBannerActive]}>
          <Text style={[styles.syncBannerText, styles.syncBannerActiveText]}>☁️ Syncing offline changes…</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.statRow}>
        <StatCard label="Need Attention" value={urgentCount + attentionCount} tone="attention" />
        <StatCard label="Total Containers" value={total} tone="neutral" />
      </View>

      <View style={styles.statRow}>
        <StatCard label="Urgent" value={urgentCount} tone="urgent" small />
        <StatCard label="Attention" value={attentionCount} tone="attention" small />
        <StatCard label="Normal" value={Math.max(total - urgentCount - attentionCount, 0)} tone="normal" small />
      </View>

      {digest ? (
        <Card style={styles.digestCard}>
          <Text style={styles.cardTitle}>Today's Tracking Update</Text>
          <DigestRow label="Deadlines expired" value={digest.deadlines.expired.length} />
          <DigestRow label="Deadlines due within 3 days" value={digest.deadlines.dueWithin3Days.length} />
          <DigestRow label="Missing CTN" value={digest.missingCTNReminders.length} />
          <DigestRow label="Missing documents (any type)" value={digest.missingDocumentsContainerCount} />
          <DigestRow label="No activity in 5+ days" value={digest.staleContainerCount} />

          {digest.missingCTNReminders.length > 0 ? (
            <View style={styles.reminderList}>
              <Text style={styles.reminderHeading}>Missing CTN</Text>
              {digest.missingCTNReminders.slice(0, 5).map((r, i) => (
                <Text key={i} style={styles.reminderLine}>
                  • {r.blNumber} — {r.importerName} ({r.containerNumber})
                </Text>
              ))}
              {digest.missingCTNReminders.length > 5 ? (
                <Text style={styles.reminderMore}>+{digest.missingCTNReminders.length - 5} more</Text>
              ) : null}
            </View>
          ) : null}
        </Card>
      ) : null}
    </Screen>
  );
}

function StatCard({
  label,
  value,
  tone,
  small,
}: {
  label: string;
  value: number;
  tone: 'urgent' | 'attention' | 'normal' | 'neutral';
  small?: boolean;
}) {
  const toneColor =
    tone === 'urgent' ? colors.urgent : tone === 'attention' ? colors.attention : tone === 'normal' ? colors.normal : colors.navy;
  return (
    <Card style={[styles.statCard, small && styles.statCardSmall]}>
      <Text style={[styles.statValue, { color: toneColor }, small && styles.statValueSmall]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

function DigestRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.digestRow}>
      <Text style={styles.digestLabel}>{label}</Text>
      <Text style={styles.digestValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  greeting: { ...typography.h2 },
  agencyName: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
  syncBanner: { backgroundColor: colors.attentionBg, padding: spacing.sm, borderRadius: 8, marginBottom: spacing.md },
  syncBannerText: { color: colors.attention, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  syncBannerActive: { backgroundColor: colors.infoBg },
  syncBannerActiveText: { color: colors.info },
  error: { color: colors.urgent, marginBottom: spacing.md },
  statRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  statCard: { flex: 1, alignItems: 'center' },
  statCardSmall: { paddingVertical: spacing.md },
  statValue: { fontSize: 32, fontWeight: '800' },
  statValueSmall: { fontSize: 22 },
  statLabel: { ...typography.caption, marginTop: spacing.xs, textAlign: 'center' },
  digestCard: { marginTop: spacing.md },
  cardTitle: { ...typography.h3, marginBottom: spacing.md },
  digestRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  digestLabel: { ...typography.body, color: colors.textSecondary },
  digestValue: { ...typography.bodyMedium },
  reminderList: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  reminderHeading: { ...typography.label, textTransform: 'uppercase', marginBottom: spacing.xs },
  reminderLine: { ...typography.caption, color: colors.textPrimary, marginBottom: 2 },
  reminderMore: { ...typography.caption, color: colors.orange, marginTop: 2 },
});
