import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { Field } from './Field';
import { TrackingProposal } from '../api/containerApi';
import { colors, spacing, typography } from '../theme/theme';

export interface ReviewedTracking {
  status: string;
  vesselName?: string;
  eta?: string;
  departedAt?: string;
  latestEvent?: { description: string; location?: string; at?: string };
}

interface Props {
  visible: boolean;
  carrierName: string;
  proposal: TrackingProposal | null;
  saving: boolean;
  error: string | null;
  onSave: (value: ReviewedTracking) => void;
  onCancel: () => void;
}

const isoDay = (iso?: string) => (iso ? iso.slice(0, 10) : '');
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function validDay(value: string): boolean {
  if (!DAY.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function TrackingReviewModal({ visible, carrierName, proposal, saving, error, onSave, onCancel }: Props) {
  const [status, setStatus] = useState('');
  const [event, setEvent] = useState('');
  const [where, setWhere] = useState('');
  const [eta, setEta] = useState('');
  const [departed, setDeparted] = useState('');
  const [vessel, setVessel] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!proposal) return;
    setStatus(proposal.status ?? '');
    setEvent(proposal.latestEvent?.description ?? '');
    setWhere('');
    setEta(isoDay(proposal.eta));
    setDeparted(isoDay(proposal.departedAt));
    setVessel(proposal.vesselName ?? '');
    setFormError(null);
  }, [proposal]);

  const save = () => {
    if (!status.trim()) return setFormError('Enter the current status.');
    if (eta && !validDay(eta)) return setFormError('ETA must be a date like 2026-11-05.');
    if (departed && !validDay(departed)) return setFormError('Departed must be a date like 2026-10-01.');
    setFormError(null);
    onSave({
      status: status.trim(),
      vesselName: vessel.trim() || undefined,
      eta: eta ? `${eta}T00:00:00.000Z` : undefined,
      departedAt: departed ? `${departed}T00:00:00.000Z` : undefined,
      latestEvent: event.trim() ? { description: event.trim(), location: where.trim() || undefined, at: proposal?.latestEvent?.at } : undefined,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={typography.h1}>Check what was read</Text>
            <Text style={typography.caption}>
              CargoFlow read this from {carrierName}'s page as best it could. Correct anything that is wrong or empty. Only what you confirm here is saved.
            </Text>
            {proposal && !proposal.containerFound ? (
              <View style={styles.warning}>
                <Text style={styles.warningText}>This container's number was not found in the text. Make sure you captured the right result.</Text>
              </View>
            ) : null}
            <Field label="Current status" value={status} onChangeText={setStatus} placeholder="e.g. Discharged at Freetown" />
            <Field label="Latest event (optional)" value={event} onChangeText={setEvent} />
            <Field label="Where (optional)" value={where} onChangeText={setWhere} />
            <Field label="ETA (YYYY-MM-DD, optional)" value={eta} onChangeText={setEta} autoCapitalize="none" keyboardType="numbers-and-punctuation" />
            <Field label="Departed (YYYY-MM-DD, optional)" value={departed} onChangeText={setDeparted} autoCapitalize="none" keyboardType="numbers-and-punctuation" />
            <Field label="Vessel (optional)" value={vessel} onChangeText={setVessel} />
            {formError || error ? <Text style={styles.error}>{formError || error}</Text> : null}
            <Button title="Save tracking" onPress={save} loading={saving} />
            <Button title="Cancel" variant="outline" onPress={onCancel} disabled={saving} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  warning: { backgroundColor: colors.attentionBg, padding: spacing.md, borderRadius: 8 },
  warningText: { color: colors.attention, fontWeight: '600' },
  error: { color: colors.urgent },
});
