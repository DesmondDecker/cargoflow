import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { colors, spacing, typography } from '../../theme/theme';
import { fetchDocuments } from '../../api/documentApi';
import { apiErrorMessage } from '../../api/client';
import { CargoDocument } from '../../types/api';

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const DOC_ICONS: Record<string, string> = {
  'Bill of Lading': '📜',
  'Delivery Order': '📋',
  CTN: '🪪',
  'Commercial Invoice': '🧾',
  'Packing List': '📦',
  Receipt: '🧾',
  'Release Document': '📄',
  ID: '🪪',
  Correspondence: '✉️',
};

export function DocumentsListScreen() {
  const [documents, setDocuments] = useState<CargoDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchDocuments();
      setDocuments(result);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Documents</Text>
        <Text style={styles.headerSubtitle}>Every document uploaded across your containers.</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={documents}
        keyExtractor={(d) => d._id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.orange} />}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>No documents yet — add one from a container's case file.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.icon}>{DOC_ICONS[item.documentType] || '📄'}</Text>
              <View style={styles.textWrap}>
                <Text style={styles.type}>{item.documentType}</Text>
                <Text style={styles.meta}>
                  Version {item.currentVersion} · Added {formatDate(item.createdAt)}
                </Text>
              </View>
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  headerTitle: { ...typography.h1 },
  headerSubtitle: { ...typography.body, color: colors.textSecondary, marginTop: 4 },
  error: { color: colors.urgent, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  listContent: { padding: spacing.lg, paddingTop: 0, gap: spacing.md },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xxl },
  card: { marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: { fontSize: 26, marginRight: spacing.md },
  textWrap: { flex: 1 },
  type: { ...typography.bodyMedium, fontSize: 16 },
  meta: { ...typography.caption, marginTop: 2 },
});
