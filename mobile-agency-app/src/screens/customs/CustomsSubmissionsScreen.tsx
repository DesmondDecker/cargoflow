import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { ChipRow } from '../../components/ChipRow';
import { fetchCustomsSubmissions } from '../../api/customsApi';
import { apiErrorMessage } from '../../api/client';
import { CustomsSubmission } from '../../types/api';
import { MoreStackParamList } from '../../navigation/types';
import { formatShortDateTime } from '../../utils/status';
import { colors, radius, spacing, typography } from '../../theme/theme';

type Props = NativeStackScreenProps<MoreStackParamList, 'CustomsSubmissions'>;
type Filter = 'all' | CustomsSubmission['status'];

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'returned', label: 'Returned' },
  { key: 'approved', label: 'Approved' },
];

const TONE = {
  pending: { fg: colors.attention, bg: colors.attentionBg, label: 'Waiting for Customs' },
  approved: { fg: colors.normal, bg: colors.normalBg, label: 'Approved' },
  returned: { fg: colors.urgent, bg: colors.urgentBg, label: 'Returned: needs correcting' },
};

export function CustomsSubmissionsScreen({ navigation }: Props) {
  const [items, setItems] = useState<CustomsSubmission[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await fetchCustomsSubmissions());
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const visible = filter === 'all' ? items : items.filter((i) => i.status === filter);
  const returned = items.filter((i) => i.status === 'returned').length;

  return (
    <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.orange} />}>
      <View style={styles.stack}>
        <Text style={typography.h1}>Customs verification</Text>
        <Text style={typography.caption}>Send the six details of a transaction to Customs for verification. Customs approves it or returns it for correction, and you see the result and the approval reference here.</Text>
        <Button title="New submission" onPress={() => navigation.navigate('CustomsSubmission')} />
        {returned > 0 ? <Text style={styles.returned}>{returned} returned for correction. Open it to fix and resubmit.</Text> : null}
        <ChipRow options={FILTERS} value={filter} onChange={setFilter} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading && items.length === 0 ? <ActivityIndicator color={colors.orange} /> : null}
        {!loading && visible.length === 0 ? <Text style={typography.caption}>Nothing here yet.</Text> : null}
        {visible.map((s) => {
          const tone = TONE[s.status];
          return (
            <Pressable key={s._id} onPress={() => navigation.navigate('CustomsSubmission', { submissionId: s._id })}>
              <Card style={styles.stack}>
                <View style={styles.row}>
                  <Text style={typography.bodyMedium}>{s.containerNumber}</Text>
                  <View style={[styles.pill, { backgroundColor: tone.bg }]}><Text style={[styles.pillText, { color: tone.fg }]}>{tone.label}</Text></View>
                </View>
                <Text style={typography.caption}>CVC {s.cvcNumber} · BL {s.billOfLadingNumber}</Text>
                {s.status === 'approved' ? <Text style={styles.approved}>{s.approvalReference} · {formatShortDateTime(s.reviewedAt)}</Text> : null}
                {s.status === 'returned' && s.returnReason ? <Text style={styles.reason}>{s.returnReason}</Text> : null}
                {s.status === 'pending' ? <Text style={typography.caption}>Sent {formatShortDateTime(s.submittedAt)}</Text> : null}
              </Card>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  pill: { borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: spacing.md },
  pillText: { fontSize: 12, fontWeight: '700' },
  error: { color: colors.urgent },
  returned: { color: colors.urgent, fontWeight: '700' },
  approved: { color: colors.normal, fontWeight: '700' },
  reason: { color: colors.urgent },
});
