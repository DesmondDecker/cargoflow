import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { attentionColor, radius, spacing } from '../theme/theme';
import { AttentionLevel } from '../types/api';

const LABELS: Record<AttentionLevel, string> = {
  urgent: 'Urgent',
  attention: 'Attention',
  normal: 'Normal',
};

export function AttentionBadge({ level }: { level: AttentionLevel }) {
  const { fg, bg } = attentionColor(level);
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <View style={[styles.dot, { backgroundColor: fg }]} />
      <Text style={[styles.text, { color: fg }]}>{LABELS[level]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  text: { fontSize: 12, fontWeight: '700' },
});
