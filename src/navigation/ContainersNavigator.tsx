import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ContainersStackParamList } from './types';
import { stackScreenOptions } from './stackOptions';
import { ContainersListScreen } from '../screens/containers/ContainersListScreen';
import { ContainerCaseFileScreen } from '../screens/containers/ContainerCaseFileScreen';
import { FindDriverScreen } from '../screens/transport/FindDriverScreen';
import { DocumentScannerScreen } from '../screens/documents/DocumentScannerScreen';

const Stack = createNativeStackNavigator<ContainersStackParamList>();

export function ContainersNavigator() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="ContainersList" component={ContainersListScreen} options={{ title: 'Containers' }} />
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
