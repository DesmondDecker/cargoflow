import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StackActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Text, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MainTabParamList } from './types';
import { colors } from '../theme/theme';
import { DashboardNavigator } from './DashboardNavigator';
import { ContainersNavigator } from './ContainersNavigator';
import { TrackingNavigator } from './TrackingNavigator';
import { CustomsNavigator } from './CustomsNavigator';
import { MoreNavigator } from './MoreNavigator';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }> = {
  Dashboard: { on: 'home', off: 'home-outline' },
  Containers: { on: 'cube', off: 'cube-outline' },
  Tracking: { on: 'locate', off: 'locate-outline' },
  Customs: { on: 'shield-checkmark', off: 'shield-checkmark-outline' },
  More: { on: 'menu', off: 'menu-outline' },
};

const LABELS: Record<keyof MainTabParamList, string> = {
  Dashboard: 'Home',
  Containers: 'Containers',
  Tracking: 'Tracking',
  Customs: 'Customs',
  More: 'More',
};

export function MainTabNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.orange,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          height: 64 + insets.bottom,
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          paddingTop: 4,
          paddingBottom: insets.bottom + 4,
        },
        tabBarItemStyle: { minWidth: 0, minHeight: 44, paddingHorizontal: 2 },
        tabBarLabel: ({ color, focused }) => (
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            style={[styles.label, { color }, focused && styles.activeLabel]}
          >
            {LABELS[route.name]}
          </Text>
        ),
        tabBarIcon: ({ focused, color }) => (
          <View style={[styles.icon, focused && styles.activeIcon]}>
            <Ionicons name={focused ? ICONS[route.name].on : ICONS[route.name].off} size={20} color={color} />
          </View>
        ),
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardNavigator} />
      <Tab.Screen name="Containers" component={ContainersNavigator} />
      <Tab.Screen name="Tracking" component={TrackingNavigator} />
      <Tab.Screen name="Customs" component={CustomsNavigator} />
      <Tab.Screen
        name="More"
        component={MoreNavigator}
        listeners={({ navigation }) => ({
          tabPress: () => {
            const moreState = navigation.getState().routes.find((route) => route.name === 'More')?.state;
            if (moreState?.key && (moreState.index ?? 0) > 0) {
              navigation.dispatch({ ...StackActions.popToTop(), target: moreState.key });
            }
          },
        })}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 34,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  activeIcon: { backgroundColor: colors.orangeBg },
  label: { maxWidth: '100%', flexShrink: 1, fontSize: 10, lineHeight: 12, fontWeight: '600', textAlign: 'center' },
  activeLabel: { fontWeight: '700' },
});
