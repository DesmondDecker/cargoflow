import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { colors, spacing, typography } from '../../theme/theme';
import { fetchImporters } from '../../api/reportsApi';
import { apiErrorMessage } from '../../api/client';
import { Importer } from '../../types/api';
import { ImportersStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ImportersStackParamList, 'ImportersList'>;

export function ImportersListScreen({ navigation }: Props) {
  const [importers, setImporters] = useState<Importer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchImporters({ search: query || undefined });
      setImporters(result.importers);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(search);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.header}>
        <TextInput
          style={styles.search}
          placeholder="Search importers..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => load(search)}
          returnKeyType="search"
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={importers}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(search)} tintColor={colors.orange} />}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No importers yet.</Text> : null}
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate('ImporterProfile', { importerId: item._id, importerName: item.name })}>
            <Card style={styles.card}>
              <Text style={styles.name}>{item.name}</Text>
              {item.contactPerson ? <Text style={styles.meta}>{item.contactPerson}</Text> : null}
              {item.phone ? <Text style={styles.meta}>{item.phone}</Text> : null}
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg, paddingBottom: spacing.sm, backgroundColor: colors.background },
  search: {
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  error: { color: colors.urgent, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  listContent: { padding: spacing.lg, paddingTop: 0, gap: spacing.md },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xxl },
  card: { marginBottom: spacing.md },
  name: { ...typography.h3 },
  meta: { ...typography.caption, marginTop: 2 },
});
