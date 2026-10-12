import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { colors, spacing, typography } from '../../theme/theme';
import {
  fetchExpenses, fetchPayments, fetchReceipts, generateReceipt,
  Expense, ShipmentPayment, Receipt,
} from '../../api/financeApi';
import { apiErrorMessage } from '../../api/client';
import { ContainersStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ContainersStackParamList, 'Finance'>;

const STATUS_COLOR: Record<Expense['status'], { fg: string; bg: string }> = {
  pending: { fg: colors.attention, bg: colors.attentionBg },
  approved: { fg: colors.normal, bg: colors.normalBg },
  rejected: { fg: colors.urgent, bg: colors.urgentBg },
};

// Container-scoped expense/payment/receipt tracking (Phase 1 of CargoFlow
// Finance). Deliberately no revenue-vs-expense margin shown here — that's
// Shipment Profitability, a distinct feature this pass doesn't build (see
// the backend's own comments on why "outstanding balance" isn't on the
// receipt either: there's no invoicing/expected-amount concept yet for
// either number to be real rather than guessed).
export function FinanceScreen({ route, navigation }: Props) {
  const { containerId, importerId, importerName } = route.params;
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<ShipmentPayment[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [e, p, r] = await Promise.all([
        fetchExpenses({ containerId }),
        fetchPayments({ containerId }),
        fetchReceipts({ containerId }),
      ]);
      setExpenses(e);
      setPayments(p);
      setReceipts(r);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [containerId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const receiptForPayment = (paymentId: string) => receipts.find((r) => r.paymentId === paymentId);

  const onGenerateReceipt = async (payment: ShipmentPayment) => {
    setGeneratingFor(payment._id);
    try {
      const receipt = await generateReceipt(payment._id);
      setReceipts((prev) => [receipt, ...prev]);
      onShareReceipt(receipt);
    } catch (err) {
      Alert.alert('Could not generate receipt', apiErrorMessage(err));
    } finally {
      setGeneratingFor(null);
    }
  };

  const onShareReceipt = async (receipt: Receipt) => {
    try {
      // A plain URL in the share message works reliably cross-platform
      // (WhatsApp, Messages, email all turn it into a tappable link) without
      // needing a native file-download step first.
      await Share.share({ message: `Receipt ${receipt.receiptNumber}: ${receipt.pdfUrl}` });
    } catch {
      // User cancelled the share sheet — not an error worth surfacing.
    }
  };

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.actions}>
        <Button
          title="+ Expense"
          variant="secondary"
          onPress={() => navigation.navigate('RecordExpense', { containerId })}
          style={styles.actionButton}
        />
        <Button
          title="+ Payment"
          onPress={() => navigation.navigate('RecordPayment', { containerId, importerId, importerName })}
          style={styles.actionButton}
        />
      </View>

      {loading ? <ActivityIndicator color={colors.orange} style={styles.spinner} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.list}>
        <Text style={styles.sectionTitle}>Payments Received</Text>
        {payments.length === 0 && !loading ? <Text style={styles.empty}>No payments recorded yet.</Text> : null}
        {payments.map((p) => {
          const receipt = receiptForPayment(p._id);
          return (
            <Card key={p._id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.amount}>{p.currency} {p.amount.toLocaleString()}</Text>
                <Text style={styles.meta}>{new Date(p.paidAt).toLocaleDateString()}</Text>
              </View>
              <Text style={styles.meta}>{p.paymentMethod.replace('_', ' ')}{p.notes ? ` · ${p.notes}` : ''}</Text>
              {receipt ? (
                <Pressable onPress={() => onShareReceipt(receipt)}>
                  <Text style={styles.receiptLink}>Receipt {receipt.receiptNumber} · Share</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => onGenerateReceipt(p)} disabled={generatingFor === p._id}>
                  <Text style={styles.receiptLink}>{generatingFor === p._id ? 'Generating…' : 'Generate Receipt'}</Text>
                </Pressable>
              )}
            </Card>
          );
        })}

        <Text style={styles.sectionTitle}>Expenses</Text>
        {expenses.length === 0 && !loading ? <Text style={styles.empty}>No expenses recorded yet.</Text> : null}
        {expenses.map((e) => (
          <Card key={e._id} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.amount}>{e.currency} {e.amount.toLocaleString()}</Text>
              <Text style={[styles.statusBadge, { color: STATUS_COLOR[e.status].fg, backgroundColor: STATUS_COLOR[e.status].bg }]}>
                {e.status}
              </Text>
            </View>
            <Text style={styles.meta}>{e.category}{e.description ? ` · ${e.description}` : ''}</Text>
            {e.status === 'rejected' && e.rejectionReason ? <Text style={styles.rejectionReason}>Reason: {e.rejectionReason}</Text> : null}
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.sm },
  actionButton: { flex: 1 },
  spinner: { marginTop: spacing.lg },
  error: { color: colors.urgent, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  list: { padding: spacing.lg, paddingTop: 0 },
  sectionTitle: { ...typography.h3, marginTop: spacing.md, marginBottom: spacing.sm },
  empty: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  card: { marginBottom: spacing.md },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amount: { ...typography.h3 },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  statusBadge: {
    ...typography.caption, fontWeight: '700', textTransform: 'uppercase', fontSize: 10,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4,
  },
  receiptLink: { ...typography.bodyMedium, color: colors.orange, marginTop: spacing.sm },
  rejectionReason: { ...typography.caption, color: colors.urgent, marginTop: 4 },
});
