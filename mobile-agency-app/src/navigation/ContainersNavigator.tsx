import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ContainersStackParamList } from './types';
import { stackScreenOptions } from './stackOptions';
import { ContainersListScreen } from '../screens/containers/ContainersListScreen';
import { ContainerCaseFileScreen } from '../screens/containers/ContainerCaseFileScreen';
import { AddContainerScreen } from '../screens/containers/AddContainerScreen';
import { FindDriverScreen } from '../screens/transport/FindDriverScreen';
import { DocumentScannerScreen } from '../screens/documents/DocumentScannerScreen';
import { FinanceScreen } from '../screens/finance/FinanceScreen';
import { RecordExpenseScreen } from '../screens/finance/RecordExpenseScreen';
import { RecordPaymentScreen } from '../screens/finance/RecordPaymentScreen';

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
      <Stack.Screen name="AddContainer" component={AddContainerScreen} options={{ title: 'Register Container' }} />
      <Stack.Screen name="FindDriver" component={FindDriverScreen} options={{ title: 'Find a Driver' }} />
      <Stack.Screen name="DocumentScanner" component={DocumentScannerScreen} options={{ title: 'Scan Document' }} />
      <Stack.Screen name="Finance" component={FinanceScreen} options={{ title: 'Finance' }} />
      <Stack.Screen name="RecordExpense" component={RecordExpenseScreen} options={{ title: 'Record Expense' }} />
      <Stack.Screen name="RecordPayment" component={RecordPaymentScreen} options={{ title: 'Record Payment' }} />
    </Stack.Navigator>
  );
}
