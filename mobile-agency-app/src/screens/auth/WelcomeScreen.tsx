import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { Card } from '../../components/Card';
import { colors, radius, spacing, typography } from '../../theme/theme';
import { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string }[] = [
  { icon: 'cube-outline', title: 'Manage shipments', detail: 'Keep containers and tracking in one place.' },
  { icon: 'document-text-outline', title: 'Stay document-ready', detail: 'Organize shipping paperwork as work moves.' },
  { icon: 'shield-checkmark-outline', title: 'Verify with Customs', detail: 'Submit details and follow each review.' },
];

export function WelcomeScreen({ navigation }: Props) {
  const entrance = useRef(new Animated.Value(0)).current;
  const orbit = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const appear = Animated.timing(entrance, { toValue: 1, duration: 520, useNativeDriver: true });
    const float = Animated.loop(
      Animated.sequence([
        Animated.timing(orbit, { toValue: 1, duration: 1700, useNativeDriver: true }),
        Animated.timing(orbit, { toValue: 0, duration: 1700, useNativeDriver: true }),
      ]),
    );
    appear.start();
    float.start();
    return () => {
      appear.stop();
      float.stop();
    };
  }, [entrance, orbit]);

  const introStyle = {
    opacity: entrance,
    transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
  };
  const iconStyle = { transform: [{ translateY: orbit.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] };

  return (
    <Screen scroll padded={false} safeAreaEdges={['top', 'left', 'right', 'bottom']} safeAreaBackgroundColor={colors.navy} style={styles.scrollContent}>
      <StatusBar style="light" />
      <View style={styles.page}>
        <Animated.View style={[styles.hero, introStyle]}>
          <View style={styles.heroTop}>
            <Logo size="small" light />
            <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>LOGISTICS, IN SYNC</Text></View>
          </View>
          <Animated.View style={[styles.heroIconWrap, iconStyle]}>
            <View style={styles.heroIconRing} />
            <Ionicons name="boat-outline" size={40} color={colors.white} />
            <View style={styles.heroCheck}><Ionicons name="checkmark" size={15} color={colors.white} /></View>
          </Animated.View>
          <Text style={styles.heroTitle}>Your operations,{"\n"}moving together.</Text>
          <Text style={styles.heroSubtitle}>One clear view of every shipment, document and delivery.</Text>
          <View style={styles.route}>
            <View style={styles.routeDot} />
            <View style={styles.routeLine} />
            <View style={[styles.routeDot, styles.routeDotEnd]} />
            <Text style={styles.routeLabel}>PORT</Text>
            <Text style={[styles.routeLabel, styles.routeLabelEnd]}>DELIVERY</Text>
          </View>
        </Animated.View>

        <View style={styles.body}>
          <Text style={styles.sectionTitle}>Everything in one place</Text>
          <Card style={styles.featureCard}>
            {FEATURES.map((feature, index) => (
              <View key={feature.title} style={[styles.featureRow, index < FEATURES.length - 1 && styles.featureBorder]}>
                <View style={styles.featureIcon}>
                  <Ionicons name={feature.icon} size={19} color={colors.orangeDark} />
                </View>
                <View style={styles.featureCopy}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDetail}>{feature.detail}</Text>
                </View>
              </View>
            ))}
          </Card>

          <View style={styles.actions}>
            <Button title="Log In" onPress={() => navigation.navigate('Login')} />
            <Button title="Join an Agency" variant="outline" onPress={() => navigation.navigate('JoinAgency')} style={styles.gap} />
            <Text style={styles.registerLine} onPress={() => navigation.navigate('RegisterAgency')} accessibilityRole="button">
              New to CargoFlow? <Text style={styles.registerLink}>Register an agency</Text>
            </Text>
          </View>
          <Text style={styles.footer}>CargoFlow · Simplifying your logistics</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1 },
  page: { flexGrow: 1, minHeight: 700, backgroundColor: colors.background },
  hero: { backgroundColor: colors.navy, paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xl, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radius.pill },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.normal },
  liveText: { color: colors.white, fontSize: 9, fontWeight: '700', letterSpacing: 0.6 },
  heroIconWrap: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg, marginBottom: spacing.md },
  heroIconRing: { position: 'absolute', width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(245,130,13,0.22)', borderWidth: 1, borderColor: 'rgba(245,130,13,0.5)' },
  heroCheck: { position: 'absolute', right: 0, bottom: 1, width: 23, height: 23, borderRadius: 12, backgroundColor: colors.normal, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.navy },
  heroTitle: { ...typography.h1, color: colors.white, fontSize: 29, lineHeight: 34 },
  heroSubtitle: { ...typography.body, color: 'rgba(255,255,255,0.78)', marginTop: spacing.sm, maxWidth: 320, lineHeight: 21 },
  route: { height: 22, flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg },
  routeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.orange },
  routeLine: { width: 70, height: 1, backgroundColor: 'rgba(255,255,255,0.36)', marginHorizontal: spacing.xs },
  routeDotEnd: { backgroundColor: colors.normal },
  routeLabel: { color: 'rgba(255,255,255,0.68)', fontSize: 9, fontWeight: '700', marginLeft: spacing.xs },
  routeLabelEnd: { marginLeft: spacing.xs },
  body: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  sectionTitle: { ...typography.h3, fontSize: 17, marginBottom: spacing.sm },
  featureCard: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  featureBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  featureIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.orangeBg, alignItems: 'center', justifyContent: 'center' },
  featureCopy: { flex: 1, gap: 2 },
  featureTitle: { ...typography.bodyMedium, fontSize: 13 },
  featureDetail: { ...typography.caption, fontSize: 11 },
  actions: { marginTop: 'auto', paddingTop: spacing.lg },
  gap: { marginTop: spacing.sm },
  registerLine: { ...typography.caption, textAlign: 'center', marginTop: spacing.md },
  registerLink: { color: colors.orangeDark, fontWeight: '700' },
  footer: { ...typography.caption, textAlign: 'center', fontSize: 10, marginTop: spacing.md },
});
