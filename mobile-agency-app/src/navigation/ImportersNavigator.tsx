import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ImportersStackParamList } from './types';
import { stackScreenOptions } from './stackOptions';
import { ImportersListScreen } from '../screens/importers/ImportersListScreen';
import { ImporterProfileScreen } from '../screens/importers/ImporterProfileScreen';
import { AddImporterScreen } from '../screens/importers/AddImporterScreen';

const Stack = createNativeStackNavigator<ImportersStackParamList>();

export function ImportersNavigator() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="ImportersList" component={ImportersListScreen} options={{ title: 'Importers' }} />
      <Stack.Screen
        name="ImporterProfile"
        component={ImporterProfileScreen}
        options={({ route }) => ({ title: route.params.importerName || 'Importer' })}
      />
      <Stack.Screen name="AddImporter" component={AddImporterScreen} options={{ title: 'New Importer' }} />
    </Stack.Navigator>
  );
}
