import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DashboardStackParamList } from './types';
import { stackScreenOptions } from './stackOptions';
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { ContainerCaseFileScreen } from '../screens/containers/ContainerCaseFileScreen';
import { FindDriverScreen } from '../screens/transport/FindDriverScreen';
import { FindStorageScreen } from '../screens/storage/FindStorageScreen';
import { ContainerLettersScreen } from '../screens/letters/ContainerLettersScreen';
import { LetterEditorScreen } from '../screens/letters/LetterEditorScreen';
import { DocumentScannerScreen } from '../screens/documents/DocumentScannerScreen';
import { FinanceScreen } from '../screens/finance/FinanceScreen';
import { RecordExpenseScreen } from '../screens/finance/RecordExpenseScreen';
import { RecordPaymentScreen } from '../screens/finance/RecordPaymentScreen';

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
      <Stack.Screen name="FindStorage" component={FindStorageScreen} options={{ title: 'Find storage' }} />
      <Stack.Screen name="ContainerLetters" component={ContainerLettersScreen} options={{ title: 'Letters' }} />
      <Stack.Screen name="LetterEditor" component={LetterEditorScreen} options={{ title: 'Letter' }} />
      <Stack.Screen name="DocumentScanner" component={DocumentScannerScreen} options={{ title: 'Scan Document' }} />
      <Stack.Screen name="Finance" component={FinanceScreen} options={{ title: 'Finance' }} />
      <Stack.Screen name="RecordExpense" component={RecordExpenseScreen} options={{ title: 'Record Expense' }} />
      <Stack.Screen name="RecordPayment" component={RecordPaymentScreen} options={{ title: 'Record Payment' }} />
    </Stack.Navigator>
  );
}
