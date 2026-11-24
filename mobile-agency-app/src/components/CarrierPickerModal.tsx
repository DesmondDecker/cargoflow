import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from './Button';
import { Field } from './Field';
import { CARRIERS } from '../constants/carriers';
import { colors, spacing, typography } from '../theme/theme';

interface Props {
  visible: boolean;
  current?: string;
  saving?: boolean;
  error?: string | null;
  onSelect: (carrierName: string) => void;
  onClose: () => void;
}

export function CarrierPickerModal({ visible, current, saving, error, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');
  const carriers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? CARRIERS.filter((c) => c.name.toLowerCase().includes(q)) : CARRIERS;
  }, [query]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Select carrier</Text>
          <Button title="Close" variant="outline" onPress={onClose} style={styles.closeButton} />
        </View>
        <Text style={styles.hint}>The carrier you pick is saved as this container's shipping line, and its tracking page opens.</Text>
        <View style={styles.search}>
          <Field label="Search" value={query} onChangeText={setQuery} placeholder="e.g. MSC" autoCapitalize="none" autoCorrect={false} />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <FlatList
          data={carriers}
          keyExtractor={(c) => c.name}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable style={styles.row} disabled={saving} onPress={() => onSelect(item.name)}>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowMeta}>
                {item.name === current ? 'Current · ' : ''}
                {item.captureMode === 'auto' ? 'Auto capture' : 'Capture with review'}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.hint}>No carrier matches that search.</Text>}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
  title: { ...typography.h2 },
  closeButton: { paddingVertical: 6, paddingHorizontal: spacing.md },
  hint: { ...typography.caption, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  search: { paddingHorizontal: spacing.lg },
  error: { color: colors.urgent, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  row: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.surface },
  rowName: { ...typography.bodyMedium },
  rowMeta: { ...typography.caption },
});
