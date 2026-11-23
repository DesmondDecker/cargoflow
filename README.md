# CargoFlow — Packaged Build

## What's in this repo

| Folder | What it is |
|---|---|
| `backend/` | Express + MongoDB API: containers, documents, importers, finance, letters, drivers, warehouses, Customs verification, platform admin |
| `mobile-agency-app/` | The agency app (Expo SDK 57): containers, tracking, finance, documents and scanner, letters, clients, settings |
| `driver-app/` | The driver app (Expo SDK 57): jobs, delivery proof, earnings, offline, notifications |
| `admin/` | Platform operators' web dashboard (agencies, payments, drivers, warehouses, Customs & AGL users, expenses, gateway devices, team) |
| `portal/` | Web portal for the institutions and for warehouses: Customs officers and AGL (review queue, approve or return, approved records, CSV, reports) and warehouse owners (sign up, listing and space, answer bookings, check goods in and out at `/warehouse`). See `portal/README.md` |
| `gateway-app/` | Android app for the office phone that forwards mobile-money SMS to the server. Foreground only and untested on a device; read `gateway-app/README.md` first |
| `src/`, `App.tsx` (repo root) | **An older copy of the agency app that has fallen behind** `mobile-agency-app/`. It still typechecks and bundles on SDK 57, but it is missing features (bill of lading API, letters, tracking tab and others). Use `mobile-agency-app/`; delete this copy once you have confirmed nothing there is needed. |

## Customs verification

The workflow in the Customs concept note: a clearing agent submits six details (CVC number, bill of lading, shipping agency, container number, document name, ITS number) from the agency app (More > Customs Verification, or Submit to Customs on a container); a Customs officer reviews it in the portal and approves it or returns it for correction; on approval AGL is emailed automatically and sees the record in the portal. Customs can also enter a record for an agent. Every record keeps a history of who did what and when, approvals get a reference like `CV-2026-000042`, and the portal has turnaround reports. Cargo Flow does not verify duty payments or touch AGL's systems.

Built here: `backend/src/controllers/customsController.ts`, `backend/src/services/customs/`, `portal/`, the admin's Customs & AGL users page, and the agency app screens. Needs configuring before a pilot: SMTP settings for the approval email (see `backend/.env.example`), accounts for named Customs and AGL staff, HTTPS, and the institutions' own approval and security review.

## Container tracking: how a lookup works

For each carrier, the server tries sources in order and the first that answers wins:

1. The carrier's own API (DCSA Track & Trace), when that carrier's credentials are set.
2. MarineTraffic's Container Tracking API (paid, carrier-independent backup), when `MARINETRAFFIC_API_KEY` is set.
3. The public-page scraper, off by default (`TRACKING_SCRAPER_ENABLED`, `SCRAPER_URL_<CARRIER>`). It only works on pages whose result is in the HTML the server receives.
4. Generic public tracking, which needs no setup: the carrier is identified from the container prefix and the app links to the carrier's public page. Staff can capture the result from that page (Track button), and a failed lookup never erases tracking someone captured.

See `backend/.env.example` and `backend/src/services/tracking/registry.ts`. In the app, More > App Preferences lists what is switched on per carrier.

## Expo SDK 57

Both apps and the older root app are on Expo SDK 57 (React Native 0.86.3, React 19.2.3, TypeScript 6). Versions come from `expo/bundledNativeModules.json` of `expo@57.0.31`, so `npx expo install --check` should report nothing to fix. Changes the upgrade needed: `baseUrl` removed from `tsconfig.json` (deprecated in TypeScript 6), and the `backgroundColor` prop removed from `<StatusBar>` (Android is edge-to-edge only). Both apps typecheck and bundle for Android; the agency app also bundles for iOS. Not verified: running on a device or simulator, and the two `expo-doctor` checks that need the Expo API.

## 1. `backend/` — compiled, tested, ready to run

```bash
cd backend
npm install
npm test            # 137 passed before the PIN/admin-role changes; new tests (pinRules, adminAccess) not yet run under Vitest
npm run build        # already done — dist/ is included
# set your .env (Mongo URI, JWT secrets, R2 keys — see src/config/env.ts for the full list)
npm start            # runs dist/server.js
```

## 2. `admin/` — compiled, ready to deploy

Vite build succeeded (`tsc --noEmit && vite build`, 0 errors) into `admin/dist/` — a static site, deployable as-is to Netlify, Vercel, Cloudflare Pages, or any static host. Note: this dashboard is for CargoFlow's own platform operators (verifying drivers/warehouses, managing subscriptions) — it has no agency login, and hasn't had the same line-by-line review this session gave the backend and mobile app.

```bash
cd admin
npm install
npm run build       # already done — dist/ is included
npm run preview     # to check it locally first
```

## 3. `mobile-agency-app/` — source is clean, binary needs one step outside this environment

Typechecks clean (0 errors) — every screen, API call, and type lines up. Not yet an `.apk`/`.ipa`: that needs either EAS Build (Expo's cloud service — no network path to `expo.dev` from this sandbox) or a local Android/iOS toolchain (not installed here). `eas.json` is already set up so it's one command away once run somewhere with internet access and an Expo account:

```bash
cd mobile-agency-app
npm install
npx eas login
npx eas build --platform android --profile preview   # produces a real, installable .apk
```

For a quick demo without a full build at all: `npx expo start` and open it in Expo Go on a phone via the QR code.

## 4. `driver-app/`

Rebuilt against the backend's `/driver/*` routes (the old `cargoflow-driver` repo had no source). See `driver-app/README.md`.

## What a real demo needs today

Backend running somewhere reachable (Railway/Render/a VPS + MongoDB Atlas), admin dashboard pointed at it, and the mobile app via `npx expo start` + Expo Go for a live demo — no APK build required for that. The agency app shows container tracking (timeline and route map), finance, documents (with verification) and scanning, letters, clients, drivers, storage, Customs submissions, reports and exports, and settings. Sponsored listings and the AdMob banner are still deliberately hidden.
