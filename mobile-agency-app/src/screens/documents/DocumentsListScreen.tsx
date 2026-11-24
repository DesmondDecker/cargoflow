import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { ChipRow } from '../../components/ChipRow';
import { SearchBar } from '../../components/SearchBar';
import { colors, radius, spacing, typography } from '../../theme/theme';
import { formatShortDateTime } from '../../utils/status';
import { deleteDocument, fetchDocuments, reviewDocument } from '../../api/documentApi';
import { apiErrorMessage } from '../../api/client';
import { CargoDocument } from '../../types/api';
import { confirmDestructiveAction } from '../../utils/confirmDestructiveAction';

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

type DocFilter = 'all' | 'review' | 'bl' | 'invoices' | 'others';
const DOC_FILTERS: { key: DocFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'review', label: 'Needs review' },
  { key: 'bl', label: 'BL' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'others', label: 'Others' },
];
const isBl = (t: string) => /bill of lading|^bl$/i.test(t);
const isInvoice = (t: string) => /invoice|receipt/i.test(t);

export function DocumentsListScreen() {
  const [docFilter, setDocFilter] = useState<DocFilter>('all');
  const [query, setQuery] = useState('');
  const [documents, setDocuments] = useState<CargoDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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

  // Tapping a document: open the file, or mark it checked (or ask for another
  // look). Who checked it and when is recorded on the server.
  const onDocumentPress = (doc: CargoDocument) => {
    const latest = doc.versions.find((v) => v.versionNumber === doc.currentVersion) ?? doc.versions[doc.versions.length - 1];
    const url = latest?.downloadUrl || latest?.fileUrl;
    const verified = doc.reviewStatus === 'verified';
    Alert.alert(doc.documentType, verified ? `Verified by ${doc.reviewedByName}.` : 'Not checked yet. Open the file, compare it with the paperwork, then mark it verified.', [
      ...(url ? [{ text: 'Open file', onPress: () => Linking.openURL(url) }] : []),
      {
        text: verified ? 'Needs review again' : 'Mark verified',
        onPress: async () => {
          try {
            await reviewDocument(doc._id, verified ? 'pending_review' : 'verified');
            await load();
          } catch (err) {
            Alert.alert('Could not update', apiErrorMessage(err));
          }
        },
      },
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const onDeleteDocument = async (doc: CargoDocument) => {
    const confirmed = await confirmDestructiveAction(
      'Delete document?',
      `${doc.documentType} will be removed from the active document list. It can be recovered by your system administrator if needed.`,
    );
    if (!confirmed) return;

    setDeletingId(doc._id);
    setError(null);
    try {
      await deleteDocument(doc._id);
      setDocuments((current) => current.filter((item) => item._id !== doc._id));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents.filter((d) => {
      const typeOk = docFilter === 'all' || (docFilter === 'review' ? (d.reviewStatus ?? 'pending_review') !== 'verified' : docFilter === 'bl' ? isBl(d.documentType) : docFilter === 'invoices' ? isInvoice(d.documentType) : !isBl(d.documentType) && !isInvoice(d.documentType));
      return typeOk && (!q || d.documentType.toLowerCase().includes(q));
    });
  }, [documents, docFilter, query]);

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Documents</Text>
        <Text style={styles.headerSubtitle}>Every document uploaded across your containers.</Text>
        <View style={{ gap: spacing.md, marginTop: spacing.md }}>
          <SearchBar value={query} onChangeText={setQuery} placeholder="Search documents…" />
          <ChipRow options={DOC_FILTERS} value={docFilter} onChange={setDocFilter} />
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={visible}
        keyExtractor={(d) => d._id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.orange} />}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>No documents yet — add one from a container's case file.</Text>
          ) : undefined
        }
        renderItem={({ item }) => {
          const verified = item.reviewStatus === 'verified';
          return (
            <Card style={styles.card}>
              <View style={styles.row}>
                <Pressable
                  onPress={() => onDocumentPress(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${item.documentType} details`}
                  style={styles.documentDetails}
                >
                  <Text style={styles.icon}>{DOC_ICONS[item.documentType] || '📄'}</Text>
                  <View style={styles.textWrap}>
                    <Text style={styles.type}>{item.documentType}</Text>
                    <Text style={styles.meta}>
                      Version {item.currentVersion} · Added {formatDate(item.createdAt)}
                    </Text>
                    {verified ? <Text style={styles.metaVerified}>Checked by {item.reviewedByName} · {formatShortDateTime(item.reviewedAt)}</Text> : null}
                  </View>
                </Pressable>
                <View style={styles.trailingActions}>
                  <View style={[styles.badge, verified ? styles.badgeVerified : styles.badgeReview]}>
                    <Text style={[styles.badgeText, verified ? styles.badgeTextVerified : styles.badgeTextReview]}>{verified ? 'Verified' : 'Needs review'}</Text>
                  </View>
                  <Pressable
                    onPress={() => onDeleteDocument(item)}
                    disabled={deletingId === item._id}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${item.documentType}`}
                    style={styles.deleteButton}
                  >
                    <Text style={styles.deleteText}>{deletingId === item._id ? 'Deleting…' : 'Delete'}</Text>
                  </Pressable>
                </View>
              </View>
            </Card>
          );
        }}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  documentDetails: { flexDirection: 'row', alignItems: 'center', flex: 1, minHeight: 48 },
  icon: { fontSize: 26, marginRight: spacing.md },
  textWrap: { flex: 1 },
  trailingActions: { alignItems: 'flex-end', gap: spacing.xs },
  deleteButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.sm },
  deleteText: { ...typography.caption, color: colors.urgent, fontWeight: '700' },
  type: { ...typography.bodyMedium, fontSize: 16 },
  meta: { ...typography.caption, marginTop: 2 },
  metaVerified: { ...typography.caption, color: colors.normal, marginTop: 2 },
  badge: { borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: spacing.md },
  badgeVerified: { backgroundColor: colors.normalBg },
  badgeReview: { backgroundColor: colors.attentionBg },
  badgeText: { fontSize: 12, fontWeight: '700' },
  badgeTextVerified: { color: colors.normal },
  badgeTextReview: { color: colors.attention },
});
