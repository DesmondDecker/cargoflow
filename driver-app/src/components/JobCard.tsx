import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from './Card';
import { StatusChip } from './StatusChip';
import { containerNumberOf, Job } from '../types';
import { formatDate } from '../utils/format';
import { spacing, typography } from '../theme/theme';

export function JobCard({ job, onPress }: { job: Job; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card}>
        <View style={styles.top}>
          <Text style={styles.number}>{containerNumberOf(job)}</Text>
          <StatusChip status={job.status} />
        </View>
        <Text style={styles.route}>{job.pickupLocation} → {job.destination}</Text>
        {job.requiredDate ? <Text style={typography.caption}>Needed by {formatDate(job.requiredDate)}</Text> : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md, gap: spacing.xs },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  number: { ...typography.h3 },
  route: { ...typography.body },
});
