import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { initDatabase } from './src/offline/db';
import { startSyncEngine } from './src/offline/syncEngine';
import { StartupSplash } from './src/components/StartupSplash';

export default function App() {
  const [splashElapsed, setSplashElapsed] = useState(false);

  useEffect(() => {
    initDatabase();
    const unsubscribe = startSyncEngine();
    return unsubscribe;
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSplashElapsed(true), 3500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style={splashElapsed ? 'light' : 'dark'} />
      {splashElapsed ? <RootNavigator /> : <StartupSplash />}
    </SafeAreaProvider>
  );
}
