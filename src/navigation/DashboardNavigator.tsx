import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DashboardStackParamList } from './types';
import { stackScreenOptions } from './stackOptions';
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { ContainerCaseFileScreen } from '../screens/containers/ContainerCaseFileScreen';
import { FindDriverScreen } from '../screens/transport/FindDriverScreen';
import { DocumentScannerScreen } from '../screens/documents/DocumentScannerScreen';

const Stack = createNativeStackNavigator<DashboardStackParamList>();

export function DashboardNavigator() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="DashboardHome" component={DashboardScreen} options={{ title: 'CargoFlow' }} />
      <Stack.Screen
        name="ContainerCaseFile"
        component={ContainerCaseFileScreen}
        options={({ route }) => ({ title: route.params.containerNumber || 'Container' })}
      />
      <Stack.Screen name="FindDriver" component={FindDriverScreen} options={{ title: 'Find a Driver' }} />
      <Stack.Screen name="DocumentScanner" component={DocumentScannerScreen} options={{ title: 'Scan Document' }} />
    </Stack.Navigator>
  );
}
