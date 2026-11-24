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
import { NotificationsScreen } from '../screens/settings/NotificationsScreen';
import { AppPreferencesScreen } from '../screens/settings/AppPreferencesScreen';
import { RulesScreen } from '../screens/settings/RulesScreen';
import { StorageBookingsScreen } from '../screens/storage/StorageBookingsScreen';
import { ReportsScreen } from '../screens/reports/ReportsScreen';
import { TeamScreen } from '../screens/settings/TeamScreen';
import { ChangeAgencyPasswordScreen } from '../screens/settings/ChangeAgencyPasswordScreen';
import { ChangeMyPinScreen } from '../screens/settings/ChangeMyPinScreen';
import { ResetPinScreen } from '../screens/settings/ResetPinScreen';
import { DocumentsNavigator } from './DocumentsNavigator';
import { FinanceNavigator } from './FinanceNavigator';

const Stack = createNativeStackNavigator<MoreStackParamList>();

export function MoreNavigator() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="MoreHome" component={MoreScreen} options={{ title: 'More' }} />
      {/* Nested navigators: each manages its own header, so hide this stack's header for them */}
      <Stack.Screen name="Importers" component={ImportersNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="Guides" component={GuidesNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="Documents" component={DocumentsNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="Finance" component={FinanceNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="Rules" component={RulesScreen} options={{ title: 'Rules & Deadlines' }} />
      <Stack.Screen name="StorageBookings" component={StorageBookingsScreen} options={{ title: 'Storage bookings' }} />
      <Stack.Screen name="Reports" component={ReportsScreen} options={{ title: 'Reports' }} />
      <Stack.Screen name="Team" component={TeamScreen} options={{ title: 'Users & Permissions' }} />
      <Stack.Screen name="ChangeAgencyPassword" component={ChangeAgencyPasswordScreen} options={{ title: 'Agency password' }} />
      <Stack.Screen name="ChangeMyPin" component={ChangeMyPinScreen} options={{ title: 'Change my PIN' }} />
      <Stack.Screen name="ResetPin" component={ResetPinScreen} options={{ title: 'Reset PIN' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      <Stack.Screen name="AppPreferences" component={AppPreferencesScreen} options={{ title: 'App Preferences' }} />
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
