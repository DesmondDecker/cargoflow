import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CustomsStackParamList } from './types';
import { stackScreenOptions } from './stackOptions';
import { CustomsSubmissionsScreen } from '../screens/customs/CustomsSubmissionsScreen';
import { CustomsSubmissionScreen } from '../screens/customs/CustomsSubmissionScreen';

const Stack = createNativeStackNavigator<CustomsStackParamList>();

export function CustomsNavigator() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="CustomsSubmissions" component={CustomsSubmissionsScreen} options={{ title: 'Customs verification' }} />
      <Stack.Screen name="CustomsSubmission" component={CustomsSubmissionScreen} options={{ title: 'Customs submission' }} />
    </Stack.Navigator>
  );
}
