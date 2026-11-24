import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Logo } from '../../components/Logo';
import { colors, radius, spacing, typography } from '../../theme/theme';
import { useAuthStore } from '../../store/authStore';
import { fetchContainers, fetchDashboardStats } from '../../api/containerApi';
import { fetchCustomsSubmissions } from '../../api/customsApi';
import { StatusPill } from '../../components/StatusPill';
import { greeting } from '../../utils/status';
import { openContainersScreen, openMoreScreen, openTab } from '../../utils/navigation';
import { usePrefsStore } from '../../store/prefsStore';
import { fetchLatestDigest } from '../../api/reportsApi';
import { apiErrorMessage } from '../../api/client';
import { DashboardStats, DailyDigest, ContainerListItem } from '../../types/api';
import { DashboardStackParamList } from '../../navigation/types';
import { onSyncStatusChange, SyncStatus } from '../../offline/syncEngine';

type Props = NativeStackScreenProps<DashboardStackParamList, 'DashboardHome'>;
type IconName = keyof typeof Ionicons.glyphMap;

const QUICK_ACTIONS: {
  icon: IconName;
  label: string;
  tint: string;
  background: string;
  action: 'register' | 'tracking' | 'documents' | 'finance';
}[] = [
  { icon: 'cube-outline', label: 'Register Container', tint: colors.orangeDark, background: '#FFF1E4', action: 'register' },
  { icon: 'locate-outline', label: 'Track Shipment', tint: colors.info, background: colors.infoBg, action: 'tracking' },
  { icon: 'document-text-outline', label: 'Upload Document', tint: colors.normal, background: colors.normalBg, action: 'documents' },
  { icon: 'wallet-outline', label: 'Record Expense', tint: colors.purple, background: colors.purpleBg, action: 'finance' },
];

const STATUS_GROUPS: { label: string; terms: string[]; tint: string }[] = [
  { label: 'In transit', terms: ['transit', 'sailing', 'on vessel'], tint: colors.info },
  { label: 'At port', terms: ['port', 'arrived', 'discharged'], tint: colors.orange },
  { label: 'Customs', terms: ['custom'], tint: colors.purple },
  { label: 'Delayed', terms: ['delay', 'overdue', 'expired'], tint: colors.urgent },
];

function initials(name?: string): string {
  return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
}

function statusCount(stats: DashboardStats | null, terms: string[]): number {
  const status = stats?.byStatus.find((item) => {
    const value = item._id.toLowerCase();
    return terms.some((term) => value.includes(term));
  });
  return status?.count ?? 0;
}

export function DashboardScreen({ navigation }: Props) {
  const user = useAuthStore((state) => state.user);
  const agency = useAuthStore((state) => state.agency);
  const showCarrierBreakdown = usePrefsStore((state) => state.showCarrierBreakdown);
  const [urgent, setUrgent] = useState<ContainerListItem[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [digest, setDigest] = useState<DailyDigest | null>(null);
  const [customsCounts, setCustomsCounts] = useState({ pending: 0, returned: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [pendingCount, setPendingCount] = useState(0);
  const entrance = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const appear = Animated.timing(entrance, { toValue: 1, duration: 480, useNativeDriver: true });
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.035, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
      ]),
    );
    appear.start();
    breathing.start();
    return () => {
      appear.stop();
      breathing.stop();
    };
  }, [entrance, pulse]);

  useEffect(() => onSyncStatusChange((status, pending) => {
    setSyncStatus(status);
    setPendingCount(pending);
  }), []);

  const load = useCallback(async () => {
    setError(null);
    const [statsResult, digestResult, urgentResult, pendingCustomsResult, returnedCustomsResult] = await Promise.allSettled([
      fetchDashboardStats(),
      fetchLatestDigest(),
      fetchContainers({ attentionLevel: 'urgent' }),
      fetchCustomsSubmissions('pending'),
      fetchCustomsSubmissions('returned'),
    ]);
    if (statsResult.status === 'fulfilled') setStats(statsResult.value);
    if (digestResult.status === 'fulfilled') setDigest(digestResult.value.digest);
    if (urgentResult.status === 'fulfilled') setUrgent(urgentResult.value.containers.slice(0, 5));
    if (pendingCustomsResult.status === 'fulfilled' && returnedCustomsResult.status === 'fulfilled') {
      setCustomsCounts({ pending: pendingCustomsResult.value.length, returned: returnedCustomsResult.value.length });
    }
    const failures = [statsResult, digestResult, urgentResult, pendingCustomsResult, returnedCustomsResult]
      .filter((result) => result.status === 'rejected');
    if (failures.length === 5) {
      setError(apiErrorMessage((failures[0] as PromiseRejectedResult).reason));
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openSearch = () => {
    openContainersScreen(navigation, 'ContainersList', { search: search.trim() || undefined });
  };

  const runQuickAction = (action: (typeof QUICK_ACTIONS)[number]['action']) => {
    switch (action) {
      case 'register':
        openContainersScreen(navigation, 'AddContainer');
        break;
      case 'tracking':
        openTab(navigation, 'Tracking');
        break;
      case 'documents':
        openMoreScreen(navigation, 'Documents');
        break;
      case 'finance':
        openMoreScreen(navigation, 'Finance');
        break;
    }
  };

  const urgentCount = stats?.byAttention.find((item) => item._id === 'urgent')?.count ?? 0;
  const attentionCount = stats?.byAttention.find((item) => item._id === 'attention')?.count ?? 0;
  const pendingCustoms = customsCounts.pending;
  const returnedCustoms = customsCounts.returned;
  const date = new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const entranceStyle = {
    opacity: entrance,
    transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
  };

  return (
    <Screen
      safeAreaBackgroundColor={colors.orange}
      style={styles.screenContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange} />}
    >
      <Animated.View style={entranceStyle}>
        <View style={styles.appBar}>
          <Logo size="small" light />
          <View style={styles.appBarActions}>
            <Pressable
              onPress={() => openMoreScreen(navigation, 'Notifications')}
              style={styles.headerIcon}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={23} color={colors.white} />
            </Pressable>
            <Pressable
              onPress={() => openMoreScreen(navigation, 'EditAgencyProfile')}
              style={styles.avatar}
              accessibilityRole="button"
              accessibilityLabel="Agency profile"
            >
              <Text style={styles.avatarText}>{initials(user?.name)}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.intro}>
          <View style={styles.greetingRow}>
            <View style={styles.greetingCopy}>
              <Text style={styles.greeting}>{greeting()}, {user?.name?.split(' ')[0] || 'there'}</Text>
              <Text style={styles.agencyName}>{agency?.name || 'Your agency'} · your shipment overview</Text>
            </View>
            <Text style={styles.date}>{date}</Text>
          </View>

          <View style={styles.searchBar}>
            <Pressable onPress={openSearch} accessibilityRole="button" accessibilityLabel="Search shipments">
              <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
            </Pressable>
            <TextInput
              style={styles.searchInput}
              placeholder="Search container or B/L number..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={openSearch}
              returnKeyType="search"
              accessibilityLabel="Search container, bill of lading or importer"
            />
            <Pressable onPress={() => openContainersScreen(navigation, 'ScanCode')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Scan a code">
              <Ionicons name="scan-outline" size={21} color={colors.navy} />
            </Pressable>
          </View>
        </View>

        {syncStatus === 'offline' ? (
          <View style={[styles.syncBanner, styles.offlineBanner]}>
            <Ionicons name="cloud-offline-outline" size={17} color={colors.attention} />
            <Text style={styles.syncText}>Offline{pendingCount > 0 ? ` · ${pendingCount} change${pendingCount === 1 ? '' : 's'} waiting to sync` : ''}</Text>
          </View>
        ) : syncStatus === 'syncing' ? (
          <View style={[styles.syncBanner, styles.syncingBanner]}>
            <Ionicons name="cloud-upload-outline" size={17} color={colors.info} />
            <Text style={[styles.syncText, { color: colors.info }]}>Syncing offline changes…</Text>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Animated.View style={[styles.summaryCard, { transform: [{ scale: pulse }] }]}>
          <View style={styles.summaryHead}>
            <View>
              <Text style={styles.summaryEyebrow}>FLEET OVERVIEW</Text>
              <Text style={styles.summaryLabel}>Total containers</Text>
              <Text style={styles.summaryValue}>{stats?.totalContainers ?? '—'}</Text>
              <Text style={styles.summaryFoot}>{digest ? digest.newlyRegisteredLast24h : '—'} newly registered today</Text>
            </View>
            <View style={styles.summaryIcon}>
              <Ionicons name="cube" size={26} color={colors.white} />
            </View>
          </View>
          <View style={styles.statusGrid}>
            {STATUS_GROUPS.map((group) => (
              <View key={group.label} style={styles.statusItem}>
                <View style={[styles.statusDot, { backgroundColor: group.tint }]} />
                <Text style={styles.statusLabel}>{group.label}</Text>
                <Text style={styles.statusValue}>{statusCount(stats, group.terms)}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Quick actions</Text>
          <Text style={styles.sectionHint}>Common tasks, one tap away</Text>
        </View>
        <View style={styles.quickGrid}>
          {QUICK_ACTIONS.map((item) => (
            <Pressable
              key={item.action}
              onPress={() => runQuickAction(item.action)}
              style={({ pressed }) => [styles.quickAction, { backgroundColor: item.background }, pressed && styles.pressed]}
            >
              <View style={[styles.quickIcon, { backgroundColor: item.tint }]}>
                <Ionicons name={item.icon} size={19} color={colors.white} />
              </View>
              <Text style={styles.quickLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={item.tint} />
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Needs your attention</Text>
          <Pressable onPress={() => openContainersScreen(navigation, 'ContainersList')} style={styles.viewAll}>
            <Text style={styles.viewAllText}>View all</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.orange} />
          </Pressable>
        </View>
        <View style={styles.metricGrid}>
          <Metric icon="alert-circle" label="Urgent" value={urgentCount} tint={colors.urgent} background={colors.urgentBg} />
          <Metric icon="time" label="Due soon" value={digest?.deadlines.dueWithin3Days.length ?? 0} tint={colors.attention} background={colors.attentionBg} />
          <Metric icon="document-text" label="Missing documents" value={digest?.missingDocumentsContainerCount ?? 0} tint={colors.info} background={colors.infoBg} />
          <Metric icon="shield-checkmark" label="Customs pending" value={pendingCustoms} tint={colors.purple} background={colors.purpleBg} onPress={() => openTab(navigation, 'Customs')} />
        </View>

        <Pressable
          onPress={() => openTab(navigation, 'Customs')}
          style={({ pressed }) => [styles.customsBanner, pressed && styles.pressed]}
        >
          <View style={styles.customsIcon}>
            <Ionicons name="shield-checkmark-outline" size={22} color={colors.white} />
          </View>
          <View style={styles.customsCopy}>
            <Text style={styles.customsTitle}>Customs verification</Text>
            <Text style={styles.customsDescription}>
              {returnedCustoms > 0
                ? `${returnedCustoms} returned for correction · ${pendingCustoms} awaiting review`
                : `${pendingCustoms} submission${pendingCustoms === 1 ? '' : 's'} awaiting review`}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.white} />
        </Pressable>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Urgent shipments</Text>
          <Text style={styles.sectionHint}>{urgent.length} to review</Text>
        </View>
        <Card style={styles.alertCard}>
          {urgent.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={26} color={colors.normal} />
              <Text style={styles.emptyText}>Nothing urgent right now.</Text>
            </View>
          ) : urgent.map((container, index) => (
            <Pressable
              key={container._id}
              style={[styles.alertRow, index < urgent.length - 1 && styles.alertRowBorder]}
              onPress={() => navigation.navigate('ContainerCaseFile', { containerId: container._id, containerNumber: container.containerNumber })}
            >
              <View style={styles.alertIcon}>
                <Ionicons name="cube-outline" size={18} color={colors.orangeDark} />
              </View>
              <View style={styles.alertCopy}>
                <Text style={styles.alertNumber}>{container.containerNumber}</Text>
                <Text style={styles.alertMeta} numberOfLines={1}>{container.attentionReasons[0] || container.shippingLine || 'Needs review'}</Text>
              </View>
              <StatusPill status={container.status} />
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          ))}
        </Card>

        {showCarrierBreakdown && stats && stats.byCarrier.length > 0 ? (
          <Card style={styles.digestCard}>
            <Text style={styles.cardTitle}>Containers by shipping line</Text>
            {stats.byCarrier.map((carrier) => (
              <DigestRow key={carrier._id} label={carrier._id} value={carrier.count} />
            ))}
          </Card>
        ) : null}

        {digest ? (
          <Card style={styles.digestCard}>
            <Text style={styles.cardTitle}>Today's tracking update</Text>
            <DigestRow label="Deadlines expired" value={digest.deadlines.expired.length} />
            <DigestRow label={`Due within ${digest.deadlines.windowDays ?? 3} days`} value={digest.deadlines.dueWithin3Days.length} />
            <DigestRow label="Missing CTN" value={digest.missingCTNReminders.length} />
            <DigestRow label="Containers without recent updates" value={digest.staleContainerCount} />
            {digest.missingCTNReminders.slice(0, 3).map((reminder, index) => (
              <Text key={`${reminder.blNumber}-${index}`} style={styles.reminderLine}>
                {reminder.blNumber} · {reminder.importerName} · {reminder.containerNumber}
              </Text>
            ))}
            {digest.documentReminders.slice(0, 3).map((reminder, index) => (
              <Text key={`${reminder.blNumber}-${index}`} style={styles.reminderLine}>
                Missing {reminder.missingDocumentTypes.join(', ')} · {reminder.containerNumber}
              </Text>
            ))}
          </Card>
        ) : null}
      </Animated.View>
    </Screen>
  );
}

function Metric({
  icon,
  label,
  value,
  tint,
  background,
  onPress,
}: {
  icon: IconName;
  label: string;
  value: number;
  tint: string;
  background: string;
  onPress?: () => void;
}) {
  const content = (
    <>
      <View style={[styles.metricIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={18} color={colors.white} />
      </View>
      <Text style={[styles.metricValue, { color: tint }]}>{value}</Text>
      <Text style={styles.metricLabel} numberOfLines={1}>{label}</Text>
    </>
  );
  if (onPress) {
    return <Pressable onPress={onPress} style={[styles.metric, { backgroundColor: background }]}>{content}</Pressable>;
  }
  return <View style={[styles.metric, { backgroundColor: background }]}>{content}</View>;
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
  screenContent: { padding: 0, backgroundColor: colors.background },
  appBar: {
    minHeight: 76,
    backgroundColor: colors.orange,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appBarActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 38, height: 38, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  intro: {
    backgroundColor: colors.orange,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  greetingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  greetingCopy: { flex: 1 },
  greeting: { ...typography.h2, color: colors.white, fontSize: 20 },
  agencyName: { ...typography.caption, color: 'rgba(255,255,255,0.86)', marginTop: 3 },
  date: { ...typography.caption, color: 'rgba(255,255,255,0.9)', fontSize: 11, marginTop: 3 },
  searchBar: {
    minHeight: 48,
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 14, paddingVertical: spacing.sm },
  syncBanner: { marginHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  offlineBanner: { backgroundColor: colors.attentionBg },
  syncingBanner: { backgroundColor: colors.infoBg },
  syncText: { ...typography.caption, color: colors.attention, flex: 1 },
  error: { ...typography.caption, color: colors.urgent, marginHorizontal: spacing.lg, marginTop: spacing.md },
  summaryCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.orangeBorder,
    ...{
      shadowColor: colors.navy,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
  },
  summaryHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryEyebrow: { ...typography.label, color: colors.orangeDark, letterSpacing: 0.9, fontSize: 10 },
  summaryLabel: { ...typography.caption, marginTop: 4 },
  summaryValue: { fontSize: 34, fontWeight: '800', color: colors.navy, lineHeight: 40 },
  summaryFoot: { ...typography.caption, fontSize: 11, color: colors.textMuted },
  summaryIcon: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginTop: spacing.md, paddingTop: spacing.md, rowGap: spacing.sm },
  statusItem: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { flex: 1, ...typography.caption, fontSize: 12 },
  statusValue: { ...typography.bodyMedium, fontSize: 13 },
  sectionHeading: { marginHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { ...typography.h3, fontSize: 17 },
  sectionHint: { ...typography.caption, fontSize: 11 },
  quickGrid: { marginHorizontal: spacing.lg, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quickAction: { width: '48%', minHeight: 92, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  quickIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { flex: 1, ...typography.bodyMedium, fontSize: 12 },
  pressed: { opacity: 0.78 },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { color: colors.orangeDark, fontSize: 12, fontWeight: '600' },
  metricGrid: { marginHorizontal: spacing.lg, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metric: { width: '48%', minHeight: 100, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  metricIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontSize: 22, fontWeight: '800', marginTop: spacing.xs },
  metricLabel: { ...typography.caption, fontSize: 11 },
  customsBanner: { marginHorizontal: spacing.lg, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.navy, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  customsIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  customsCopy: { flex: 1 },
  customsTitle: { ...typography.bodyMedium, color: colors.white, fontSize: 14 },
  customsDescription: { ...typography.caption, color: 'rgba(255,255,255,0.76)', fontSize: 11, marginTop: 2 },
  alertCard: { marginHorizontal: spacing.lg, paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  alertRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  alertRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  alertIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.orangeBg, alignItems: 'center', justifyContent: 'center' },
  alertCopy: { flex: 1, gap: 3 },
  alertNumber: { ...typography.bodyMedium, fontSize: 13 },
  alertMeta: { ...typography.caption, fontSize: 11 },
  emptyState: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  emptyText: { ...typography.body, color: colors.textSecondary },
  digestCard: { marginHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.xl },
  cardTitle: { ...typography.h3, marginBottom: spacing.md },
  digestRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  digestLabel: { ...typography.body, color: colors.textSecondary, fontSize: 13 },
  digestValue: { ...typography.bodyMedium, fontSize: 13 },
  reminderLine: { ...typography.caption, marginTop: spacing.xs, fontSize: 11 },
});
