import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TrackingStackParamList } from './types';
import { stackScreenOptions } from './stackOptions';
import { TrackingListScreen } from '../screens/tracking/TrackingListScreen';
import { TrackingTimelineScreen } from '../screens/tracking/TrackingTimelineScreen';

const Stack = createNativeStackNavigator<TrackingStackParamList>();

export function TrackingNavigator() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="TrackingList" component={TrackingListScreen} options={{ title: 'Tracking' }} />
      <Stack.Screen name="TrackingTimeline" component={TrackingTimelineScreen} options={{ title: 'Shipment timeline' }} />
    </Stack.Navigator>
  );
}
