# CargoFlow — Packaged Build

## What ships live vs. what's held back

This pass made a deliberate cut: the shipped app only exposes features with a real, working path from end to end. A few things got built this session but are **not** wired into the live app right now, because they'd show a real customer either an empty result or a placeholder. Nothing was deleted — it's all still here, just not rendered yet.

**Hidden from the shipped mobile app, and why:**
- **"Find a Driver"** — removed from the container case file screen. There is currently no working way for a real driver to ever get into the system: `cargoflow-driver`'s repo has no source code (see below), and there's no admin-side endpoint to create a driver record either — the only path is a driver app's own signup flow, which doesn't exist anywhere. The screen, API client, and backend all still work; they'd just always return an empty list today.
- **Warehouse storage** — never had a mobile screen built for it in the first place, so there's nothing to hide. The backend (models, booking lifecycle, admin verification, sponsorship) is real and complete; "Find Storage" is the next real build, not a cut.
- **AdMob banner + Featured/sponsored listings on the dashboard** — removed from `DashboardScreen.tsx`. The ad banner is wired to Google's own official *test* ad unit IDs (real, functional, documented by Google — just zero revenue by design), and Featured listings would always be empty for the same reason "Find a Driver" is empty. Showing either to a real customer right now would look exactly like what it is: a placeholder. `HomeAdBanner.tsx`, `ADMOB_SETUP.md`, and the whole sponsorship backend are untouched — turn them back on once there's a real AdMob account and real driver/warehouse inventory to sponsor.

**One judgment call worth knowing about, not hidden:** the `react-native-google-mobile-ads` native dependency and its Expo config plugin are still registered in `app.json`, even though nothing renders it right now. Leaving it in avoids ripping out and later redoing real integration work; the cost is a bit of unused native weight in every build until ads actually launch. If you'd rather have a fully clean build with zero ad-related native code until then, that's a one-line removal from `app.json`'s `plugins` array plus an `npm uninstall` — tell me and I'll do it.

**What's genuinely live and real right now:** container tracking with carrier detection (BIC-table + per-agency learning + Bill-of-Lading cascade), agency-configurable grace periods and status/document labels, agency profile editing, and the full CargoFlow Finance Phase 1 — expenses with approval workflow, shipment payments, and real PDF receipt generation with WhatsApp/share. All of it has a working screen a real agency can actually use today.

**Tested, not just typechecked:** `backend/` has a real test suite now (`npm test`, 34 tests, all passing) covering the pure logic — container check-digit validation, carrier detection, grace-period math, the attention/urgency engine, and real PDF byte-level generation. Anything touching the database is still verified by careful reading only — this sandbox has no reachable MongoDB (confirmed by direct attempt, not assumed), so true integration testing has to happen on your own infrastructure.

---

## 1. `backend/` — compiled, tested, ready to run

```bash
cd backend
npm install
npm test            # real unit tests — 34 passing
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

## 4. Driver app — not packaged, because the source doesn't exist anywhere reachable

`github.com/DesmondDecker/cargoflow-driver` has one commit and a README describing what was built — camera-based proof of delivery, signature capture, GPS — but no actual source code. Worth checking your local machine or any other remote before assuming it's gone; if it truly isn't anywhere, it needs to be rebuilt against the backend's existing `/driver/*` routes, which are untouched and ready for it.

## What a real demo needs today

Backend running somewhere reachable (Railway/Render/a VPS + MongoDB Atlas), admin dashboard pointed at it, and the mobile app via `npx expo start` + Expo Go for a live demo — no APK build required for that. The shipped mobile app will show container tracking, grace periods, label customization, agency profile, and the finance module end to end. It will not show a driver network or warehouse storage yet — those are real backend capability waiting on the two gaps above.
