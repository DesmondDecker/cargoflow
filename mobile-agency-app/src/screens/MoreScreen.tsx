import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { colors, radius, spacing, typography } from '../theme/theme';
import { useAuthStore } from '../store/authStore';
import { MoreStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreHome'>;

type IconName = keyof typeof Ionicons.glyphMap;

const ITEMS: { icon: IconName; label: string; to: keyof MoreStackParamList; ownerAdminOnly?: boolean }[] = [
  { icon: 'document-text-outline', label: 'Documents', to: 'Documents' },
  { icon: 'shield-checkmark-outline', label: 'Customs Verification', to: 'CustomsSubmissions' },
  { icon: 'cube-outline', label: 'Storage Bookings', to: 'StorageBookings' },
  { icon: 'bar-chart-outline', label: 'Reports & Export', to: 'Reports' },
  { icon: 'business-outline', label: 'Importers', to: 'Importers' },
  { icon: 'id-card-outline', label: 'Agency Details', to: 'EditAgencyProfile' },
  { icon: 'people-outline', label: 'Users & Permissions', to: 'Team', ownerAdminOnly: true },
  { icon: 'timer-outline', label: 'Grace Periods', to: 'DemurrageTerms' },
  { icon: 'options-outline', label: 'Rules & Deadlines', to: 'Rules', ownerAdminOnly: true },
  { icon: 'pricetags-outline', label: 'Customize Labels', to: 'EditLabels' },
  { icon: 'notifications-outline', label: 'Notifications', to: 'Notifications' },
  { icon: 'settings-outline', label: 'App Preferences', to: 'AppPreferences' },
  { icon: 'help-circle-outline', label: 'Help & Support', to: 'Guides' },
];

function initials(name?: string): string {
  return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

export function MoreScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const agency = useAuthStore((s) => s.agency);
  const logout = useAuthStore((s) => s.logout);
  const items = ITEMS.filter((i) => !i.ownerAdminOnly || user?.role === 'owner' || user?.role === 'admin');

  const confirmLogout = () =>
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => logout() },
    ]);

  return (
    <Screen>
      <View style={styles.profile}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials(agency?.name)}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={typography.h2}>{agency?.name || 'Your agency'}</Text>
          <Text style={typography.caption}>{user?.name}{user?.role ? ` · ${user.role}` : ''}{agency?.agencyCode ? ` · Code ${agency.agencyCode}` : ''}</Text>
        </View>
      </View>

      <Card style={styles.list}>
        {items.map((item, i) => (
          <Pressable key={item.to} onPress={() => navigation.navigate(item.to as never)} style={[styles.row, i < items.length - 1 && styles.rowBorder]}>
            <Ionicons name={item.icon} size={22} color={colors.navy} />
            <Text style={styles.label}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}
        <Pressable onPress={confirmLogout} style={[styles.row, styles.rowTop]}>
          <Ionicons name="log-out-outline" size={22} color={colors.urgent} />
          <Text style={[styles.label, { color: colors.urgent }]}>Log out</Text>
        </Pressable>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  avatar: { width: 56, height: 56, borderRadius: radius.pill, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontSize: 20, fontWeight: '700' },
  list: { padding: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg, paddingHorizontal: spacing.lg },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowTop: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  label: { flex: 1, ...typography.bodyMedium },
});
