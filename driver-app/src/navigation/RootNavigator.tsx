import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { LoginScreen, SignupScreen } from '../screens/AuthScreens';
import { JobsScreen } from '../screens/JobsScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { JobDetailScreen } from '../screens/JobDetailScreen';
import { CompleteDeliveryScreen } from '../screens/CompleteDeliveryScreen';
import { AddVehicleScreen } from '../screens/AddVehicleScreen';
import { RequestVerificationScreen } from '../screens/RequestVerificationScreen';
import { EarningsScreen } from '../screens/EarningsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { AuthStackParamList, MainStackParamList, TabParamList } from './types';
import { colors } from '../theme/theme';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
const navigationRef = createNavigationContainerRef<MainStackParamList>();

// A tap on a "new job" notification opens that job.
function openJobFrom(response: Notifications.NotificationResponse | null | undefined): void {
  const jobId = response?.notification.request.content.data?.jobId;
  if (typeof jobId === 'string' && navigationRef.isReady()) navigationRef.navigate('JobDetail', { jobId });
}

const headerOptions = { headerStyle: { backgroundColor: colors.navy }, headerTintColor: colors.white, headerTitleStyle: { fontWeight: '600' as const } };

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.orange,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ color, size }) => {
          const name = route.name === 'Jobs' ? 'briefcase-outline' : route.name === 'Earnings' ? 'cash-outline' : route.name === 'History' ? 'time-outline' : 'person-outline';
          return <Ionicons name={name} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Jobs" component={JobsScreen} />
      <Tab.Screen name="Earnings" component={EarningsScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { driver, booting } = useAuth();

  React.useEffect(() => {
    if (!driver) return undefined;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => openJobFrom(response));
    return () => sub.remove();
  }, [driver]);

  if (booting) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.orange} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} onReady={() => { if (driver) Notifications.getLastNotificationResponseAsync().then(openJobFrom); }}>
      {driver ? (
        <MainStack.Navigator screenOptions={headerOptions}>
          <MainStack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <MainStack.Screen name="JobDetail" component={JobDetailScreen} options={{ title: 'Job' }} />
          <MainStack.Screen name="CompleteDelivery" component={CompleteDeliveryScreen} options={{ title: 'Complete delivery' }} />
          <MainStack.Screen name="AddVehicle" component={AddVehicleScreen} options={{ title: 'Add vehicle' }} />
          <MainStack.Screen name="RequestVerification" component={RequestVerificationScreen} options={{ title: 'Verification' }} />
          <MainStack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
        </MainStack.Navigator>
      ) : (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="Signup" component={SignupScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
