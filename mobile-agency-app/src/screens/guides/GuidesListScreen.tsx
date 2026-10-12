import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { colors, spacing, typography } from '../../theme/theme';
import { GUIDES } from '../../data/guides';
import { GuidesStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<GuidesStackParamList, 'GuidesList'>;

export function GuidesListScreen({ navigation }: Props) {
  return (
    <Screen scroll={false} padded={false}>
      <FlatList
        data={GUIDES}
        keyExtractor={(g) => g.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate('GuideDetail', { guideId: item.id, title: item.title })}>
            <Card style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.icon}>{item.icon}</Text>
                <View style={styles.textWrap}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.summary}>{item.summary}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md },
  card: { marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: { fontSize: 28, marginRight: spacing.md },
  textWrap: { flex: 1 },
  title: { ...typography.bodyMedium, fontSize: 16 },
  summary: { ...typography.caption, marginTop: 2 },
  chevron: { fontSize: 22, color: colors.textMuted },
});
