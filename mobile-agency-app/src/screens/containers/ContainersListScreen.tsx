import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { AttentionBadge } from '../../components/AttentionBadge';
import { colors, spacing, typography } from '../../theme/theme';
import { fetchContainers, fetchDashboardStats, resolveCode, trackCodes } from '../../api/containerApi';
import { apiErrorMessage } from '../../api/client';
import { AttentionLevel, ContainerListItem } from '../../types/api';
import { ContainersStackParamList } from '../../navigation/types';
import { readCachedContainers, upsertContainers } from '../../offline/containerCache';

type Props = NativeStackScreenProps<ContainersStackParamList, 'ContainersList'>;

const FILTERS: { key: AttentionLevel | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'urgent', label: 'Urgent' },
  { key: 'attention', label: 'Attention' },
  { key: 'normal', label: 'Normal' },
];

export function ContainersListScreen({ navigation }: Props) {
  const [containers, setContainers] = useState<ContainerListItem[]>([]);
  const [filter, setFilter] = useState<AttentionLevel | 'all'>('all');
  const [carrierFilter, setCarrierFilter] = useState<string | undefined>(undefined);
  const [carrierOptions, setCarrierOptions] = useState<{ name: string; count: number }[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [bulkTrackingLoading, setBulkTrackingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showingCache, setShowingCache] = useState(false);
  const [externalLookup, setExternalLookup] = useState<{ code: string; carrierName?: string; publicTrackingUrl: string } | null>(null);
  const [bulkTrackResults, setBulkTrackResults] = useState<{ code: string; type: string; id?: string; blNumber?: string; containerNumber?: string; containerId?: string }[]>([]);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('AddContainer')} hitSlop={12} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>+ Add</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  const load = useCallback(async (activeFilter: AttentionLevel | 'all', query: string, carrier: string | undefined) => {
    setLoading(true);
    setError(null);
    setExternalLookup(null);
    try {
      const result = await fetchContainers({
        attentionLevel: activeFilter === 'all' ? undefined : activeFilter,
        shippingLine: carrier,
        search: query || undefined,
      });
      setContainers(result.containers);
      setShowingCache(false);
      setExternalLookup(result.externalLookup ?? null);
      // Only the unfiltered view is cached — that's the one someone opens
      // with no connectivity, so it's the one worth having ready offline.
      if (activeFilter === 'all' && !query && !carrier) {
        upsertContainers(result.containers);
      }

      if (!result.containers.length && query.trim() && !result.externalLookup) {
        try {
          const external = await resolveCode(query.trim());
          if (external.type === 'external_tracking' && external.publicTrackingUrl) {
            setExternalLookup({ code: external.code || query.trim(), carrierName: external.carrierName, publicTrackingUrl: external.publicTrackingUrl });
          }
        } catch {
          // This is only a best-effort internet fallback — no need to surface
          // a hard error if the lookup itself fails while the local list is empty.
        }
      }
    } catch (err) {
      // No connectivity (or the request otherwise failed) — fall back to
      // whatever was cached from the last successful load, so the screen
      // still shows something instead of just an error.
      const cached = readCachedContainers();
      if (cached.length > 0 && activeFilter === 'all' && !query && !carrier) {
        setContainers(cached);
        setShowingCache(true);
        setError(null);
      } else {
        setError(apiErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardStats()
      .then((stats) => setCarrierOptions(stats.byCarrier.map((c) => ({ name: c._id, count: c.count }))))
      .catch(() => {
        // The carrier filter row just stays empty — not worth surfacing a
        // page-level error for a secondary filter option list.
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(filter, search, carrierFilter);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter, carrierFilter])
  );

  const onBulkTrack = useCallback(async () => {
    const raw = search.trim();
    if (!raw) {
      Alert.alert('No tracking codes entered', 'Paste or type one or more container numbers or B/L numbers, separated by commas or new lines.');
      return;
    }

    setBulkTrackingLoading(true);
    setError(null);
    try {
      const response = await trackCodes(raw);
      setBulkTrackResults(response.results ?? []);
      if (!response.results?.length) {
        setBulkTrackResults([]);
      }
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBulkTrackingLoading(false);
    }
  }, [search]);

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.header}>
        <TextInput
          style={styles.search}
          placeholder="Search container or B/L number..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => load(filter, search, carrierFilter)}
          returnKeyType="search"
        />
        <Pressable onPress={onBulkTrack} disabled={bulkTrackingLoading} style={[styles.bulkTrackButton, bulkTrackingLoading && styles.bulkTrackButtonDisabled]}>
          <Text style={styles.bulkTrackButtonText}>{bulkTrackingLoading ? 'Tracking…' : 'Bulk track'}</Text>
        </Pressable>
        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.filterChip, filter === f.key && styles.filterChipActive]}>
              <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>{f.label}</Text>
            </Pressable>
          ))}
        </View>
        {carrierOptions.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.carrierRow}>
            <Pressable
              onPress={() => setCarrierFilter(undefined)}
              style={[styles.carrierChip, !carrierFilter && styles.carrierChipActive]}
            >
              <Text style={[styles.carrierChipText, !carrierFilter && styles.carrierChipTextActive]}>All lines</Text>
            </Pressable>
            {carrierOptions.map((c) => (
              <Pressable
                key={c.name}
                onPress={() => setCarrierFilter(c.name)}
                style={[styles.carrierChip, carrierFilter === c.name && styles.carrierChipActive]}
              >
                <Text style={[styles.carrierChipText, carrierFilter === c.name && styles.carrierChipTextActive]}>
                  {c.name} ({c.count})
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>

      {showingCache ? (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>📡 Offline — showing containers from your last sync</Text>
        </View>
      ) : null}
      {externalLookup ? (
        <View style={styles.externalBanner}>
          <Text style={styles.externalBannerText}>
            {externalLookup.carrierName ? `Not in this agency yet — open ${externalLookup.carrierName} tracking for ${externalLookup.code}.` : `Not in this agency yet — open public tracking for ${externalLookup.code}.`}
          </Text>
          <Pressable onPress={() => Linking.openURL(externalLookup.publicTrackingUrl)}>
            <Text style={styles.externalLink}>Open tracking</Text>
          </Pressable>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {bulkTrackResults.length > 0 ? (
        <View style={styles.bulkResultsWrap}>
          <Text style={styles.bulkResultsTitle}>Bulk tracking results</Text>
          {bulkTrackResults.map((item) => {
            const isContainer = item.type === 'container';
            const isBl = item.type === 'bill_of_lading';
            const label = isContainer ? item.containerNumber || item.code : isBl ? item.blNumber || item.code : item.code;
            const targetId = item.containerId || item.id;

            return (
              <Card key={`${item.type}-${item.code}`} style={styles.bulkResultCard}>
                <View style={styles.bulkResultRow}>
                  <View style={styles.bulkResultTextWrap}>
                    <Text style={styles.bulkResultCode}>{label}</Text>
                    <Text style={styles.bulkResultMeta}>
                      {isContainer ? 'Container' : isBl ? 'B/L' : 'Not found'}
                      {isContainer && item.blNumber ? ` · B/L ${item.blNumber}` : ''}
                      {isBl && item.containerNumber ? ` · Container ${item.containerNumber}` : ''}
                    </Text>
                  </View>
                  {targetId ? (
                    <Pressable
                      onPress={() => navigation.navigate('ContainerCaseFile', { containerId: targetId, containerNumber: item.containerNumber || item.blNumber || item.code })}
                      style={styles.bulkOpenButton}
                    >
                      <Text style={styles.bulkOpenButtonText}>Open</Text>
                    </Pressable>
                  ) : null}
                </View>
              </Card>
            );
          })}
        </View>
      ) : null}

      <FlatList
        data={containers}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(filter, search, carrierFilter)} tintColor={colors.orange} />}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No containers match this filter.</Text> : null}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('ContainerCaseFile', { containerId: item._id, containerNumber: item.containerNumber })}
          >
            <Card style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.containerNumber}>{item.containerNumber}</Text>
                <AttentionBadge level={item.attentionLevel} />
              </View>
              <Text style={styles.status}>{item.status}</Text>
              {item.attentionReasons.length > 0 ? (
                <Text style={styles.reason} numberOfLines={2}>
                  {item.attentionReasons[0]}
                </Text>
              ) : null}
              <View style={styles.metaRow}>
                {item.shippingLine ? <Text style={styles.meta}>{item.shippingLine}</Text> : null}
                {item.liveTracking?.resolved && item.liveTracking.status ? (
                  <Text style={styles.meta}>{item.liveTracking.status}</Text>
                ) : null}
                {typeof item.importerId === 'object' && item.importerId?.name ? (
                  <Text style={styles.meta}>{item.importerId.name}</Text>
                ) : null}
              </View>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerButton: { paddingHorizontal: spacing.sm },
  headerButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  header: { padding: spacing.lg, paddingBottom: spacing.sm, backgroundColor: colors.background },
  search: {
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  bulkTrackButton: {
    backgroundColor: colors.orange,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  bulkTrackButtonDisabled: { opacity: 0.6 },
  bulkTrackButtonText: { color: colors.white, fontWeight: '700' },
  filterRow: { flexDirection: 'row', gap: spacing.sm },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  filterChipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  filterChipTextActive: { color: colors.white },
  carrierRow: { marginTop: spacing.sm },
  carrierChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  carrierChipActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  carrierChipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  carrierChipTextActive: { color: colors.white },
  offlineBanner: { backgroundColor: colors.attentionBg, marginHorizontal: spacing.lg, marginBottom: spacing.sm, padding: spacing.sm, borderRadius: 8 },
  offlineBannerText: { color: colors.attention, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  externalBanner: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginHorizontal: spacing.lg, marginBottom: spacing.sm, padding: spacing.sm },
  externalBannerText: { color: colors.textPrimary, fontSize: 13, fontWeight: '500' },
  externalLink: { color: colors.orange, fontWeight: '700', marginTop: spacing.xs },
  error: { color: colors.urgent, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  bulkResultsWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  bulkResultsTitle: { ...typography.h3, marginBottom: spacing.sm },
  bulkResultCard: { marginBottom: spacing.sm },
  bulkResultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bulkResultTextWrap: { flex: 1, marginRight: spacing.sm },
  bulkResultCode: { ...typography.bodyMedium },
  bulkResultMeta: { ...typography.caption, marginTop: 2, color: colors.textSecondary },
  bulkOpenButton: { backgroundColor: colors.navy, borderRadius: 8, paddingVertical: 8, paddingHorizontal: spacing.md },
  bulkOpenButtonText: { color: colors.white, fontWeight: '700' },
  listContent: { padding: spacing.lg, paddingTop: 0, gap: spacing.md },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xxl },
  card: { marginBottom: spacing.md },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  containerNumber: { ...typography.h3 },
  status: { ...typography.bodyMedium, color: colors.navy, marginBottom: 4 },
  reason: { ...typography.caption, color: colors.attention, marginBottom: spacing.xs },
  metaRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  meta: { ...typography.caption },
});
