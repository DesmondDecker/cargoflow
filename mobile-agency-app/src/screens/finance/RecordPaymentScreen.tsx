import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Field } from '../../components/Field';
import { Button } from '../../components/Button';
import { colors, radius, spacing, typography } from '../../theme/theme';
import { recordPayment, PAYMENT_METHODS, ShipmentPaymentMethod } from '../../api/financeApi';
import { apiErrorMessage } from '../../api/client';
import { ContainersStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ContainersStackParamList, 'RecordPayment'>;

const METHOD_LABELS: Record<ShipmentPaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  mobile_money: 'Mobile Money',
  cheque: 'Cheque',
  other: 'Other',
};

export function RecordPaymentScreen({ navigation, route }: Props) {
  const { containerId, importerId, importerName } = route.params;
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('SLE');
  const [method, setMethod] = useState<ShipmentPaymentMethod>('cash');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSave = async () => {
    if (!importerId) {
      setError('This container has no importer on file — a payment needs a customer to record it against.');
      return;
    }
    const amt = Number(amount);
    if (!amount.trim() || Number.isNaN(amt) || amt <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await recordPayment({
        importerId,
        containerId,
        amount: amt,
        currency: currency.trim() || 'SLE',
        paymentMethod: method,
        notes: notes.trim() || undefined,
      });
      navigation.goBack();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      {importerName ? <Text style={styles.fromLabel}>From {importerName}</Text> : null}

      <View style={styles.row}>
        <View style={styles.amountField}>
          <Field label="Amount" value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" autoFocus />
        </View>
        <View style={styles.currencyField}>
          <Field label="Currency" value={currency} onChangeText={(v) => setCurrency(v.toUpperCase())} placeholder="SLE" autoCapitalize="characters" maxLength={6} />
        </View>
      </View>

      <Text style={styles.label}>Payment Method</Text>
      <View style={styles.chipRow}>
        {PAYMENT_METHODS.map((m) => (
          <Pressable key={m} onPress={() => setMethod(m)} style={[styles.chip, method === m && styles.chipActive]}>
            <Text style={[styles.chipText, method === m && styles.chipTextActive]}>{METHOD_LABELS[m]}</Text>
          </Pressable>
        ))}
      </View>

      <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" multiline />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title={saving ? 'Saving…' : 'Record Payment'} onPress={onSave} loading={saving} style={styles.button} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  fromLabel: { ...typography.bodyMedium, color: colors.textSecondary, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  amountField: { flex: 2 },
  currencyField: { flex: 1 },
  label: { ...typography.label, marginTop: spacing.sm, marginBottom: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { ...typography.caption, fontWeight: '600' },
  chipTextActive: { color: colors.white },
  error: { color: colors.urgent, marginBottom: spacing.md },
  button: { marginTop: spacing.sm, marginBottom: spacing.xxl },
});
