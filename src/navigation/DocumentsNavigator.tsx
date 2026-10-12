import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DocumentsStackParamList } from './types';
import { stackScreenOptions } from './stackOptions';
import { DocumentsListScreen } from '../screens/documents/DocumentsListScreen';

const Stack = createNativeStackNavigator<DocumentsStackParamList>();

export function DocumentsNavigator() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="DocumentsList" component={DocumentsListScreen} options={{ title: 'Documents' }} />
    </Stack.Navigator>
  );
}
