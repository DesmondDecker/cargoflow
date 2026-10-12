import React, { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { colors, spacing } from '../theme/theme';

// Reads the real ad unit ID from app.json's `extra.adMobBannerUnitId`, which
// defaults to Google's own official TEST identifiers (the same ones Google
// documents for development — ca-app-pub-3940256099942544/...). Those serve
// real test ads and are safe to ship to a dev build, but they earn zero
// revenue: AdMob explicitly serves test creatives for them, never a real
// advertiser. Before a production build, replace both entries in app.json's
// `extra.adMobBannerUnitId` with the real ad unit IDs from your own AdMob
// account (and androidAppId/iosAppId in the plugin config above them) — see
// ADMOB_SETUP.md for the full walkthrough. Until that swap happens, this
// component is wired correctly but not actually making money.
const configuredUnitId = Constants.expoConfig?.extra?.adMobBannerUnitId?.[Platform.OS] as string | undefined;
const isUsingTestIds = !configuredUnitId || configuredUnitId.includes('3940256099942544');
const adUnitId = configuredUnitId || TestIds.BANNER;

export function HomeAdBanner() {
  const [failed, setFailed] = useState(false);
  if (failed) return null; // one failed ad request just means no ad this load — never worth a user-facing error

  return (
    <View style={styles.wrap}>
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.MEDIUM_RECTANGLE}
        onAdFailedToLoad={() => setFailed(true)}
      />
      {isUsingTestIds ? (
        // Only ever visible in a dev/test build — see the comment above.
        // Deliberately loud rather than a subtle dev-mode watermark, so it
        // can't ship to production unnoticed.
        <View style={styles.testBadge} pointerEvents="none" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginBottom: spacing.md },
  testBadge: { position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.urgent },
});
