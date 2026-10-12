import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MoreStackParamList } from './types';
import { stackScreenOptions } from './stackOptions';
import { MoreScreen } from '../screens/MoreScreen';
import { ImportersNavigator } from './ImportersNavigator';
import { GuidesNavigator } from './GuidesNavigator';
import { DemurrageTermsScreen } from '../screens/settings/DemurrageTermsScreen';
import { AddDemurrageTermScreen } from '../screens/settings/AddDemurrageTermScreen';
import { EditAgencyProfileScreen } from '../screens/settings/EditAgencyProfileScreen';
import { EditLabelsScreen } from '../screens/settings/EditLabelsScreen';

const Stack = createNativeStackNavigator<MoreStackParamList>();

export function MoreNavigator() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="MoreHome" component={MoreScreen} options={{ title: 'More' }} />
      {/* Nested navigators: each manages its own header, so hide this stack's header for them */}
      <Stack.Screen name="Importers" component={ImportersNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="Guides" component={GuidesNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="DemurrageTerms" component={DemurrageTermsScreen} options={{ title: 'Grace Periods' }} />
      <Stack.Screen
        name="AddDemurrageTerm"
        component={AddDemurrageTermScreen}
        options={({ route }) => ({ title: route.params?.existing ? 'Edit Terms' : 'Add Carrier Terms' })}
      />
      <Stack.Screen name="EditAgencyProfile" component={EditAgencyProfileScreen} options={{ title: 'Agency Profile' }} />
      <Stack.Screen name="EditLabels" component={EditLabelsScreen} options={{ title: 'Customize Labels' }} />
    </Stack.Navigator>
  );
}
