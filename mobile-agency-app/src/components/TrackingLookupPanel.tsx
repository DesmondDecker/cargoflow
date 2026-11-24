import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card } from './Card';
import { Button } from './Button';
import { deleteSavedTracking, fetchSavedTracking, SavedTrackingItem, saveUnregisteredTracking, trackUnregisteredContainer, TrackingReferenceType } from '../api/containerApi';
import { apiErrorMessage } from '../api/client';
import { LiveTracking } from '../types/api';
import { colors, radius, spacing, typography } from '../theme/theme';
import { formatShortDate, formatShortDateTime } from '../utils/status';
import { confirmDestructiveAction } from '../utils/confirmDestructiveAction';

export function TrackingLookupPanel() {
  const [code, setCode] = useState('');
  const [referenceType, setReferenceType] = useState<TrackingReferenceType>('container');
  const [carrierName, setCarrierName] = useState('');
  const [tracking, setTracking] = useState<LiveTracking | null>(null);
  const [trackedCode, setTrackedCode] = useState('');
  const [trackedType, setTrackedType] = useState<TrackingReferenceType>('container');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedItems, setSavedItems] = useState<SavedTrackingItem[]>([]);
  const [savedError, setSavedError] = useState<string | null>(null);

  useEffect(() => {
    fetchSavedTracking()
      .then(setSavedItems)
      .catch((err) => setSavedError(apiErrorMessage(err)));
  }, []);

  const lookup = async (
    value = code,
    requestedType: TrackingReferenceType = referenceType,
    requestedCarrier = carrierName,
  ) => {
    const normalized = value.trim().toUpperCase().replace(/\s+/g, '');
    const lookupType = requestedType;
    setCode(normalized);
    setError(null);
    setTracking(null);
    setTrackedCode('');
    const valid = lookupType === 'bill_of_lading' ? /^[A-Z0-9]{5,35}$/.test(normalized) : /^[A-Z]{4}\d{7}$/.test(normalized);
    if (!valid) {
      setError(lookupType === 'bill_of_lading'
        ? 'Enter a bill of lading number containing 5 to 35 letters or digits.'
        : 'Enter a container number in the format 4 letters followed by 7 digits.');
      return;
    }

    setLoading(true);
    try {
      const result = await trackUnregisteredContainer(normalized, lookupType, requestedCarrier || undefined);
      setTracking(result.tracking ?? null);
      setTrackedCode(result.trackingNumber);
      setTrackedType(result.trackingType);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const saveResult = async () => {
    if (!tracking || !trackedCode) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await saveUnregisteredTracking(trackedCode, tracking, trackedType);
      setSavedItems((current) => [saved, ...current.filter((item) => item.containerNumber !== saved.containerNumber || item.trackingType !== saved.trackingType)]);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const removeSavedResult = async (containerNumber: string, savedType: TrackingReferenceType) => {
    const confirmed = await confirmDestructiveAction(
      'Delete saved tracking?',
      `${containerNumber} will be removed from this agency's saved tracking list.`,
    );
    if (!confirmed) return;
    setSavedError(null);
    try {
      await deleteSavedTracking(containerNumber, savedType);
      setSavedItems((current) => current.filter((item) => item.containerNumber !== containerNumber || item.trackingType !== savedType));
      if (trackedCode === containerNumber && trackedType === savedType) {
        setTracking(null);
        setTrackedCode('');
      }
    } catch (err) {
      setSavedError(apiErrorMessage(err));
    }
  };

  const isLive = !!tracking && tracking.source !== 'bic_owner_code_table' && tracking.resolved;
  const isSaved = !!trackedCode && savedItems.some((item) => item.containerNumber === trackedCode && item.trackingType === trackedType);

  return (
    <View style={styles.content}>
      <Text style={typography.h3}>Track without adding</Text>
      <Text style={styles.intro}>Get a one-time result without registering a container or bill of lading.</Text>
      <View style={styles.referenceTypes}>
        {([
          { value: 'container', label: 'Container' },
          { value: 'bill_of_lading', label: 'Bill of lading' },
        ] as const).map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: referenceType === option.value }}
            onPress={() => setReferenceType(option.value)}
            style={[styles.referenceType, referenceType === option.value && styles.referenceTypeActive]}
          >
            <Text style={[styles.referenceTypeText, referenceType === option.value && styles.referenceTypeTextActive]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
      {referenceType === 'bill_of_lading' ? (
        <View style={styles.carriers}>
          <Text style={typography.caption}>Shipping line (if not identified from your saved B/L)</Text>
          {(['', 'Maersk', 'MSC', 'CMA CGM', 'Hapag-Lloyd'] as const).map((carrier) => (
            <Pressable
              key={carrier || 'auto'}
              accessibilityRole="button"
              accessibilityState={{ selected: carrierName === carrier }}
              onPress={() => setCarrierName(carrier)}
              style={[styles.carrierOption, carrierName === carrier && styles.carrierOptionActive]}
            >
              <Text style={[styles.carrierOptionText, carrierName === carrier && styles.carrierOptionTextActive]}>{carrier || 'Auto'}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={(value) => setCode(value.toUpperCase())}
        placeholder={referenceType === 'bill_of_lading' ? 'Bill of lading number (e.g. 270560510)' : 'Container number (e.g. MSKU1234565)'}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={35}
        returnKeyType="search"
        onSubmitEditing={() => lookup()}
        accessibilityLabel={referenceType === 'bill_of_lading' ? 'Bill of lading number' : 'Container number'}
      />
      <Button title="Track" onPress={() => { void lookup(); }} loading={loading} />

      {loading ? <ActivityIndicator color={colors.orange} style={styles.loading} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {tracking && trackedCode ? (
        <Card style={styles.result}>
          <Text style={styles.code}>{trackedCode}</Text>
          {trackedType === 'bill_of_lading' ? <Text style={typography.caption}>Bill of lading</Text> : null}
          <Text style={styles.carrier}>{tracking.carrierName || 'Carrier not identified'}</Text>
          <Text style={[styles.status, isLive ? styles.live : styles.notLive]}>
            {isLive ? 'Live carrier result' : 'Live result unavailable'}
          </Text>
          {tracking.status ? <Text style={typography.body}>{tracking.status}</Text> : null}
          {tracking.matchedContainerNumber ? <Text style={typography.caption}>Container: {tracking.matchedContainerNumber}</Text> : null}
          {tracking.latestEvent ? (
            <View style={styles.event}>
              <Text style={typography.bodyMedium}>{tracking.latestEvent.description}</Text>
              {[tracking.latestEvent.location, tracking.latestEvent.facility].filter(Boolean).length ? (
                <Text style={typography.caption}>
                  {[tracking.latestEvent.location, tracking.latestEvent.facility].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
              {tracking.latestEvent.at ? <Text style={typography.caption}>{formatShortDateTime(tracking.latestEvent.at)}</Text> : null}
            </View>
          ) : null}
          {tracking.vesselName ? <Text style={typography.caption}>Vessel: {tracking.vesselName}</Text> : null}
          {tracking.originPlace || tracking.destinationPlace ? (
            <Text style={typography.caption}>{tracking.originPlace || '—'} → {tracking.destinationPlace || '—'}</Text>
          ) : null}
          {tracking.eta ? <Text style={typography.caption}>ETA {formatShortDate(tracking.eta)}</Text> : null}
          {tracking.checkedAt ? <Text style={typography.caption}>Checked {formatShortDateTime(tracking.checkedAt)}</Text> : null}
          {tracking.publicTrackingUrl ? (
            <Pressable onPress={() => Linking.openURL(tracking.publicTrackingUrl!)} accessibilityRole="link">
              <Text style={styles.link}>Open carrier tracking page</Text>
            </Pressable>
          ) : null}
          <Button
            title={saving ? 'Saving…' : isSaved ? 'Update saved tracking' : 'Save tracking'}
            variant="outline"
            onPress={saveResult}
            loading={saving}
          />
          <Text style={styles.disclaimer}>
            Saved lookups stay in this agency’s Tracking tab. They are not registered containers and do not receive automatic background refreshes.
          </Text>
        </Card>
      ) : null}
      {savedError ? <Text style={styles.error}>{savedError}</Text> : null}
      {savedItems.length ? (
        <View style={styles.savedList}>
          <Text style={typography.h3}>Saved tracking</Text>
          {savedItems.map((item) => (
            <Card key={item._id} style={styles.savedItem}>
              <View style={styles.savedDetails}>
                <Text style={typography.bodyMedium}>{item.containerNumber}</Text>
                {item.trackingType === 'bill_of_lading' ? <Text style={typography.caption}>Bill of lading</Text> : null}
                <Text style={typography.caption}>{item.tracking.carrierName || 'Carrier not identified'}</Text>
                {item.tracking.status ? <Text style={typography.caption}>{item.tracking.status}</Text> : null}
                <Text style={styles.savedDate}>Saved {formatShortDateTime(item.updatedAt)}</Text>
              </View>
              <Pressable
                onPress={() => {
                  setReferenceType(item.trackingType);
                  setTrackedType(item.trackingType);
                  setCarrierName(item.tracking.carrierName || '');
                  lookup(item.containerNumber, item.trackingType, item.tracking.carrierName || '');
                }}
                disabled={loading}
              >
                <Text style={styles.link}>Track again</Text>
              </Pressable>
              <Pressable
                onPress={() => removeSavedResult(item.containerNumber, item.trackingType)}
                accessibilityRole="button"
                accessibilityLabel={`Delete saved tracking for ${item.containerNumber}`}
                style={styles.deleteButton}
              >
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            </Card>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  intro: { ...typography.caption },
  referenceTypes: { flexDirection: 'row', gap: spacing.sm },
  referenceType: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  referenceTypeActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  referenceTypeText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  referenceTypeTextActive: { color: colors.white },
  carriers: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  carrierOption: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.white },
  carrierOptionActive: { borderColor: colors.orange, backgroundColor: colors.orangeLight },
  carrierOptionText: { ...typography.caption, color: colors.textSecondary },
  carrierOptionTextActive: { color: colors.textPrimary, fontWeight: '700' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontSize: 16,
  },
  loading: { marginTop: spacing.sm },
  error: { color: colors.urgent },
  result: { gap: spacing.sm, marginTop: spacing.sm },
  savedList: { gap: spacing.sm, marginTop: spacing.md },
  savedItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  savedDetails: { flex: 1, gap: 2 },
  deleteButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xs },
  deleteText: { ...typography.caption, color: colors.urgent, fontWeight: '700' },
  savedDate: { ...typography.caption, color: colors.textMuted, fontSize: 11 },
  code: { ...typography.h2, letterSpacing: 0.6 },
  carrier: { ...typography.bodyMedium, color: colors.textSecondary },
  status: { ...typography.label },
  live: { color: colors.normal },
  notLive: { color: colors.attention },
  event: { gap: spacing.xs, paddingVertical: spacing.xs },
  link: { ...typography.bodyMedium, color: colors.info, paddingVertical: spacing.sm },
  disclaimer: { ...typography.caption, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
});
