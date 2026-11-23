import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Modal, RefreshControl, SafeAreaView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { ChipRow } from '../../components/ChipRow';
import { BookingStatus, cancelStorageBooking, fetchStorageBookings, rateStorageBooking, StorageBooking } from '../../api/storageApi';
import { apiErrorMessage } from '../../api/client';
import { formatShortDate } from '../../utils/status';
import { colors, radius, spacing, typography } from '../../theme/theme';

type Filter = 'all' | BookingStatus;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'requested', label: 'Requested' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'in_storage', label: 'In storage' },
  { key: 'collected', label: 'Collected' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'declined', label: 'Declined' },
];

const MEANING: Record<BookingStatus, { label: string; text: string; fg: string; bg: string }> = {
  requested: { label: 'Waiting for the warehouse', text: 'No space is held until the warehouse accepts.', fg: colors.attention, bg: colors.attentionBg },
  confirmed: { label: 'Confirmed', text: 'Space is held. The warehouse checks the goods in when they arrive.', fg: colors.info, bg: colors.infoBg },
  in_storage: { label: 'In storage', text: 'The goods are at the warehouse.', fg: colors.info, bg: colors.infoBg },
  collected: { label: 'Collected', text: 'The goods have been collected.', fg: colors.normal, bg: colors.normalBg },
  declined: { label: 'Declined', text: 'The warehouse could not take it. Request another one.', fg: colors.urgent, bg: colors.urgentBg },
  cancelled: { label: 'Cancelled', text: 'This request was cancelled.', fg: colors.textSecondary, bg: colors.border },
};

const money = (n: number) => `SLE ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export function StorageBookingsScreen() {
  const [bookings, setBookings] = useState<StorageBooking[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState<StorageBooking | null>(null);

  const load = useCallback(async () => {
    try {
      setBookings(await fetchStorageBookings());
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cancel = (b: StorageBooking) =>
    Alert.alert('Cancel this request?', b.warehouseId?.businessName ?? '', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel booking',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelStorageBooking(b._id);
            await load();
          } catch (err) {
            Alert.alert('Could not cancel', apiErrorMessage(err));
          }
        },
      },
    ]);

  const rate = async (stars: number) => {
    if (!rating) return;
    try {
      await rateStorageBooking(rating._id, stars);
      setRating(null);
      await load();
    } catch (err) {
      Alert.alert('Could not save the rating', apiErrorMessage(err));
    }
  };

  const visible = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);

  return (
    <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.orange} />}>
      <View style={styles.stack}>
        <Text style={typography.h1}>Storage bookings</Text>
        <Text style={typography.caption}>Find storage from a container's page. Requests wait for the warehouse to accept.</Text>
        <ChipRow options={FILTERS} value={filter} onChange={setFilter} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading && bookings.length === 0 ? <ActivityIndicator color={colors.orange} /> : null}
        {!loading && visible.length === 0 ? <Text style={typography.caption}>Nothing here yet.</Text> : null}
        {visible.map((b) => {
          const m = MEANING[b.status];
          return (
            <Card key={b._id} style={styles.stack}>
              <View style={styles.row}>
                <Text style={typography.bodyMedium}>{b.warehouseId?.businessName ?? 'Warehouse'}</Text>
                <View style={[styles.pill, { backgroundColor: m.bg }]}><Text style={[styles.pillText, { color: m.fg }]}>{m.label}</Text></View>
              </View>
              <Text style={typography.caption}>{b.containerId?.containerNumber ?? 'No container'} · {b.unitsBooked} units · {formatShortDate(b.startDate)} to {formatShortDate(b.endDate)}</Text>
              <Text style={typography.caption}>Estimated {money(b.estimatedTotalPrice)}{b.warehouseId?.phone ? ` · ${b.warehouseId.phone}` : ''}</Text>
              <Text style={typography.caption}>{m.text}</Text>
              {b.checkIn?.completedAt ? <Text style={typography.caption}>Checked in {formatShortDate(b.checkIn.completedAt)}{b.checkIn.notes ? `: ${b.checkIn.notes}` : ''}</Text> : null}
              {b.checkOut?.completedAt ? <Text style={typography.caption}>Checked out {formatShortDate(b.checkOut.completedAt)}{b.checkOut.notes ? `: ${b.checkOut.notes}` : ''}</Text> : null}
              {b.rating ? <Text style={styles.rated}>You rated this {b.rating.stars} ★</Text> : null}
              {b.status === 'requested' || b.status === 'confirmed' ? <Button title="Cancel booking" variant="outline" onPress={() => cancel(b)} /> : null}
              {b.status === 'collected' && !b.rating ? <Button title="Rate this warehouse" variant="outline" onPress={() => setRating(b)} /> : null}
            </Card>
          );
        })}
      </View>

      <Modal visible={rating !== null} transparent animationType="fade" onRequestClose={() => setRating(null)}>
        <SafeAreaView style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={typography.h2}>Rate {rating?.warehouseId?.businessName}</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => rate(n)} hitSlop={6}><Text style={styles.star}>{'★'.repeat(n)}</Text></Pressable>
              ))}
            </View>
            <Button title="Not now" variant="outline" onPress={() => setRating(null)} />
          </View>
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  pill: { borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: spacing.md },
  pillText: { fontSize: 12, fontWeight: '700' },
  error: { color: colors.urgent },
  rated: { color: colors.normal, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.lg },
  dialog: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md },
  stars: { gap: spacing.sm, alignItems: 'center' },
  star: { fontSize: 26, color: colors.orange },
});
