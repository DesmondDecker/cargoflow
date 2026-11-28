import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { initDatabase } from './src/offline/db';
import { startSyncEngine } from './src/offline/syncEngine';
import { usePrefsStore } from './src/store/prefsStore';
import { StartupSplash } from './src/components/StartupSplash';
import { colors, spacing, typography } from './src/theme/theme';

export default function App() {
  const [startupState, setStartupState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [splashElapsed, setSplashElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSplashElapsed(true), 3500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    const initialize = async () => {
      try {
        await initDatabase();
        await usePrefsStore.getState().load();
        if (!active) return;
        unsubscribe = startSyncEngine();
        setStartupState('ready');
      } catch (error) {
        console.error('CargoFlow startup failed', error);
        if (active) setStartupState('error');
      }
    };

    void initialize();
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style={startupState === 'ready' && splashElapsed ? 'light' : 'dark'} />
      {startupState === 'ready' && splashElapsed ? (
        <RootNavigator />
      ) : startupState === 'error' && splashElapsed ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background }}>
          <Text style={[typography.bodyMedium, { textAlign: 'center' }]}>CargoFlow could not start. Please reload and try again.</Text>
        </View>
      ) : (
        <StartupSplash />
      )}
    </SafeAreaProvider>
  );
}
