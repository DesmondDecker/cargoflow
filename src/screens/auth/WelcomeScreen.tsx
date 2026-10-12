import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { colors, spacing, typography } from '../../theme/theme';
import { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  return (
    <Screen scroll={false}>
      <View style={styles.brand}>
        <Logo size="large" showTagline showPoweredBy />
        <Text style={styles.subtitle}>Even without internet, your clearing operation keeps running.</Text>
      </View>

      <View style={styles.actions}>
        <Button title="Log In" onPress={() => navigation.navigate('Login')} />
        <Button title="Join an Agency" variant="outline" onPress={() => navigation.navigate('JoinAgency')} style={styles.gap} />
        <Button title="Register a New Agency" variant="secondary" onPress={() => navigation.navigate('RegisterAgency')} style={styles.gap} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl },
  actions: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  gap: { marginTop: spacing.md },
});
