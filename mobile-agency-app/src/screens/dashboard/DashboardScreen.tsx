import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { colors, spacing, typography } from '../../theme/theme';
import { useAuthStore } from '../../store/authStore';
import { fetchContainers, fetchDashboardStats } from '../../api/containerApi';
import { StatusPill } from '../../components/StatusPill';
import { usePrefsStore } from '../../store/prefsStore';
import { greeting } from '../../utils/status';
import { openContainersScreen } from '../../utils/navigation';
import { fetchLatestDigest } from '../../api/reportsApi';
import { apiErrorMessage } from '../../api/client';
import { DashboardStats, DailyDigest, ContainerListItem } from '../../types/api';
import { DashboardStackParamList } from '../../navigation/types';
import { onSyncStatusChange, SyncStatus } from '../../offline/syncEngine';
// HomeAdBanner and the Featured-listings section are deliberately not
// rendered here — see this screen's own note further down for why. Neither
// import was removed from the project; both are real, working code, just
// not shipped live yet.

type Props = NativeStackScreenProps<DashboardStackParamList, 'DashboardHome'>;

export function DashboardScreen({ navigation }: Props) {
  const showCarrierBreakdown = usePrefsStore((st) => st.showCarrierBreakdown);
  const [urgent, setUrgent] = useState<ContainerListItem[]>([]);
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
      const [statsResult, digestResult, urgentResult] = await Promise.allSettled([fetchDashboardStats(), fetchLatestDigest(), fetchContainers({ attentionLevel: 'urgent' })]);
      if (urgentResult.status === 'fulfilled') setUrgent(urgentResult.value.containers.slice(0, 5));
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
      <Text style={styles.greeting}>{greeting()}, {user?.name?.split(' ')[0] || 'there'}</Text>
      <Text style={styles.agencyName}>{agency?.name} · here's what's happening with your shipments.</Text>

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

      <View style={styles.tileGrid}>
        <Tile icon="cube-outline" tint={colors.info} bg={colors.infoBg} label="Total Containers" value={total} sub={`${Math.max(total - urgentCount - attentionCount, 0)} on track`} />
        <Tile icon="alert-circle-outline" tint={colors.urgent} bg={colors.urgentBg} label="At Risk" value={urgentCount} sub={`${attentionCount} more need attention`} />
        <Tile icon="time-outline" tint={colors.attention} bg={colors.attentionBg} label="Approaching Deadline" value={digest ? digest.deadlines.dueWithin3Days.length : null} sub={`within ${digest?.deadlines.windowDays ?? 3} days`} />
        <Tile icon="document-text-outline" tint={colors.info} bg={colors.infoBg} label="Missing Documents" value={digest ? digest.missingDocumentsContainerCount : null} sub="requires action" />
      </View>

      <Card style={styles.digestCard}>
        <Text style={styles.cardTitle}>Urgent Shipments</Text>
        {urgent.length === 0 ? <Text style={styles.digestLabel}>Nothing urgent right now.</Text> : null}
        {urgent.map((c) => (
          <Pressable key={c._id} style={styles.urgentRow} onPress={() => navigation.navigate('ContainerCaseFile', { containerId: c._id, containerNumber: c.containerNumber })}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={typography.bodyMedium}>{c.containerNumber}</Text>
              <Text style={typography.caption} numberOfLines={1}>{c.attentionReasons[0] || c.shippingLine || ''}</Text>
            </View>
            <StatusPill status={c.status} />
          </Pressable>
        ))}
      </Card>

      <Card style={styles.digestCard}>
        <Text style={styles.cardTitle}>Quick Actions</Text>
        <Pressable style={styles.action} onPress={() => openContainersScreen(navigation, 'AddContainer')}>
          <Ionicons name="add-circle-outline" size={22} color={colors.orange} />
          <Text style={styles.actionText}>Register Container</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      </Card>

      {showCarrierBreakdown && stats && stats.byCarrier.length > 0 ? (
        <Card style={styles.digestCard}>
          <Text style={styles.cardTitle}>Containers by Shipping Line</Text>
          {stats.byCarrier.map((c) => (
            <DigestRow key={c._id} label={c._id} value={c.count} />
          ))}
        </Card>
      ) : null}

      {digest ? (
        <Card style={styles.digestCard}>
          <Text style={styles.cardTitle}>Today's Tracking Update</Text>
          <DigestRow label="Deadlines expired" value={digest.deadlines.expired.length} />
          <DigestRow label={`Deadlines due within ${digest.deadlines.windowDays ?? 3} days`} value={digest.deadlines.dueWithin3Days.length} />
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

      {/* Featured-listings section and the AdMob banner are deliberately
          not rendered here for this release. Featured listings would
          have little to show until there are verified drivers and listed
          warehouses to sponsor (drivers can now sign up and be verified, but
          no warehouse-storage screen exists yet). The
          ad banner would show nothing but Google's own test creative,
          which earns zero revenue and looks exactly like what it is — a
          placeholder — in front of a real customer. Both features are
          real, working code (HomeAdBanner.tsx, agencyApi.fetchFeaturedListings,
          the whole backend sponsorship system) kept in the project for when
          there's real inventory and a real AdMob account to turn them on
          with, not deleted. */}
    </Screen>
  );
}

function Tile({
  icon,
  tint,
  bg,
  label,
  value,
  sub,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  bg: string;
  label: string;
  value: number | null;
  sub: string;
}) {
  return (
    <Card style={styles.tile}>
      <View style={[styles.tileIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value === null ? '—' : value}</Text>
      <Text style={styles.tileSub}>{sub}</Text>
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
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.md },
  tile: { width: '47.5%', gap: 2 },
  tileIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  tileLabel: { ...typography.caption },
  tileValue: { fontSize: 28, fontWeight: '800', color: colors.navy },
  tileSub: { ...typography.caption, color: colors.textMuted },
  urgentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  actionText: { flex: 1, ...typography.bodyMedium },
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
