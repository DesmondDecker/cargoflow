import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MoreStackParamList } from './types';
import { stackScreenOptions } from './stackOptions';
import { MoreScreen } from '../screens/MoreScreen';
import { ImportersNavigator } from './ImportersNavigator';
import { GuidesNavigator } from './GuidesNavigator';

const Stack = createNativeStackNavigator<MoreStackParamList>();

export function MoreNavigator() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="MoreHome" component={MoreScreen} options={{ title: 'More' }} />
      {/* Nested navigators: each manages its own header, so hide this stack's header for them */}
      <Stack.Screen name="Importers" component={ImportersNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="Guides" component={GuidesNavigator} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
