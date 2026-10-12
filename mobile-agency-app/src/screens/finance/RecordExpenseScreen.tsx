import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Field } from '../../components/Field';
import { Button } from '../../components/Button';
import { colors, radius, spacing, typography } from '../../theme/theme';
import { createExpense, EXPENSE_CATEGORIES, ExpenseCategory } from '../../api/financeApi';
import { apiErrorMessage } from '../../api/client';
import { ContainersStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ContainersStackParamList, 'RecordExpense'>;

export function RecordExpenseScreen({ navigation, route }: Props) {
  const { containerId } = route.params;
  const [category, setCategory] = useState<ExpenseCategory>('Transportation');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('SLE');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSave = async () => {
    const amt = Number(amount);
    if (!amount.trim() || Number.isNaN(amt) || amt <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createExpense({ containerId, category, amount: amt, currency: currency.trim() || 'SLE', description: description.trim() || undefined });
      navigation.goBack();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.label}>Category</Text>
      <View style={styles.chipRow}>
        {EXPENSE_CATEGORIES.map((c) => (
          <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, category === c && styles.chipActive]}>
            <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.row}>
        <View style={styles.amountField}>
          <Field label="Amount" value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" autoFocus />
        </View>
        <View style={styles.currencyField}>
          <Field label="Currency" value={currency} onChangeText={(v) => setCurrency(v.toUpperCase())} placeholder="SLE" autoCapitalize="characters" maxLength={6} />
        </View>
      </View>

      <Field label="Description" value={description} onChangeText={setDescription} placeholder="Optional — what this was for" multiline />

      <Text style={styles.note}>
        This goes in as pending until an owner or admin approves it. Attaching a photo of the receipt isn&apos;t
        wired up on this screen yet — the upload endpoint exists on the backend, this form just doesn&apos;t call it.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title={saving ? 'Saving…' : 'Record Expense'} onPress={onSave} loading={saving} style={styles.button} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.label, marginBottom: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { ...typography.caption, fontWeight: '600' },
  chipTextActive: { color: colors.white },
  row: { flexDirection: 'row', gap: spacing.md },
  amountField: { flex: 2 },
  currencyField: { flex: 1 },
  note: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.md, lineHeight: 17 },
  error: { color: colors.urgent, marginBottom: spacing.md },
  button: { marginTop: spacing.sm, marginBottom: spacing.xxl },
});
