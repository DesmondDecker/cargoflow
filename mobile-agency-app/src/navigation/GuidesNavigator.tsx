import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GuidesStackParamList } from './types';
import { stackScreenOptions } from './stackOptions';
import { GuidesListScreen } from '../screens/guides/GuidesListScreen';
import { GuideDetailScreen } from '../screens/guides/GuideDetailScreen';

const Stack = createNativeStackNavigator<GuidesStackParamList>();

export function GuidesNavigator() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="GuidesList" component={GuidesListScreen} options={{ title: 'Guides & Help' }} />
      <Stack.Screen name="GuideDetail" component={GuideDetailScreen} options={({ route }) => ({ title: route.params.title })} />
    </Stack.Navigator>
  );
}
