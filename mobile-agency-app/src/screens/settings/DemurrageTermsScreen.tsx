import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { colors, spacing, typography } from '../../theme/theme';
import { fetchDemurrageTerms, deleteDemurrageTerm, DemurrageTerm } from '../../api/agencyApi';
import { apiErrorMessage } from '../../api/client';
import { MoreStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MoreStackParamList, 'DemurrageTerms'>;

// Agency-entered free-time / demurrage-grace overrides, per shipping line.
// Deliberately no cost fields anywhere on this screen — see
// AgencyDemurrageTerm's backend comment for why a $/day figure isn't
// something this app can source or verify. A carrier with no entry here
// just uses the app-wide default shown at the top, unchanged.
export function DemurrageTermsScreen({ navigation }: Props) {
  const [terms, setTerms] = useState<DemurrageTerm[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('AddDemurrageTerm', {})} hitSlop={12} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>+ Add</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchDemurrageTerms();
      setTerms(result);
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

  const confirmDelete = (term: DemurrageTerm) => {
    Alert.alert(
      'Remove Term',
      `Remove the entered terms for ${term.shippingLine}? Containers on this carrier will fall back to the app-wide default (4 free days, 7-day grace).`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDemurrageTerm(term._id);
              load();
            } catch (err) {
              Alert.alert('Could not remove', apiErrorMessage(err));
            }
          },
        },
      ]
    );
  };

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.intro}>
        <Text style={styles.introText}>
          Each carrier gets a default of 4 free storage days and a 7-day demurrage grace period unless you enter their
          actual terms below. No cost figures — CargoFlow doesn&apos;t have a verified source for per-day demurrage
          rates, so this only tracks the dates.
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && terms.length === 0 ? (
        <Text style={styles.empty}>No carrier-specific terms entered yet. Every container uses the default above.</Text>
      ) : null}

      <View style={styles.list}>
        {terms.map((term) => (
          <Pressable key={term._id} onPress={() => navigation.navigate('AddDemurrageTerm', { existing: term })}>
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.line}>{term.shippingLine}</Text>
                <Pressable onPress={() => confirmDelete(term)} hitSlop={10}>
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Free storage days</Text>
                <Text style={styles.rowValue}>{term.freeStorageDays ?? '— (default)'}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Demurrage grace days</Text>
                <Text style={styles.rowValue}>{term.demurrageGraceDays ?? '— (default)'}</Text>
              </View>
              {term.notes ? <Text style={styles.notes}>{term.notes}</Text> : null}
            </Card>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerButton: { paddingHorizontal: spacing.sm },
  headerButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  intro: { padding: spacing.lg, paddingBottom: spacing.sm },
  introText: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },
  error: { color: colors.urgent, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xxl, paddingHorizontal: spacing.lg },
  list: { padding: spacing.lg, paddingTop: 0, gap: spacing.md },
  card: { marginBottom: spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  line: { ...typography.h3 },
  remove: { ...typography.caption, color: colors.urgent, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowLabel: { ...typography.caption },
  rowValue: { ...typography.bodyMedium },
  notes: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
});
