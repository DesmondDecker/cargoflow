import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStackParamList } from './types';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { JoinAgencyScreen } from '../screens/auth/JoinAgencyScreen';
import { RegisterAgencyScreen } from '../screens/auth/RegisterAgencyScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="JoinAgency" component={JoinAgencyScreen} />
      <Stack.Screen name="RegisterAgency" component={RegisterAgencyScreen} />
    </Stack.Navigator>
  );
}
