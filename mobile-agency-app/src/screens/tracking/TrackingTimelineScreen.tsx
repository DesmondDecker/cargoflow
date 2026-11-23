import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { StatusPill } from '../../components/StatusPill';
import { ChipRow } from '../../components/ChipRow';
import { RouteMap } from '../../components/RouteMap';
import { fetchContainerCaseFile } from '../../api/containerApi';
import { apiErrorMessage } from '../../api/client';
import { ContainerCaseFile } from '../../types/api';
import { TrackingStackParamList } from '../../navigation/types';
import { openCaseFile } from '../../utils/navigation';
import { STATUS_ORDER, daysFromNow, formatShortDate, formatShortDateTime } from '../../utils/status';
import { colors, spacing, typography } from '../../theme/theme';

type Props = NativeStackScreenProps<TrackingStackParamList, 'TrackingTimeline'>;

interface Step {
  status: string;
  at?: string;
  state: 'done' | 'current' | 'upcoming';
}

// Steps come from the container's real status pipeline and its status
// history: a step is "done" if the container is already past it, "current"
// if it is there now, and shows the time of the most recent change into it.
// Nothing here is inferred or estimated.
function buildSteps(container: ContainerCaseFile['container']): Step[] {
  const currentIndex = STATUS_ORDER.indexOf(container.status as (typeof STATUS_ORDER)[number]);
  return STATUS_ORDER.filter((s) => s !== 'Closed').map((status, index) => {
    const entries = container.statusHistory.filter((h) => h.status === status);
    const at = entries.length ? entries[entries.length - 1].changedAt : undefined;
    const state: Step['state'] = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'upcoming';
    return { status, at, state };
  });
}

export function TrackingTimelineScreen({ route, navigation }: Props) {
  const { containerId, containerNumber } = route.params;
  const [data, setData] = useState<ContainerCaseFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'timeline' | 'map'>('timeline');

  useFocusEffect(
    useCallback(() => {
      fetchContainerCaseFile(containerId).then(setData).catch((err) => setError(apiErrorMessage(err)));
    }, [containerId])
  );

  const steps = useMemo(() => (data ? buildSteps(data.container) : []), [data]);

  if (!data) {
    return <Screen>{error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.orange} style={{ marginTop: spacing.xl }} />}</Screen>;
  }

  const { container } = data;
  const lt = container.liveTracking?.resolved ? container.liveTracking : undefined;
  const pasted = lt?.source.startsWith('pasted:');
  const days = daysFromNow(lt?.eta);

  return (
    <Screen>
      <View style={styles.stack}>
        <View style={styles.top}>
          <Text style={typography.h1}>{containerNumber || container.containerNumber}</Text>
          <StatusPill status={container.status} />
        </View>
        <Text style={typography.caption}>{[container.shippingLine, container.blId?.vesselName || lt?.vesselName].filter(Boolean).join(' · ')}</Text>

        <ChipRow options={[{ key: 'timeline', label: 'Timeline' }, { key: 'map', label: 'Map' }]} value={view} onChange={setView} />

        {view === 'map' ? (
          <RouteMap origin={lt?.originPlace || container.blId?.portOfLoading} destination={lt?.destinationPlace || container.blId?.portOfDischarge} />
        ) : (
        <>
        <Card style={styles.stack}>
          <Text style={typography.h3}>Carrier tracking</Text>
          {lt ? (
            <>
              {lt.latestEvent ? <Text style={typography.bodyMedium}>{lt.latestEvent.description}</Text> : lt.status ? <Text style={typography.bodyMedium}>{lt.status}</Text> : null}
              {lt.latestEvent?.location ? <Text style={typography.caption}>{[lt.latestEvent.location, lt.latestEvent.facility].filter(Boolean).join(' · ')}{lt.latestEvent.at ? ` · ${formatShortDateTime(lt.latestEvent.at)}` : ''}</Text> : null}
              {lt.originPlace || lt.destinationPlace ? <Text style={typography.caption}>{lt.originPlace || '—'} → {lt.destinationPlace || '—'}</Text> : null}
              {lt.departedAt ? <Text style={typography.caption}>Departed {formatShortDate(lt.departedAt)}</Text> : null}
              {lt.eta ? <Text style={typography.caption}>ETA {formatShortDate(lt.eta)}{days !== null ? ` (${days === 0 ? 'today' : days > 0 ? `in ${days} day${days === 1 ? '' : 's'}` : `${-days} day${days === -1 ? '' : 's'} ago`})` : ''}</Text> : null}
              <Text style={styles.note}>
                {pasted
                  ? `Recorded from the carrier page${lt.recordedByName ? ` by ${lt.recordedByName}` : ''}${lt.recordedAt ? ` on ${formatShortDateTime(lt.recordedAt)}` : ''}. Not live.`
                  : `Source: ${lt.source}`}
              </Text>
            </>
          ) : (
            <Text style={typography.caption}>No carrier tracking saved yet. Open the case file and tap Track to look it up and capture it.</Text>
          )}
        </Card>

        <Card>
          <Text style={[typography.h3, { marginBottom: spacing.md }]}>Progress</Text>
          {steps.map((step, i) => (
            <View key={step.status} style={styles.stepRow}>
              <View style={styles.rail}>
                <View style={[styles.dot, step.state === 'done' && styles.dotDone, step.state === 'current' && styles.dotCurrent]} />
                {i < steps.length - 1 ? <View style={[styles.line, step.state === 'done' && styles.lineDone]} /> : null}
              </View>
              <View style={styles.stepText}>
                <Text style={[typography.bodyMedium, step.state === 'upcoming' && { color: colors.textMuted }]}>{step.status}</Text>
                <Text style={typography.caption}>{step.at ? formatShortDateTime(step.at) : step.state === 'upcoming' ? 'Pending' : step.state === 'current' ? 'Now' : 'Passed'}</Text>
              </View>
            </View>
          ))}
        </Card>

        </>
        )}

        <Button
          title="Open case file"
          onPress={() => openCaseFile(navigation, containerId, container.containerNumber)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  error: { color: colors.urgent },
  note: { ...typography.caption, color: colors.textMuted },
  stepRow: { flexDirection: 'row', minHeight: 54 },
  rail: { width: 26, alignItems: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.white, marginTop: 3 },
  dotDone: { backgroundColor: colors.info, borderColor: colors.info },
  dotCurrent: { backgroundColor: colors.orange, borderColor: colors.orange },
  line: { flex: 1, width: 2, backgroundColor: colors.border },
  lineDone: { backgroundColor: colors.info },
  stepText: { flex: 1, paddingBottom: spacing.md, paddingLeft: spacing.sm },
});
