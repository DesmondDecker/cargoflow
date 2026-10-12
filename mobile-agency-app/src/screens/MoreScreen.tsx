import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { colors, spacing, typography } from '../theme/theme';
import { useAuthStore } from '../store/authStore';
import { MoreStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreHome'>;

const MENU_ITEMS: { icon: string; label: string; description: string; to: keyof MoreStackParamList }[] = [
  { icon: '🏢', label: 'Importers', description: "Your clients' complete history", to: 'Importers' },
  { icon: '⏱️', label: 'Grace Periods', description: 'Per-carrier free storage & demurrage terms', to: 'DemurrageTerms' },
  { icon: '🏷️', label: 'Customize Labels', description: 'Relabel statuses & document types for your staff', to: 'EditLabels' },
  { icon: '📖', label: 'Guides & Help', description: 'How to use CargoFlow', to: 'Guides' },
];

export function MoreScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const agency = useAuthStore((s) => s.agency);
  const logout = useAuthStore((s) => s.logout);

  const confirmLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <Screen>
      <Text style={styles.title}>More</Text>

      {MENU_ITEMS.map((item) => (
        <Pressable key={item.to} onPress={() => navigation.navigate(item.to as never)}>
          <Card style={styles.menuCard}>
            <View style={styles.menuRow}>
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <View style={styles.menuText}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuDescription}>{item.description}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </View>
          </Card>
        </Pressable>
      ))}

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Your Account</Text>
        <Row label="Name" value={user?.name || '—'} />
        <Row label="Role" value={user?.role || '—'} />
        {user?.phone ? <Row label="Phone" value={user.phone} /> : null}
      </Card>

      <Pressable onPress={() => navigation.navigate('EditAgencyProfile')}>
        <Card style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Agency</Text>
            <Text style={styles.editLink}>Edit</Text>
          </View>
          <Row label="Name" value={agency?.name || '—'} />
          <Row label="Agency Code" value={agency?.agencyCode || '—'} />
        </Card>
      </Pressable>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Coming to this app next</Text>
        <Text style={styles.comingSoon}>Camera-based document scanning (crop, multi-page)</Text>
        <Text style={styles.comingSoon}>QR / barcode scanner</Text>
        <Text style={styles.comingSoon}>Reports & export</Text>
        <Text style={styles.comingSoon}>Offline mode (SQLite sync)</Text>
      </Card>

      <Button title="Log Out" variant="danger" onPress={confirmLogout} style={styles.logout} />
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, marginBottom: spacing.lg },
  menuCard: { marginBottom: spacing.md },
  menuRow: { flexDirection: 'row', alignItems: 'center' },
  menuIcon: { fontSize: 24, marginRight: spacing.md },
  menuText: { flex: 1 },
  menuLabel: { ...typography.bodyMedium, fontSize: 16 },
  menuDescription: { ...typography.caption, marginTop: 2 },
  chevron: { fontSize: 22, color: colors.textMuted },
  section: { marginBottom: spacing.md },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  editLink: { ...typography.caption, color: colors.orange, fontWeight: '600' },
  sectionTitle: { ...typography.h3, marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowLabel: { ...typography.caption },
  rowValue: { ...typography.bodyMedium },
  comingSoon: { ...typography.body, color: colors.textSecondary, marginBottom: 4 },
  logout: { marginTop: spacing.lg },
});
