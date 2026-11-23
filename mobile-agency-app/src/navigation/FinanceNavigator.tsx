import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { FinanceHomeStackParamList } from './types';
import { stackScreenOptions } from './stackOptions';
import { FinanceHomeScreen } from '../screens/finance/FinanceHomeScreen';

const Stack = createNativeStackNavigator<FinanceHomeStackParamList>();

export function FinanceNavigator() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="FinanceHome" component={FinanceHomeScreen} options={{ title: 'Finance' }} />
    </Stack.Navigator>
  );
}
