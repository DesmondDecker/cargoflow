import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { AttentionBadge } from '../../components/AttentionBadge';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { CarrierTrackingModal } from '../../components/CarrierTrackingModal';
import { CarrierPickerModal } from '../../components/CarrierPickerModal';
import { TrackingReviewModal, ReviewedTracking } from '../../components/TrackingReviewModal';
import axios from 'axios';
import { findCarrier } from '../../constants/carriers';
import { openMoreScreen } from '../../utils/navigation';
import { colors, spacing, typography } from '../../theme/theme';
import { fetchContainerCaseFile, refreshContainerTracking, changeContainerStatus, updateContainerDetails, pasteContainerTracking, setContainerShippingLine, previewContainerTracking, saveReviewedTracking, TrackingProposal } from '../../api/containerApi';
import { fetchAgencySettings } from '../../api/agencyApi';
import { apiErrorMessage } from '../../api/client';
import { ContainerCaseFile } from '../../types/api';
import { ContainersStackParamList, DashboardStackParamList } from '../../navigation/types';
import { enqueueMutation } from '../../offline/mutationQueue';
import { upsertSingleContainer } from '../../offline/containerCache';
import { getIsOnline } from '../../offline/syncEngine';

type Props = NativeStackScreenProps<ContainersStackParamList | DashboardStackParamList, 'ContainerCaseFile'>;

function formatUtcDate(value?: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function formatUtcDateTime(value?: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
}

function formatDate(value?: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ContainerCaseFileScreen({ route, navigation }: Props) {
  const { containerId } = route.params;
  const [data, setData] = useState<ContainerCaseFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasting, setPasting] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [trackOpen, setTrackOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [proposal, setProposal] = useState<TrackingProposal | null>(null);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [pickerSaving, setPickerSaving] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [detailsEditing, setDetailsEditing] = useState(false);
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailValues, setDetailValues] = useState({ containerNumber: '', shippingLine: '', vessel: '' });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchContainerCaseFile(containerId);
      setData(result);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [containerId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (!data) return;
    setDetailValues({
      containerNumber: data.container.containerNumber,
      shippingLine: data.container.shippingLine || '',
      vessel: data.container.vessel || '',
    });
  }, [data]);

  const onSaveDetails = async () => {
    if (!data) return;

    const payload: Record<string, string> = {};
    const nextContainerNumber = detailValues.containerNumber.trim();
    if (nextContainerNumber !== data.container.containerNumber) payload.containerNumber = nextContainerNumber;
    const nextShippingLine = detailValues.shippingLine.trim();
    if (nextShippingLine !== (data.container.shippingLine || '')) payload.shippingLine = nextShippingLine;
    const nextVessel = detailValues.vessel.trim();
    if (nextVessel !== (data.container.vessel || '')) payload.vessel = nextVessel;

    if (Object.keys(payload).length === 0) {
      setDetailsEditing(false);
      return;
    }

    setDetailsSaving(true);
    try {
      await updateContainerDetails(containerId, payload);
      setDetailsEditing(false);
      await load();
    } catch (err) {
      Alert.alert('Could not update container details', apiErrorMessage(err));
    } finally {
      setDetailsSaving(false);
    }
  };

  const onRefreshTracking = async () => {
    setTrackingLoading(true);
    try {
      await refreshContainerTracking(containerId);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setTrackingLoading(false);
    }
  };

  // Maersk's result is read by an exact parser and saved straight away. For any
  // other carrier (or if the exact parser can't read the text) the text is read
  // with generic heuristics and shown to the user to confirm before saving.
  const openReview = async (text: string) => {
    setProposal(await previewContainerTracking(containerId, text));
    setReviewError(null);
    setPasteOpen(false);
    setTrackOpen(false);
  };

  const onPasteTracking = async (textOverride?: string) => {
    setPasting(true);
    setPasteError(null);
    const text = textOverride ?? pasteText;
    try {
      if (trackCarrier && trackCarrier.captureMode === 'review') {
        await openReview(text);
        return;
      }
      try {
        const result = await pasteContainerTracking(containerId, text);
        setPasteOpen(false);
        setTrackOpen(false);
        setPasteText('');
        await load();
        if (result.warnings.length > 0) Alert.alert('Saved, but check this', result.warnings.join('\n\n'));
      } catch (err) {
        const code = axios.isAxiosError(err) ? (err.response?.data as { error?: { code?: string } } | undefined)?.error?.code : undefined;
        if (code === 'TRACKING_PARSE_FAILED') await openReview(text);
        else throw err;
      }
    } catch (err) {
      setPasteError(apiErrorMessage(err));
    } finally {
      setPasting(false);
    }
  };

  const onSaveReview = async (value: ReviewedTracking) => {
    setReviewSaving(true);
    setReviewError(null);
    try {
      await saveReviewedTracking(containerId, { carrierName: trackCarrier?.name || container.shippingLine || 'Carrier', ...value });
      setProposal(null);
      setPasteText('');
      await load();
    } catch (err) {
      setReviewError(apiErrorMessage(err));
    } finally {
      setReviewSaving(false);
    }
  };

  const onPickCarrier = async (carrierName: string) => {
    setPickerSaving(true);
    setPickerError(null);
    try {
      await setContainerShippingLine(containerId, carrierName);
      await load();
      setPickerOpen(false);
      setTrackOpen(true);
    } catch (err) {
      setPickerError(apiErrorMessage(err));
    } finally {
      setPickerSaving(false);
    }
  };

  const onScanDocument = (documentType: string) => {
    if (!data) return;
    const importerId = typeof data.container.importerId === 'object' ? data.container.importerId._id : data.container.importerId;
    const blId = data.container.blId?._id;
    navigation.navigate('DocumentScanner', { containerId, importerId: importerId || '', blId, documentType });
  };

  const applyStatusChange = async (newStatus: string) => {
    if (!data) return;
    setStatusUpdating(true);

    if (getIsOnline()) {
      try {
        await changeContainerStatus(containerId, newStatus);
        await load();
      } catch (err) {
        Alert.alert('Could not update status', apiErrorMessage(err));
      } finally {
        setStatusUpdating(false);
      }
      return;
    }

    // Offline: queue the change and update the local view + cache
    // optimistically. This is exactly what makes offline status changes
    // possible — the case file itself isn't cached (only the containers
    // list is), so this screen must already be loaded before going
    // offline for the queued edit to have something to apply on top of.
    enqueueMutation(containerId, 'status_change', { status: newStatus }, data.container.version);
    const updatedContainer = { ...data.container, status: newStatus };
    setData({ ...data, container: updatedContainer });
    upsertSingleContainer(updatedContainer);
    setStatusUpdating(false);
    Alert.alert('Queued Offline', "This status change will sync automatically once you're back online.");
  };

  const onChangeStatus = async () => {
    if (!data) return;
    try {
      const settings = await fetchAgencySettings();
      const options = settings.statusPipeline.filter((s) => s.key !== data.container.status);
      const currentLabel = settings.statusPipeline.find((s) => s.key === data.container.status)?.label || data.container.status;
      Alert.alert(
        'Change Status',
        `Current: ${currentLabel}`,
        [
          ...options.map((s) => ({ text: s.label, onPress: () => applyStatusChange(s.key) })),
          { text: 'Cancel', style: 'cancel' as const },
        ]
      );
    } catch {
      // Offline and can't fetch the agency's custom pipeline — fall back
      // to whatever status the container is already showing, since a
      // stale/guessed pipeline could offer a status the agency doesn't
      // actually use.
      Alert.alert('Cannot load status options', 'Connect to the internet at least once to change status while offline.');
    }
  };

  if (loading && !data) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.orange} />
        </View>
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
        </View>
      </Screen>
    );
  }

  if (!data) return null;
  const { container, documentChecklist, timeline } = data;
  const trackCarrier = findCarrier(container.shippingLine || container.liveTracking?.carrierName);

  return (
    <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.orange} />}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{container.containerNumber}</Text>
        <AttentionBadge level={container.attentionLevel} />
      </View>
      <Text style={styles.status}>{container.status}</Text>

      <Button
        title={statusUpdating ? 'Updating…' : 'Change Status'}
        variant="outline"
        onPress={onChangeStatus}
        loading={statusUpdating}
        style={styles.changeStatusButton}
      />
      <Button
        title={detailsEditing ? 'Cancel Edit' : 'Edit Details'}
        variant="outline"
        onPress={() => setDetailsEditing((value) => !value)}
        style={styles.changeStatusButton}
      />
      {detailsEditing ? (
        <Card style={styles.detailsCard}>
          <Field
            label="Container Number"
            value={detailValues.containerNumber}
            onChangeText={(value) => setDetailValues((current) => ({ ...current, containerNumber: value }))}
            autoCapitalize="characters"
          />
          <Field
            label="Shipping Line"
            value={detailValues.shippingLine}
            onChangeText={(value) => setDetailValues((current) => ({ ...current, shippingLine: value }))}
          />
          <Field
            label="Vessel"
            value={detailValues.vessel}
            onChangeText={(value) => setDetailValues((current) => ({ ...current, vessel: value }))}
          />
          <Button title={detailsSaving ? 'Saving…' : 'Save details'} onPress={onSaveDetails} loading={detailsSaving} />
        </Card>
      ) : null}
      {container.status !== 'Delivered' && container.status !== 'Closed' ? (
        <Button
          title="🚚 Find a Driver"
          variant="secondary"
          onPress={() => navigation.navigate('FindDriver', { containerId })}
          style={styles.findDriverButton}
        />
      ) : null}
      <Button title="📦 Find Storage" variant="outline" onPress={() => navigation.navigate('FindStorage', { containerId })} style={styles.findDriverButton} />
      <Button
        title="🛃 Submit to Customs"
        variant="outline"
        onPress={() =>
          openMoreScreen(navigation, 'CustomsSubmission', {
            prefill: {
              containerNumber: container.containerNumber,
              billOfLadingNumber: (container.blId as { blNumber?: string } | undefined)?.blNumber ?? '',
              shippingAgency: container.shippingLine ?? '',
            },
          })
        }
        style={styles.findDriverButton}
      />
      <Button
        title="📄 Letters"
        variant="outline"
        onPress={() => navigation.navigate('ContainerLetters', { containerId })}
        style={styles.findDriverButton}
      />
      <Button
        title="💰 Finance"
        variant="secondary"
        onPress={() => {
          const importerId = typeof container.importerId === 'object' ? container.importerId._id : container.importerId;
          const importerName = typeof container.importerId === 'object' ? container.importerId.name : undefined;
          navigation.navigate('Finance', { containerId, importerId, importerName });
        }}
        style={styles.findDriverButton}
      />

      {container.numberValidation?.checkDigitValid === false ? (
        <Card style={styles.warningCard}>
          <Text style={styles.warningText}>⚠ {container.numberValidation.issue}</Text>
        </Card>
      ) : null}

      {container.attentionReasons.length > 0 ? (
        <Card style={styles.reasonsCard}>
          {container.attentionReasons.map((r, i) => (
            <Text key={i} style={styles.reasonLine}>
              • {r}
            </Text>
          ))}
        </Card>
      ) : null}

      <SectionCard title="Shipment">
        <Row label="Importer" value={typeof container.importerId === 'object' ? container.importerId.name : '—'} />
        <Row label="B/L Number" value={container.blId?.blNumber || '—'} />
        <Row label="Shipping Line" value={container.shippingLine || '—'} />
        <Row label="Vessel" value={container.vessel || '—'} />
      </SectionCard>

      <SectionCard title="Dates">
        <Row label="Arrival" value={formatDate(container.dates.arrival)} />
        <Row label="DO Received" value={formatDate(container.dates.doReceived)} />
        <Row label="Discharged" value={formatDate(container.dates.discharged)} />
        <Row label="Cleared" value={formatDate(container.dates.cleared)} />
        <Row label="Delivered" value={formatDate(container.dates.delivered)} />
      </SectionCard>

      {container.deadlines.length > 0 ? (
        <SectionCard title="Deadlines">
          {container.deadlines.map((d, i) => (
            <Row
              key={i}
              label={d.ruleName}
              value={`${formatDate(d.dueDate)} — ${d.status}`}
              valueColor={d.status === 'expired' ? colors.urgent : d.status === 'pending' ? colors.attention : colors.normal}
            />
          ))}
        </SectionCard>
      ) : null}

      <SectionCard
        title="Live Tracking"
        action={
          <View style={styles.trackingActions}>
            <Button title="Track" onPress={() => (trackCarrier ? setTrackOpen(true) : setPickerOpen(true))} style={styles.smallButton} />
            <Button
              title={trackingLoading ? '...' : 'Refresh'}
              variant="outline"
              onPress={onRefreshTracking}
              loading={trackingLoading}
              style={styles.smallButton}
            />
          </View>
        }
      >
        {container.liveTracking?.resolved && container.liveTracking.source.startsWith('pasted:') ? (
          <>
            <Row label="Carrier" value={container.liveTracking.carrierName || '—'} />
            <Row label="Latest event" value={container.liveTracking.latestEvent?.description || container.liveTracking.status || '—'} />
            {container.liveTracking.latestEvent?.location ? (
              <Row
                label="Where"
                value={[container.liveTracking.latestEvent.location, container.liveTracking.latestEvent.facility].filter(Boolean).join(' · ')}
              />
            ) : null}
            {container.liveTracking.latestEvent?.at ? <Row label="When" value={formatUtcDateTime(container.liveTracking.latestEvent.at)} /> : null}
            {container.liveTracking.originPlace || container.liveTracking.destinationPlace ? (
              <Row label="Route" value={`${container.liveTracking.originPlace || '—'} → ${container.liveTracking.destinationPlace || '—'}`} />
            ) : null}
            {container.liveTracking.departedAt ? <Row label="Departed" value={formatUtcDate(container.liveTracking.departedAt)} /> : null}
            {container.liveTracking.eta ? <Row label="Arrival" value={formatUtcDate(container.liveTracking.eta)} /> : null}
            {container.liveTracking.eventsCompleted ? <Row label="Events" value={`${container.liveTracking.eventsCompleted} completed from origin`} /> : null}
            <Text style={styles.muted}>
              Recorded from the carrier page by {container.liveTracking.recordedByName || 'staff'}
              {container.liveTracking.recordedAt ? ` on ${formatUtcDateTime(container.liveTracking.recordedAt)} UTC` : ''}
              {container.liveTracking.carrierUpdatedNote ? ` (carrier page said updated ${container.liveTracking.carrierUpdatedNote})` : ''}.
              Not live: paste again to update.
            </Text>
            <View style={styles.trackingActions}>
              <Button title="Paste update" variant="outline" onPress={() => setPasteOpen(true)} style={styles.smallButton} />
              {container.liveTracking.publicTrackingUrl ? (
                <Button
                  title={`Open ${container.liveTracking.carrierName || 'carrier'} site`}
                  variant="outline"
                  onPress={() => Linking.openURL(container.liveTracking!.publicTrackingUrl!)}
                  style={styles.smallButton}
                />
              ) : null}
            </View>
          </>
        ) : container.liveTracking?.resolved ? (
          <>
            <Row label="Carrier" value={container.liveTracking.carrierName || '—'} />
            <Row label="Status" value={container.liveTracking.status || '—'} />
            <Row label="Vessel" value={container.liveTracking.vesselName || '—'} />
            {container.liveTracking.eta ? <Row label="ETA" value={formatDate(container.liveTracking.eta)} /> : null}
            <Button title="Paste from carrier page" variant="outline" onPress={() => setPasteOpen(true)} style={styles.smallButton} />
          </>
        ) : (
          <>
            <Text style={styles.muted}>
              {container.liveTracking?.status || 'Not confirmed yet — showing the identified shipping line above until a live tracking source is configured.'}
            </Text>
            <View style={styles.trackingActions}>
              {container.liveTracking?.publicTrackingUrl ? (
                <Button
                  title={`Check on ${container.liveTracking.carrierName || 'carrier'}'s site`}
                  variant="outline"
                  onPress={() => Linking.openURL(container.liveTracking!.publicTrackingUrl!)}
                  style={styles.smallButton}
                />
              ) : null}
              <Button title="Paste from carrier page" variant="outline" onPress={() => setPasteOpen(true)} style={styles.smallButton} />
            </View>
          </>
        )}
      </SectionCard>

      {trackCarrier ? (
        <CarrierTrackingModal
          visible={trackOpen}
          url={trackCarrier.trackingUrl(container.containerNumber)}
          title={container.containerNumber}
          carrierName={trackCarrier.name}
          captureMode={trackCarrier.captureMode}
          prefillsNumber={trackCarrier.prefillsNumber}
          capturing={pasting}
          captureError={pasteError}
          onChangeCarrier={() => { setTrackOpen(false); setPickerOpen(true); }}
          onClose={() => { setTrackOpen(false); setPasteError(null); }}
          onCapture={(text) => onPasteTracking(text)}
        />
      ) : null}
      <TrackingReviewModal
        visible={proposal !== null}
        carrierName={trackCarrier?.name || container.shippingLine || 'the carrier'}
        proposal={proposal}
        saving={reviewSaving}
        error={reviewError}
        onSave={onSaveReview}
        onCancel={() => setProposal(null)}
      />
      <CarrierPickerModal
        visible={pickerOpen}
        current={trackCarrier?.name}
        saving={pickerSaving}
        error={pickerError}
        onSelect={onPickCarrier}
        onClose={() => { setPickerOpen(false); setPickerError(null); }}
      />

      <Modal visible={pasteOpen} animationType="slide" onRequestClose={() => setPasteOpen(false)}>
        <KeyboardAvoidingView style={styles.pasteModal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.pasteContent}>
            <Text style={styles.title}>Paste carrier tracking</Text>
            <Text style={styles.muted}>
              Open the carrier's tracking page, search this container or its BL, select the whole result and copy it, then paste it here. Maersk's tracking page is supported.
            </Text>
            <Field
              label="Copied tracking text"
              value={pasteText}
              onChangeText={setPasteText}
              multiline
              numberOfLines={12}
              textAlignVertical="top"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.pasteInput}
              placeholder="BL number … container … Departs … Arrives … Latest event …"
            />
            {pasteError ? <Text style={styles.error}>{pasteError}</Text> : null}
            <Button title="Save tracking" onPress={() => onPasteTracking()} loading={pasting} disabled={pasting || pasteText.trim().length < 20} />
            <Button title="Cancel" variant="outline" onPress={() => { setPasteOpen(false); setPasteError(null); }} style={styles.pasteCancel} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <SectionCard title={`Documents (${documentChecklist.filter((d) => d.satisfied).length}/${documentChecklist.length})`}>
        <Text style={styles.docHint}>Tap a missing document to scan and upload it.</Text>
        {documentChecklist.map((doc, i) => (
          <View key={i} style={styles.docRow}>
            <Text style={styles.docCheck}>{doc.satisfied ? '✅' : '⬜'}</Text>
            <Text style={styles.docType}>{doc.type}</Text>
            {!doc.satisfied ? (
              <Button title="Scan" variant="outline" onPress={() => onScanDocument(doc.type)} style={styles.addDocButton} />
            ) : null}
          </View>
        ))}
      </SectionCard>

      <SectionCard title="Activity">
        {timeline.length === 0 ? (
          <Text style={styles.muted}>No activity yet.</Text>
        ) : (
          timeline
            .slice()
            .reverse()
            .map((entry, i) => (
              <View key={i} style={styles.timelineRow}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineDescription}>{entry.description}</Text>
                  <Text style={styles.timelineMeta}>
                    {formatDate(entry.occurredAt)}
                    {entry.performedBy?.name ? ` · ${entry.performedBy.name}` : ''}
                  </Text>
                </View>
              </View>
            ))
        )}
      </SectionCard>
    </Screen>
  );
}

function SectionCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action}
      </View>
      {children}
    </Card>
  );
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { color: colors.urgent },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...typography.h1 },
  status: { ...typography.bodyMedium, color: colors.orange, marginBottom: spacing.md },
  findDriverButton: { marginBottom: spacing.md },
  changeStatusButton: { marginBottom: spacing.sm },
  warningCard: { backgroundColor: colors.attentionBg, marginBottom: spacing.md },
  warningText: { color: colors.attention, fontWeight: '600' },
  reasonsCard: { backgroundColor: colors.urgentBg, marginBottom: spacing.md },
  reasonLine: { color: colors.urgent, marginBottom: 2 },
  detailsCard: { marginBottom: spacing.md },
  section: { marginBottom: spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle: { ...typography.h3 },
  smallButton: { paddingVertical: 6, paddingHorizontal: spacing.md },
  trackingActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  pasteModal: { flex: 1, backgroundColor: colors.background },
  pasteContent: { padding: spacing.lg, gap: spacing.md },
  pasteInput: { minHeight: 220 },
  pasteCancel: { marginTop: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowLabel: { ...typography.caption },
  rowValue: { ...typography.bodyMedium, textAlign: 'right', flexShrink: 1, marginLeft: spacing.md },
  muted: { ...typography.caption, fontStyle: 'italic' },
  docHint: { ...typography.caption, fontStyle: 'italic', marginBottom: spacing.sm },
  docRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  docCheck: { marginRight: spacing.sm, fontSize: 16 },
  docType: { ...typography.body, flex: 1 },
  addDocButton: { paddingVertical: 4, paddingHorizontal: spacing.sm },
  timelineRow: { flexDirection: 'row', marginBottom: spacing.md },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.orange, marginTop: 6, marginRight: spacing.md },
  timelineContent: { flex: 1 },
  timelineDescription: { ...typography.body },
  timelineMeta: { ...typography.caption, marginTop: 2 },
});
