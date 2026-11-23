import React, { useCallback, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { fetchTeam, resetTeamMemberPin, TeamMember, updateTeamMember } from '../../api/authApi';
import { apiErrorMessage } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { MoreStackParamList } from '../../navigation/types';
import { formatShortDateTime } from '../../utils/status';
import { colors, radius, spacing, typography } from '../../theme/theme';

type Props = NativeStackScreenProps<MoreStackParamList, 'Team'>;

const ROLE_TEXT: Record<TeamMember['role'], string> = {
  owner: 'Owner: everything, including roles',
  admin: 'Admin: manages staff access and the agency password',
  staff: 'Staff: day-to-day work',
};

export function TeamScreen({ navigation }: Props) {
  const myRole = useAuthStore((s) => s.user?.role);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [you, setYou] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetchTeam();
      setTeam(r.users);
      setYou(r.you);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const apply = async (member: TeamMember, change: { role?: TeamMember['role']; isActive?: boolean }) => {
    try {
      await updateTeamMember(member.id, change);
      await load();
    } catch (err) {
      Alert.alert('Could not change this', apiErrorMessage(err));
    }
  };

  const askNewPin = (member: TeamMember) => {
    const send = async (pin: string) => {
      if (!/^\d{6}$/.test(pin)) return Alert.alert('PIN not changed', 'The PIN must be exactly 6 digits.');
      try {
        const msg = await resetTeamMemberPin(member.id, pin);
        Alert.alert('PIN reset', msg);
      } catch (err) {
        Alert.alert('Could not reset PIN', apiErrorMessage(err));
      }
    };
    if (Platform.OS === 'ios') {
      Alert.prompt(`New PIN for ${member.name}`, '6 digits. Tell them in person; they can change it afterwards.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Set PIN', onPress: (v?: string) => send(v ?? '') }], 'secure-text', '', 'number-pad');
    } else {
      navigation.navigate('ResetPin', { userId: member.id, name: member.name });
    }
  };

  const open = (member: TeamMember) => {
    if (member.id === you) {
      Alert.alert('This is you', 'You cannot change your own role or access. Ask another owner or admin.');
      return;
    }
    const options: { label: string; run: () => void; destructive?: boolean }[] = [];
    if (myRole === 'owner') {
      (['owner', 'admin', 'staff'] as const).filter((r) => r !== member.role).forEach((r) => options.push({ label: `Make ${r}`, run: () => apply(member, { role: r }) }));
    }
    if (myRole === 'owner' || (myRole === 'admin' && member.role === 'staff')) {
      options.push({ label: 'Reset PIN', run: () => askNewPin(member) });
    }
    options.push(
      member.isActive
        ? { label: 'Switch off access', destructive: true, run: () => Alert.alert('Switch off access?', `${member.name} is signed out now and cannot sign in until you switch them back on.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Switch off', style: 'destructive', onPress: () => apply(member, { isActive: false }) }]) }
        : { label: 'Switch access back on', run: () => apply(member, { isActive: true }) }
    );
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: member.name, options: [...options.map((o) => o.label), 'Cancel'], cancelButtonIndex: options.length, destructiveButtonIndex: options.findIndex((o) => o.destructive) },
        (i) => options[i]?.run()
      );
    } else {
      Alert.alert(member.name, ROLE_TEXT[member.role], [...options.map((o) => ({ text: o.label, onPress: o.run, style: o.destructive ? ('destructive' as const) : ('default' as const) })), { text: 'Cancel', style: 'cancel' as const }]);
    }
  };

  return (
    <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.orange} />}>
      <View style={styles.stack}>
        <Text style={typography.h1}>Users & Permissions</Text>
        <Text style={typography.caption}>Everyone who can sign in to this agency. Staff join with the agency password, then log in with their own PIN. Tap a person to change their role, reset their PIN or switch off their access.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {team.map((m) => (
          <Pressable key={m.id} onPress={() => open(m)}>
            <Card style={[styles.row, !m.isActive && styles.off]}>
              <View style={{ flex: 1 }}>
                <Text style={typography.bodyMedium}>{m.name}{m.id === you ? ' (you)' : ''}</Text>
                <Text style={typography.caption}>{m.isActive ? `Last signed in ${m.lastLoginAt ? formatShortDateTime(m.lastLoginAt) : 'never'}` : 'Access switched off'}</Text>
              </View>
              <View style={styles.pill}><Text style={styles.pillText}>{m.role}</Text></View>
            </Card>
          </Pressable>
        ))}
        <Card style={styles.stack}>
          <Text style={typography.bodyMedium}>Agency password</Text>
          <Text style={typography.caption}>New staff need this password to join. It is not used to log in, so changing it does not sign anyone out.</Text>
          <Button title="Change agency password" variant="outline" onPress={() => navigation.navigate('ChangeAgencyPassword')} />
          <Button title="Change my PIN" variant="outline" onPress={() => navigation.navigate('ChangeMyPin')} />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  off: { opacity: 0.55 },
  pill: { borderRadius: radius.pill, backgroundColor: colors.infoBg, paddingVertical: 3, paddingHorizontal: spacing.md },
  pillText: { color: colors.info, fontWeight: '700', fontSize: 12, textTransform: 'capitalize' },
  error: { color: colors.urgent },
});
