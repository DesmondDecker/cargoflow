import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { Logo } from '../components/Logo';
import { colors, spacing, typography } from '../theme/theme';
import { useAuthStore } from '../store/authStore';

/**
 * Shown when the backend rejects a request with SUBSCRIPTION_INACTIVE — a
 * platform admin has deactivated this agency's subscription. Blocks the
 * whole app rather than letting individual screens fail confusingly one at
 * a time.
 */
export function SubscriptionInactiveScreen() {
  const dismiss = useAuthStore((s) => s.dismissSubscriptionInactive);
  const logout = useAuthStore((s) => s.logout);
  const agency = useAuthStore((s) => s.agency);

  return (
    <Screen scroll={false}>
      <View style={styles.content}>
        <Logo size="medium" />
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>⏸️</Text>
        </View>
        <Text style={styles.title}>Subscription Inactive</Text>
        <Text style={styles.body}>
          {agency?.name || 'Your agency'}'s subscription is currently inactive. Contact Summit Technologies to reactivate
          your account.
        </Text>

        <Button title="I've Reactivated — Try Again" onPress={dismiss} style={styles.button} />
        <Button title="Log Out" variant="outline" onPress={() => logout()} style={styles.button} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: colors.attentionBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  icon: { fontSize: 44 },
  title: { ...typography.h1, marginBottom: spacing.md, textAlign: 'center' },
  body: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl, lineHeight: 22 },
  button: { width: '100%', marginBottom: spacing.md },
});
