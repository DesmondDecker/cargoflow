import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { ChipRow } from '../../components/ChipRow';
import { approveExpense, fetchExpenses, rejectExpense, Expense } from '../../api/financeApi';
import { apiErrorMessage } from '../../api/client';
import { formatShortDate } from '../../utils/status';
import { openCaseFile } from '../../utils/navigation';
import { colors, radius, spacing, typography } from '../../theme/theme';

type Filter = 'all' | Expense['status'];

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

const TONE: Record<Expense['status'], { fg: string; bg: string }> = {
  pending: { fg: colors.attention, bg: colors.attentionBg },
  approved: { fg: colors.normal, bg: colors.normalBg },
  rejected: { fg: colors.urgent, bg: colors.urgentBg },
};

const money = (amount: number, currency: string) => `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function totalsByCurrency(list: Expense[]): string {
  const sums = new Map<string, number>();
  list.forEach((e) => sums.set(e.currency, (sums.get(e.currency) || 0) + e.amount));
  return sums.size === 0 ? '—' : Array.from(sums.entries()).map(([cur, v]) => money(v, cur)).join(' · ');
}

export function FinanceHomeScreen() {
  const nav = useNavigation();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setExpenses(await fetchExpenses({}));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const visible = useMemo(() => (filter === 'all' ? expenses : expenses.filter((e) => e.status === filter)), [expenses, filter]);
  const pending = useMemo(() => expenses.filter((e) => e.status === 'pending'), [expenses]);
  const approved = useMemo(() => expenses.filter((e) => e.status === 'approved'), [expenses]);

  const act = async (expense: Expense, action: 'approve' | 'reject') => {
    setBusyId(expense._id);
    try {
      if (action === 'approve') await approveExpense(expense._id);
      else await rejectExpense(expense._id);
      await load();
    } catch (err) {
      Alert.alert(action === 'approve' ? 'Could not approve' : 'Could not reject', apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const confirm = (expense: Expense, action: 'approve' | 'reject') =>
    Alert.alert(action === 'approve' ? 'Approve this expense?' : 'Reject this expense?', `${expense.category} · ${money(expense.amount, expense.currency)}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: action === 'approve' ? 'Approve' : 'Reject', style: action === 'reject' ? 'destructive' : 'default', onPress: () => act(expense, action) },
    ]);

  return (
    <Screen scroll={false} padded={false}>
      <FlatList
        contentContainerStyle={styles.list}
        data={visible}
        keyExtractor={(e) => e._id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.orange} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={typography.h1}>Expenses</Text>
            <View style={styles.tiles}>
              <Card style={styles.tile}><Text style={typography.label}>PENDING ({pending.length})</Text><Text style={styles.tileValue}>{totalsByCurrency(pending)}</Text></Card>
              <Card style={styles.tile}><Text style={typography.label}>APPROVED ({approved.length})</Text><Text style={styles.tileValue}>{totalsByCurrency(approved)}</Text></Card>
            </View>
            <ChipRow options={FILTERS} value={filter} onChange={setFilter} />
            <Text style={typography.caption}>Record a new expense or payment from a container's case file.</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={loading ? undefined : <Text style={styles.empty}>No expenses {filter === 'all' ? 'yet' : `that are ${filter}`}.</Text>}
        renderItem={({ item }) => {
          const tone = TONE[item.status];
          return (
            <Card style={styles.row}>
              <Pressable
                disabled={!item.containerId}
                onPress={() => item.containerId && openCaseFile(nav, item.containerId)}
              >
                <View style={styles.rowTop}>
                  <Text style={typography.bodyMedium}>{item.category}</Text>
                  <Text style={typography.bodyMedium}>{money(item.amount, item.currency)}</Text>
                </View>
                {item.description ? <Text style={typography.caption}>{item.description}</Text> : null}
                <View style={styles.rowTop}>
                  <View style={[styles.pill, { backgroundColor: tone.bg }]}><Text style={[styles.pillText, { color: tone.fg }]}>{item.status[0].toUpperCase() + item.status.slice(1)}</Text></View>
                  <Text style={typography.caption}>{formatShortDate(item.createdAt)}</Text>
                </View>
                {item.status === 'rejected' && item.rejectionReason ? <Text style={styles.reason}>Reason: {item.rejectionReason}</Text> : null}
              </Pressable>
              {item.status === 'pending' ? (
                <View style={styles.actions}>
                  <Button title="Approve" onPress={() => confirm(item, 'approve')} disabled={busyId === item._id} style={styles.actionButton} />
                  <Button title="Reject" variant="outline" onPress={() => confirm(item, 'reject')} disabled={busyId === item._id} style={styles.actionButton} />
                </View>
              ) : null}
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md },
  header: { gap: spacing.md, marginBottom: spacing.sm },
  tiles: { flexDirection: 'row', gap: spacing.md },
  tile: { flex: 1, gap: 4 },
  tileValue: { ...typography.bodyMedium, fontSize: 15 },
  error: { color: colors.urgent },
  empty: { ...typography.caption, textAlign: 'center', marginTop: spacing.xl },
  row: { gap: spacing.sm },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  pill: { borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: spacing.md },
  pillText: { fontSize: 12, fontWeight: '700' },
  reason: { ...typography.caption, color: colors.urgent },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  actionButton: { flex: 1, paddingVertical: 8 },
});
