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
  - **What this does not cover**: only the containers list (read) and status changes (write) are offline-aware. Importers, documents, driver assignment, and date updates all still require connectivity. Extending the same cache/queue pattern to those is straightforward given the foundation here, but it's real work, not a checkbox — see "not built yet" below for the honest scope.
- **Find a Driver / Transport** — from a container's case file, see verified drivers whose vehicles match the container's size, pick one, and assign a pickup/destination.
- **Importers** — list + profile view, reached via More → Importers.
- **More** — a navigation hub (Importers, Guides & Help) plus account/agency info and logout.

## What's not built yet (backend already supports most of these — next passes)

- **True document scanning** — automatic edge detection, perspective correction, auto-crop. What exists now (multi-page camera capture + PDF assembly) is a real step up from a single gallery photo, but it's manual capture, not "scan."
- **Offline coverage beyond containers list + status changes** — see above. Importers, documents, dates, and driver assignment are not yet cache/queue-aware.
- QR/barcode scanner tied to `/search/resolve/:code`
- The separate driver-facing app — **this now exists as its own project, `cargoflow-driver`**, not part of this app. See its own README for what it covers (job accept/decline, status updates, proof of delivery with photo + signature + GPS) and what it still lacks (push notifications, offline support).
- Reports/export UI

## Expo SDK 54 upgrade notes

- **React Navigation was bumped from v6 to v7**, not just patched — v6 predates React 19 (which React Native 0.81 requires) and isn't safe to run on it. v7 is the officially supported version for this RN/React combination, but there's an **open, unresolved GitHub issue** (react-navigation/react-navigation#12921) describing a native `TypeError: expected dynamic type 'boolean', but had type 'string'` crash under React 19 in some configurations. I couldn't reproduce or rule this out here — I have no way to run this app on a real device or simulator in this environment. Test navigation thoroughly on a real device after upgrading, and run `npx expo-doctor` before shipping.
- **`expo-file-system` v19 replaced the old string-based API** (`readAsStringAsync`, `EncodingType`) with a new object-oriented File/Directory API by default. `DocumentScannerScreen.tsx` now imports from `expo-file-system/legacy` specifically to keep using the old, simpler API for one-off base64 reads — this still works but is worth migrating to the new API eventually, since the legacy path won't be maintained forever.
- **Android edge-to-edge is now mandatory** (SDK 54 targets Android 16/API 36) and can no longer be disabled. This app's screens already use `SafeAreaView` broadly, but genuine edge-to-edge layout wasn't re-verified visually — check status bar / gesture bar overlap on a real Android device.
- Two real type errors surfaced during this upgrade (not hypothetical) — a `RefreshControl` generic typing issue in `Screen.tsx` and the file-system API change above — both fixed. This is exactly the kind of thing `tsc --noEmit` catches that a version bump alone wouldn't.

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
  offline/      SQLite db, container cache, mutation queue, sync engine
  types/        API response shapes shared across screens
```
