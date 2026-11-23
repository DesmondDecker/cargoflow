import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { JobStatus } from '../types';
import { STATUS_LABEL, statusColors } from '../utils/format';
import { radius, spacing } from '../theme/theme';

export function StatusChip({ status }: { status: JobStatus }) {
  const { fg, bg } = statusColors(status);
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: spacing.md },
  text: { fontSize: 12, fontWeight: '700' },
});
