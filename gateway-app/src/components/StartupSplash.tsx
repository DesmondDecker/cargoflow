import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function StartupSplash() {
  return (
    <View style={styles.container} accessibilityLabel="CargoFlow. Powered by Summit Technologies.">
      <View style={styles.brand}>
        <View style={styles.mark}><Text style={styles.markText}>C</Text></View>
        <Text style={styles.wordmark}><Text style={styles.cargo}>Cargo</Text><Text style={styles.flow}>Flow</Text></Text>
      </View>
      <Text style={styles.powered}>POWERED BY SUMMIT TECHNOLOGIES</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mark: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#F5820D' },
  markText: { color: '#0B1F3A', fontSize: 30, fontWeight: '900' },
  wordmark: { fontSize: 30, letterSpacing: -1.2 },
  cargo: { color: '#0B1F3A', fontWeight: '800' },
  flow: { color: '#0B1F3A', fontWeight: '400' },
  powered: { marginTop: 19, color: '#788394', fontSize: 10, fontWeight: '700', letterSpacing: 2 },
});
