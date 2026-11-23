import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { MainTabParamList } from './types';
import { colors } from '../theme/theme';
import { DashboardNavigator } from './DashboardNavigator';
import { ContainersNavigator } from './ContainersNavigator';
import { TrackingNavigator } from './TrackingNavigator';
import { FinanceNavigator } from './FinanceNavigator';
import { MoreNavigator } from './MoreNavigator';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }> = {
  Dashboard: { on: 'home', off: 'home-outline' },
  Containers: { on: 'cube', off: 'cube-outline' },
  Tracking: { on: 'locate', off: 'locate-outline' },
  Finance: { on: 'wallet', off: 'wallet-outline' },
  More: { on: 'menu', off: 'menu-outline' },
};

export function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.orange,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => <Ionicons name={focused ? ICONS[route.name].on : ICONS[route.name].off} size={size} color={color} />,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardNavigator} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="Containers" component={ContainersNavigator} />
      <Tab.Screen name="Tracking" component={TrackingNavigator} />
      <Tab.Screen name="Finance" component={FinanceNavigator} />
      <Tab.Screen name="More" component={MoreNavigator} />
    </Tab.Navigator>
  );
}
