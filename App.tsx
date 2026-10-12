import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { initDatabase } from './src/offline/db';
import { startSyncEngine } from './src/offline/syncEngine';

export default function App() {
  useEffect(() => {
    initDatabase();
    const unsubscribe = startSyncEngine();
    return unsubscribe;
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor="#0B1F3A" />
      <RootNavigator />
    </SafeAreaProvider>
  );
}
