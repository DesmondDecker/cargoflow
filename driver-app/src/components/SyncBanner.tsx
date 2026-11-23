import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { onQueueChange } from '../offline/queue';
import { colors, radius, spacing } from '../theme/theme';

// Tells the driver when they are offline and how many changes are saved on the
// phone waiting to be sent, or that some were rejected by the server.
export function SyncBanner() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);

  useEffect(() => {
    const unsubQueue = onQueueChange((p, f) => {
      setPending(p);
      setFailed(f);
    });
    const unsubNet = NetInfo.addEventListener((s) => setOnline(!!s.isConnected && s.isInternetReachable !== false));
    return () => {
      unsubQueue();
      unsubNet();
    };
  }, []);

  if (online && pending === 0 && failed === 0) return null;

  const parts: string[] = [];
  if (!online) parts.push('You are offline.');
  if (pending > 0) parts.push(`${pending} change${pending === 1 ? '' : 's'} saved on this phone, waiting to send.`);
  if (failed > 0) parts.push(`${failed} change${failed === 1 ? ' was' : 's were'} rejected by the server. Open Settings to see why.`);

  return (
    <View style={[styles.banner, failed > 0 && styles.bannerError]}>
      <Text style={[styles.text, failed > 0 && styles.textError]}>{parts.join(' ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.attentionBg, padding: spacing.sm, borderRadius: radius.sm, marginBottom: spacing.md },
  bannerError: { backgroundColor: colors.urgentBg },
  text: { color: colors.attention, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  textError: { color: colors.urgent },
});
