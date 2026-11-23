import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { statusTone } from '../utils/status';
import { radius, spacing } from '../theme/theme';

export function StatusPill({ status }: { status: string }) {
  const { fg, bg } = statusTone(status);
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]} numberOfLines={1}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: spacing.md },
  text: { fontSize: 12, fontWeight: '700' },
});
