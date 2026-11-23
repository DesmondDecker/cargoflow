# CargoFlow Mobile

React Native + Expo app for CargoFlow — Summit Technologies.

## Setup

Built on **Expo SDK 54** (React Native 0.81.5, React 19.1.0, React Navigation v7).

```bash
npm install
```

Point the app at your backend by editing `app.json` → `expo.extra.apiBaseUrl` (defaults to a placeholder URL). For local development against the backend running on your machine, use your machine's LAN IP rather than `localhost` if testing on a physical device (e.g. `http://192.168.1.20:4000/api/v1`).

```bash
npx expo start
```

Scan the QR code with Expo Go (iOS/Android), or press `i` / `a` for a simulator/emulator.
Expo Go does not include the native document-scanner module; use **Capture page (camera)** there. The automatic edge-detection scanner requires a development or production build, and the app must be reinstalled after adding or changing native modules.

## Design

Three-color brand system (`src/theme/theme.ts`):
- **Dark navy** (`#0B1F3A`) — navigation bars, headers, structural elements
- **Orange** (`#F5820D`) — primary actions, active states, brand accent
- **White** — content surfaces

Attention-engine colors (urgent/attention/normal — red/amber/green) are kept deliberately separate from the brand orange, so a status badge is never visually confused with a primary action button.

The logo (`src/components/Logo.tsx`) is a plain-Views/Text approximation of the brand mark — a rounded orange badge with the "C" letterform plus the Cargo/Flow wordmark — rather than an SVG or image asset, so there's no extra native dependency. Swap in the real logo artwork as an image asset whenever it's ready; the component's props (`size`, `showTagline`, `showPoweredBy`, `light`) are designed to make that a drop-in replacement.

## Free to use — subscription is an admin lever, not a paywall

New agencies aren't blocked by anything at signup — there's no payment step in the registration flow, and the backend's default subscription status (`trialing`) has no automatic expiry built in. Access stays open until a Summit Technologies platform admin explicitly deactivates it from the admin dashboard, and reopens the moment they reactivate it. If that happens, the app shows a dedicated `SubscriptionInactiveScreen` (blocking, not a confusing per-screen error) as soon as any API call comes back with the backend's `SUBSCRIPTION_INACTIVE` code.

## Onboarding & Guides

- **First-launch onboarding** (`src/screens/onboarding/OnboardingScreen.tsx`) — a 4-slide swipeable intro (Container Tracking, Document Management, Find a Driver, Smart Alerts) shown once, tracked via AsyncStorage (`src/utils/onboardingStorage.ts`). Skippable.
- **Guides & Help** (More → Guides & Help) — static, in-app step-by-step guides: Getting Started, Tracking a Container, Managing Documents, Finding & Assigning a Driver, and Understanding Alerts. Content lives in `src/data/guides.ts` — edit that file to add or update guides, no backend involved.

## What's built in this pass

- **Auth flow**, matching the backend exactly: Register Agency, Join Agency, Log In. Tokens in `expo-secure-store`, automatic silent refresh on a 401, forced sign-out if the refresh itself fails, plus the subscription-inactive interception (`src/api/client.ts`).
- **Dashboard** — attention-level counts, today's daily digest, and a live sync-status banner (offline / syncing / pending change count).
- **Containers** — filterable/searchable list (with an offline cache — see below), and the full **case file** screen: status (now changeable, offline-aware — see below), dates, deadlines, live tracking, document scanning, full activity timeline, and a **Find a Driver** button.
- **Document scanning** (`src/screens/documents/DocumentScannerScreen.tsx`) — real camera-based capture: take a photo per page, review/remove pages, then everything is assembled into a **single multi-page PDF** (`expo-print`) and uploaded as one document, not a loose JPEG. This is a genuine improvement over a gallery picker, but it is **not** the full "scan in seconds" experience from the product vision — there's no automatic edge detection, perspective correction, or auto-crop. Expo's managed workflow doesn't have a built-in equivalent; that would need a native document-scanner SDK (react-native-document-scanner-plugin or similar, which needs a custom dev client) or a paid third-party service. Pages upload exactly as the camera captured them.
- **Offline mode** (`src/offline/`) — a real, working foundation, scoped deliberately to the highest-value loop rather than full coverage everywhere:
  - `db.ts` — a local SQLite database (`expo-sqlite`)
  - `containerCache.ts` — the containers list is cached on every successful load; if a later load fails (no connectivity), the screen falls back to the cache automatically and shows an "Offline — showing containers from your last sync" banner instead of an error
  - `mutationQueue.ts` + `syncEngine.ts` — changing a container's status while offline queues the change locally (and updates the screen optimistically) instead of failing; `@react-native-community/netinfo` detects when connectivity returns and replays the queue automatically. A `409` conflict (the container changed elsewhere in the meantime) drops the queued mutation rather than retrying forever — the backend's `clientVersion` check is what catches this, exactly as it was designed to
  - `outbox.ts` + `outboxReplay.ts` — things done with no signal that are not one container's status: **adding or editing a client, a scanned document waiting to upload (the finished PDF is kept on the phone), and a driver assignment**. They are sent in order when the connection returns. Last-seen copies of the clients list and of the drivers offered for a container are kept so those screens still open. Something the server later refuses (for example the driver is no longer free) is not silently lost: it is listed under More > App Preferences > Offline sync until dismissed.
  - **What this does not cover**: registering a new container or bill of lading, finance (expenses, payments), letters, Customs submissions, storage bookings, reports, and everything under Settings still need a connection. A client created offline cannot be used to register a container until it has synced. The offline replay is covered by unit tests; it has not been run on a device.
- **Find a Driver / Transport** — from a container's case file, see verified drivers whose vehicles match the container's size, pick one, and assign a pickup/destination.
- **Importers** — list + profile view, reached via More → Importers.
- **More** — a navigation hub (Importers, Guides & Help) plus account/agency info and logout.

## What's not built yet (backend already supports most of these — next passes)

- **Document scanning** now uses the phone's own scanner (edge detection, perspective correction, auto-crop) in an installed build; Expo Go falls back to plain camera capture. Not yet tested on a device.
- **Offline coverage** is the list in the Offline section above; everything else needs a connection.
- QR/barcode scanner tied to `/search/resolve/:code` (the search box resolves codes typed in, but there is no camera scanning)
- The driver-facing app lives in `../driver-app` and now has push notifications and offline support; see its README.
- Reports/export UI

## Expo SDK 57 notes

- Expo SDK 57: React Native 0.86.3, React 19.2.3, TypeScript 6, React Navigation 7.5+. Package versions come from the SDK's own `bundledNativeModules.json`. `react-native-google-mobile-ads` is `^17.4.0` because 17.4 requires React Native 0.86.
- `baseUrl` was removed from `tsconfig.json` (deprecated in TypeScript 6; nothing used the `@/` alias).
- `<StatusBar>` no longer takes `backgroundColor`: Android is edge-to-edge only, so the header must provide its own colour. Check status bar and gesture bar overlap on a real Android device.
- `DocumentScannerScreen.tsx` still imports `expo-file-system/legacy`; it bundled on SDK 57 but is worth migrating to the new File API.
- Typechecks and bundles for Android and iOS. Not run on a device. Native modules (document scanner, push notifications, AdMob) need a development or production build, not Expo Go.

## Project structure

```
src/
  theme/        design tokens (colors, spacing, typography)
  api/          axios client + per-resource API functions
  store/        zustand stores (auth, incl. subscription-inactive state)
  navigation/   React Navigation stacks/tabs, typed param lists
  screens/      one folder per app area (auth, dashboard, containers, documents, transport, guides, onboarding)
  components/   shared UI (Button, Field, Card, Screen, AttentionBadge, Logo)
  data/         static in-app content (onboarding slides, guides)
  utils/        onboarding-seen flag storage
  offline/      SQLite db, container cache, mutation queue, outbox (clients, documents, driver assignments), sync engine
  types/        API response shapes shared across screens
```
