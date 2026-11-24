import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { initDatabase } from './src/offline/db';
import { startSyncEngine } from './src/offline/syncEngine';
import { usePrefsStore } from './src/store/prefsStore';
import { colors, spacing, typography } from './src/theme/theme';

export default function App() {
  const [startupState, setStartupState] = useState<'loading' | 'ready' | 'error'>('loading');

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
      <StatusBar style="light" />
      {startupState === 'ready' ? (
        <RootNavigator />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background }}>
          {startupState === 'loading' ? <ActivityIndicator color={colors.orange} size="large" /> : null}
          <Text style={[typography.bodyMedium, { marginTop: spacing.md, textAlign: 'center' }]}>
            {startupState === 'loading' ? 'Preparing CargoFlow…' : 'CargoFlow could not start. Please reload and try again.'}
          </Text>
        </View>
      )}
    </SafeAreaProvider>
  );
}
