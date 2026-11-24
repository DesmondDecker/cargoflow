import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { ChipRow } from '../../components/ChipRow';
import { fetchCustomsSubmissions } from '../../api/customsApi';
import { apiErrorMessage } from '../../api/client';
import { CustomsSubmission } from '../../types/api';
import { CustomsStackParamList } from '../../navigation/types';
import { formatShortDateTime } from '../../utils/status';
import { colors, radius, spacing, typography } from '../../theme/theme';

type Props = NativeStackScreenProps<CustomsStackParamList, 'CustomsSubmissions'>;
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
  const pending = items.filter((i) => i.status === 'pending').length;
  const approved = items.filter((i) => i.status === 'approved').length;
  const returned = items.filter((i) => i.status === 'returned').length;

  return (
    <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.orange} />}>
      <View style={styles.stack}>
        <Text style={styles.eyebrow}>SHIPMENT COMPLIANCE</Text>
        <Text style={typography.h1}>Customs verification</Text>
        <Text style={styles.intro}>Submit transaction details for review and track approvals, pending reviews and corrections in one place.</Text>
        <View style={styles.summaryRow}>
          <Summary icon="time-outline" label="Pending" value={pending} tint={colors.attention} background={colors.attentionBg} />
          <Summary icon="checkmark-circle-outline" label="Approved" value={approved} tint={colors.normal} background={colors.normalBg} />
          <Summary icon="alert-circle-outline" label="Returned" value={returned} tint={colors.urgent} background={colors.urgentBg} />
        </View>
        <Button title="New submission" onPress={() => navigation.navigate('CustomsSubmission')} />
        {returned > 0 ? <Text style={styles.returned}>{returned} returned for correction. Open it to fix and resubmit.</Text> : null}
        <ChipRow options={FILTERS} value={filter} onChange={setFilter} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading && items.length === 0 ? <ActivityIndicator color={colors.orange} /> : null}
        {!loading && visible.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><Ionicons name="shield-checkmark-outline" size={26} color={colors.orangeDark} /></View>
            <Text style={styles.emptyTitle}>{items.length === 0 ? 'No submissions yet' : `No ${filter} submissions`}</Text>
            <Text style={styles.emptyHint}>New Customs requests and their decisions will appear here.</Text>
          </View>
        ) : null}
        {visible.map((s) => {
          const tone = TONE[s.status];
          return (
            <Pressable key={s._id} onPress={() => navigation.navigate('CustomsSubmission', { submissionId: s._id })} accessibilityRole="button">
              <Card style={styles.submissionCard}>
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

function Summary({
  icon,
  label,
  value,
  tint,
  background,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  tint: string;
  background: string;
}) {
  return (
    <View style={[styles.summary, { backgroundColor: background }]}>
      <Ionicons name={icon} size={18} color={tint} />
      <Text style={[styles.summaryValue, { color: tint }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  eyebrow: { ...typography.label, color: colors.orangeDark, letterSpacing: 0.8 },
  intro: { ...typography.caption, lineHeight: 20 },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.xs },
  summary: { flex: 1, minHeight: 82, borderRadius: radius.md, padding: spacing.sm, alignItems: 'flex-start', justifyContent: 'center', gap: 2, borderWidth: 1, borderColor: colors.border },
  summaryValue: { fontSize: 20, fontWeight: '800' },
  summaryLabel: { ...typography.caption, fontSize: 11 },
  submissionCard: { gap: spacing.sm, borderWidth: 1, borderColor: colors.border, shadowOpacity: 0.03 },
  empty: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyIcon: { width: 54, height: 54, borderRadius: radius.lg, backgroundColor: colors.orangeBg, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { ...typography.h3, fontSize: 16 },
  emptyHint: { ...typography.caption, textAlign: 'center', lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  pill: { borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: spacing.md },
  pillText: { fontSize: 12, fontWeight: '700' },
  error: { color: colors.urgent },
  returned: { color: colors.urgent, fontWeight: '700' },
  approved: { color: colors.normal, fontWeight: '700' },
  reason: { color: colors.urgent },
});
