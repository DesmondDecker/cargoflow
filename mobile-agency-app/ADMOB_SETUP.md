# Switching from test ads to real ads

This app ships with `react-native-google-mobile-ads` wired up and working —
but configured with **Google's own official test identifiers**, not real
ones. Test ads display correctly and prove the integration works, but they
earn **zero revenue**: AdMob deliberately serves a test creative for those
IDs, never a real advertiser. Until you complete the steps below, the ad
banner on the dashboard is functional but not making money.

## 1. Create an AdMob account and app listing

1. Go to https://admob.google.com and sign in with the Google account you
   want to own this revenue.
2. Add a new app — one listing for Android, one for iOS (they get separate
   App IDs even though it's the same CargoFlow app).
3. For each platform, create a **Banner** ad unit. Note the Ad Unit ID for
   each (format: `ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY`).
4. Note each platform's **App ID** too (format:
   `ca-app-pub-XXXXXXXXXXXXXXXX~ZZZZZZZZZZ` — different suffix separator,
   easy to mix up with the Ad Unit ID).

## 2. Replace four values in `app.json`

Two in the config plugin block (`expo.plugins`, the
`react-native-google-mobile-ads` entry):

```json
"androidAppId": "<your real Android App ID>",
"iosAppId": "<your real iOS App ID>"
```

Two in `expo.extra.adMobBannerUnitId`:

```json
"android": "<your real Android Ad Unit ID>",
"ios": "<your real iOS Ad Unit ID>"
```

That's the entire swap — `HomeAdBanner.tsx` reads these at runtime and
build time, no other code changes needed. The small red dot it draws in a
corner during development (`isUsingTestIds` in that file) disappears
automatically once real IDs are in place — it's keyed off detecting
Google's known test-ID number, not a flag you need to flip yourself.

## 3. Rebuild — this can't be tested in plain Expo Go

`react-native-google-mobile-ads` is a native module. It was never testable
in plain Expo Go even with the placeholder test IDs — this app already
needs a custom dev client / EAS build for `expo-camera` and
`expo-image-picker`, so this doesn't add a new constraint, it's the same
one already in place. Rebuild with:

```bash
npx eas build --platform android --profile preview
```

## 4. Submit for AdMob review before going live

A new AdMob account and app need Google's review and approval before real
ads actually start serving at volume — this isn't instant. Budget a few
days before counting on ad revenue in a launch plan.

## Policy note

AdMob's policies require genuine, substantial app content around ads, and
restrict how ads can be placed relative to buttons a user might
accidentally tap. The current placement — bottom of the dashboard, below
the real operational stats — is a safe starting position; if you add more
ad placements later, re-check Google's placement policies for each one
rather than assuming the dashboard's placement generalizes.
