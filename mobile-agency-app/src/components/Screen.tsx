import React, { PropsWithChildren, ReactElement } from 'react';
import { Platform, ScrollView, StyleSheet, View, ViewStyle, RefreshControlProps } from 'react-native';
import { Edges, SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme/theme';

interface ScreenProps {
  scroll?: boolean;
  style?: ViewStyle;
  padded?: boolean;
  refreshControl?: ReactElement<RefreshControlProps>;
  safeAreaBackgroundColor?: string;
  safeAreaEdges?: Edges;
}

export function Screen({
  children,
  scroll = true,
  style,
  padded = true,
  refreshControl,
  safeAreaBackgroundColor = colors.background,
  safeAreaEdges = ['top', 'left', 'right'],
}: PropsWithChildren<ScreenProps>) {
  if (!scroll) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: safeAreaBackgroundColor }]} edges={safeAreaEdges}>
        <View style={[styles.flex, padded && styles.padded, style]}>{children}</View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: safeAreaBackgroundColor }]} edges={safeAreaEdges}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scrollContent, padded && styles.padded, style]}
        refreshControl={refreshControl}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: spacing.lg },
  padded: { padding: spacing.lg },
});
