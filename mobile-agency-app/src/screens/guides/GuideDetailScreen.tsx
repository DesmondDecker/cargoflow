import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { colors, spacing, typography } from '../../theme/theme';
import { GUIDES } from '../../data/guides';
import { GuidesStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<GuidesStackParamList, 'GuideDetail'>;

export function GuideDetailScreen({ route }: Props) {
  const guide = GUIDES.find((g) => g.id === route.params.guideId);
  if (!guide) return null;

  return (
    <Screen>
      <Text style={styles.icon}>{guide.icon}</Text>
      <Text style={styles.title}>{guide.title}</Text>
      <Text style={styles.summary}>{guide.summary}</Text>

      {guide.steps.map((step, i) => (
        <Card key={i} style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{i + 1}</Text>
            </View>
            <Text style={styles.stepTitle}>{step.title}</Text>
          </View>
          <Text style={styles.stepDescription}>{step.description}</Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  icon: { fontSize: 40, marginBottom: spacing.sm },
  title: { ...typography.h1, marginBottom: spacing.xs },
  summary: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl },
  stepCard: { marginBottom: spacing.md },
  stepHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  stepNumberText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  stepTitle: { ...typography.bodyMedium, fontSize: 16, flex: 1 },
  stepDescription: { ...typography.body, color: colors.textSecondary, lineHeight: 21 },
});
