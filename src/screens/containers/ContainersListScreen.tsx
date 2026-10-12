import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { AttentionBadge } from '../../components/AttentionBadge';
import { colors, spacing, typography } from '../../theme/theme';
import { fetchContainers } from '../../api/containerApi';
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
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showingCache, setShowingCache] = useState(false);

  const load = useCallback(async (activeFilter: AttentionLevel | 'all', query: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchContainers({
        attentionLevel: activeFilter === 'all' ? undefined : activeFilter,
        search: query || undefined,
      });
      setContainers(result.containers);
      setShowingCache(false);
      // Only the unfiltered view is cached — that's the one someone opens
      // with no connectivity, so it's the one worth having ready offline.
      if (activeFilter === 'all' && !query) {
        upsertContainers(result.containers);
      }
    } catch (err) {
      // No connectivity (or the request otherwise failed) — fall back to
      // whatever was cached from the last successful load, so the screen
      // still shows something instead of just an error.
      const cached = readCachedContainers();
      if (cached.length > 0 && activeFilter === 'all' && !query) {
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

  useFocusEffect(
    useCallback(() => {
      load(filter, search);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter])
  );

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.header}>
        <TextInput
          style={styles.search}
          placeholder="Search container number..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => load(filter, search)}
          returnKeyType="search"
        />
        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.filterChip, filter === f.key && styles.filterChipActive]}>
              <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>{f.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {showingCache ? (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>📡 Offline — showing containers from your last sync</Text>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={containers}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(filter, search)} tintColor={colors.orange} />}
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
  header: { padding: spacing.lg, paddingBottom: spacing.sm, backgroundColor: colors.background },
  search: {
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
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
  offlineBanner: { backgroundColor: colors.attentionBg, marginHorizontal: spacing.lg, marginBottom: spacing.sm, padding: spacing.sm, borderRadius: 8 },
  offlineBannerText: { color: colors.attention, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  error: { color: colors.urgent, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
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
