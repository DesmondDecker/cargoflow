import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { AttentionBadge } from '../../components/AttentionBadge';
import { Button } from '../../components/Button';
import { colors, spacing, typography } from '../../theme/theme';
import { fetchContainerCaseFile, refreshContainerTracking, changeContainerStatus } from '../../api/containerApi';
import { fetchAgencySettings } from '../../api/agencyApi';
import { apiErrorMessage } from '../../api/client';
import { ContainerCaseFile } from '../../types/api';
import { ContainersStackParamList, DashboardStackParamList } from '../../navigation/types';
import { enqueueMutation } from '../../offline/mutationQueue';
import { upsertSingleContainer } from '../../offline/containerCache';
import { getIsOnline } from '../../offline/syncEngine';

type Props = NativeStackScreenProps<ContainersStackParamList | DashboardStackParamList, 'ContainerCaseFile'>;

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
      const options = settings.statusPipeline.filter((s) => s !== data.container.status);
      Alert.alert(
        'Change Status',
        `Current: ${data.container.status}`,
        [...options.map((status) => ({ text: status, onPress: () => applyStatusChange(status) })), { text: 'Cancel', style: 'cancel' as const }]
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
      <Button title="🚚 Find a Driver" variant="secondary" onPress={() => navigation.navigate('FindDriver', { containerId })} style={styles.findDriverButton} />

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
          <Button
            title={trackingLoading ? '...' : 'Refresh'}
            variant="outline"
            onPress={onRefreshTracking}
            loading={trackingLoading}
            style={styles.smallButton}
          />
        }
      >
        {container.liveTracking?.resolved ? (
          <>
            <Row label="Carrier" value={container.liveTracking.carrierName || '—'} />
            <Row label="Status" value={container.liveTracking.status || '—'} />
            <Row label="Vessel" value={container.liveTracking.vesselName || '—'} />
            {container.liveTracking.eta ? <Row label="ETA" value={formatDate(container.liveTracking.eta)} /> : null}
          </>
        ) : (
          <Text style={styles.muted}>
            Not confirmed yet — showing the identified shipping line above until a live tracking source is configured.
          </Text>
        )}
      </SectionCard>

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
  section: { marginBottom: spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle: { ...typography.h3 },
  smallButton: { paddingVertical: 6, paddingHorizontal: spacing.md },
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
