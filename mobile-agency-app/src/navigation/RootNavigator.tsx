import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import { SubscriptionInactiveScreen } from '../screens/SubscriptionInactiveScreen';
import { hasCompletedOnboarding } from '../utils/onboardingStorage';
import { registerForPushNotifications } from '../notifications/pushRegistration';
import { colors } from '../theme/theme';

export function RootNavigator() {
  const status = useAuthStore((s) => s.status);
  const subscriptionInactive = useAuthStore((s) => s.subscriptionInactive);
  const bootstrap = useAuthStore((s) => s.bootstrap);

  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    bootstrap();
    hasCompletedOnboarding().then((done) => {
      setShowOnboarding(!done);
      setOnboardingChecked(true);
    });
  }, [bootstrap]);

  // Fires on a fresh login AND on a restored session from a previous
  // launch (bootstrap() resolving to 'signedIn') — either way, this is the
  // one place that reliably knows "we have a valid session" for this device.
  useEffect(() => {
    if (status === 'signedIn') {
      registerForPushNotifications();
    }
  }, [status]);

  if (status === 'checking' || !onboardingChecked) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.orange} size="large" />
      </View>
    );
  }

  if (showOnboarding) {
    return <OnboardingScreen onDone={() => setShowOnboarding(false)} />;
  }

  if (status === 'signedIn' && subscriptionInactive) {
    return <SubscriptionInactiveScreen />;
  }

  return <NavigationContainer>{status === 'signedIn' ? <MainTabNavigator /> : <AuthNavigator />}</NavigationContainer>;
}
