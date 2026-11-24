import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { TrackingLookupPanel } from '../../components/TrackingLookupPanel';
import { StatusPill } from '../../components/StatusPill';
import { ChipRow } from '../../components/ChipRow';
import { SearchBar } from '../../components/SearchBar';
import { fetchContainers } from '../../api/containerApi';
import { apiErrorMessage } from '../../api/client';
import { ContainerListItem } from '../../types/api';
import { TrackingStackParamList } from '../../navigation/types';
import { daysFromNow, formatShortDate } from '../../utils/status';
import { colors, radius, spacing, typography } from '../../theme/theme';

type Props = NativeStackScreenProps<TrackingStackParamList, 'TrackingList'>;
type Filter = 'all' | 'transit' | 'arrived' | 'clearance' | 'risk';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'transit', label: 'In Transit' },
  { key: 'arrived', label: 'Arrived' },
  { key: 'clearance', label: 'Clearance' },
  { key: 'risk', label: 'At Risk' },
];

const CLOSED = ['Delivered', 'Closed'];

function matches(c: ContainerListItem, f: Filter): boolean {
  switch (f) {
    case 'transit': return c.status === 'In Transit' || c.status === 'In Transit To Destination';
    case 'arrived': return c.status === 'Arrived';
    case 'clearance': return c.status === 'Under Clearance' || c.status === 'Cleared';
    case 'risk': return c.attentionLevel !== 'normal';
    default: return true;
  }
}

export function TrackingListScreen({ navigation }: Props) {
  const [containers, setContainers] = useState<ContainerListItem[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await fetchContainers({});
      setContainers(result.containers.filter((c) => !CLOSED.includes(c.status)));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return containers.filter((c) => matches(c, filter) && (!q || c.containerNumber.toLowerCase().includes(q) || (c.shippingLine || '').toLowerCase().includes(q)));
  }, [containers, filter, search]);

  const counts = useMemo(() => ({
    transit: containers.filter((c) => matches(c, 'transit')).length,
    arrived: containers.filter((c) => matches(c, 'arrived')).length,
    clearance: containers.filter((c) => matches(c, 'clearance')).length,
  }), [containers]);

  return (
    <Screen scroll={false} padded={false}>
      <FlatList
        contentContainerStyle={styles.list}
        data={visible}
        keyExtractor={(c) => c._id}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.orange} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={typography.h1}>Tracking</Text>
            <Text style={styles.sub}>{counts.transit} in transit · {counts.arrived} arrived · {counts.clearance} in clearance</Text>
            <TrackingLookupPanel />
            <SearchBar value={search} onChangeText={setSearch} placeholder="Search container or carrier…" />
            <ChipRow options={FILTERS} value={filter} onChange={setFilter} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={loading ? undefined : <Text style={styles.empty}>No containers match.</Text>}
        renderItem={({ item }) => {
          const lt = item.liveTracking?.resolved ? item.liveTracking : undefined;
          const days = daysFromNow(lt?.eta);
          return (
            <Pressable onPress={() => navigation.navigate('TrackingTimeline', { containerId: item._id, containerNumber: item.containerNumber })}>
              <Card style={styles.card}>
                <View style={styles.icon}><Ionicons name="boat-outline" size={22} color={colors.info} /></View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={typography.bodyMedium}>{item.containerNumber}</Text>
                  <Text style={typography.caption}>{item.shippingLine || 'Carrier not set'}</Text>
                  <StatusPill status={item.status} />
                  {lt?.latestEvent ? <Text style={typography.caption} numberOfLines={1}>{lt.latestEvent.description}{lt.latestEvent.location ? ` · ${lt.latestEvent.location}` : ''}</Text> : null}
                </View>
                {lt?.eta ? (
                  <View style={styles.eta}>
                    <Text style={typography.caption}>ETA {formatShortDate(lt.eta)}</Text>
                    {days !== null ? <Text style={[styles.days, { color: days < 0 ? colors.urgent : colors.attention }]}>{days === 0 ? 'Today' : days > 0 ? `${days} day${days === 1 ? '' : 's'}` : `${-days}d ago`}</Text> : null}
                  </View>
                ) : null}
              </Card>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md },
  header: { gap: spacing.md, marginBottom: spacing.sm },
  sub: { ...typography.caption },
  error: { color: colors.urgent },
  empty: { ...typography.caption, textAlign: 'center', marginTop: spacing.xl },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 42, height: 42, borderRadius: radius.pill, backgroundColor: colors.infoBg, alignItems: 'center', justifyContent: 'center' },
  eta: { alignItems: 'flex-end', gap: 2 },
  days: { fontSize: 13, fontWeight: '700' },
});
