# CargoFlow Backend

Node.js + TypeScript + Express + MongoDB API serving all three CargoFlow clients:
`cargoflow-mobile` (agency staff), `cargoflow-admin` (platform admins), and the
driver app described in `cargoflow-driver`'s README (no driver-app source code
existed to match against — only that README — so the driver contract below is
this backend's own design, not a match to committed client code).

## Setup

```bash
npm install
cp .env.example .env   # then edit MONGO_URI, JWT secrets, etc.
npm run dev             # ts-node-dev, auto-restarts on change
```

Requires a MongoDB instance (a single node is fine — see note on transactions
below). `docker-compose up` runs both Mongo and the API together.

Create the first platform admin (no public registration route on purpose):

```bash
SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD=... npm run seed:admin
```

Seed some subscription plans so the admin dashboard's Plans page and the
payment flow have something to reference:

```bash
npm run seed:plans   # edit src/seed/seedSubscriptionPlans.ts first for real pricing
```

## Wiring it to the existing clients

- `cargoflow-mobile`: set `EXPO_PUBLIC_API_BASE_URL=https://your-host/api/v1`
  (see `app.config.js` added in the previous fix) or edit `app.json` directly.
- `cargoflow-admin`: set `VITE_API_BASE_URL=https://your-host/api/v1` in its `.env`.
- Driver app: point `expo.extra.apiBaseUrl` at `https://your-host/api/v1` once
  it exists — see "Driver contract" below for the endpoints this backend
  actually exposes.

All three were verified against this backend by reading their actual
`src/api/*.ts` files (mobile, admin) — every endpoint path, request body, and
response shape below matches what those clients already call, field-for-field.

## Auth model

Three completely separate identity spaces, one shared mechanism:

- **Agency staff** (`cargoflow-mobile`): register-agency / join / login with
  `agencyCode` + shared agency password (bcrypt-hashed) + a per-user name
  unique within the agency. Roles: `owner` / `admin` / `staff`.
- **Drivers**: own collection, phone + password, nothing shared with agency staff.
- **Platform admins** (`cargoflow-admin`): email + password, no public signup.

Every access token is a JWT carrying an `aud` (audience) claim —
`agency-app` / `driver-app` / `admin-app` — checked explicitly by each app's
auth middleware, so a stolen agency-staff token can't be replayed against a
driver or admin route even though all three share one JWT secret. Refresh
tokens are opaque random strings, stored server-side only as a salted hash,
one row per (subject, audience, device); rotating (via `/refresh`) always
burns the presented token, so a replayed refresh token — stolen or reused
after the legitimate client already rotated — is rejected outright.

Changing an agency's shared password, deactivating a driver/admin, or
suspending an agency revokes every relevant refresh token immediately.

## What's real vs. what's a documented gap

Real, working, and exercised by an actual client contract above:
auth (all three apps), containers (list/detail/status/dates/create),
documents (presigned R2 upload + versioned register), importers, global
search + code-resolve, the full platform-admin surface (analytics, agencies,
payments, gateway devices, plans, drivers, admins), the driver job lifecycle
(assign → accept/decline → picked up → in transit → complete with photo +
signature + GPS), driver vehicles, ISO 6346 container-number validation
(real check-digit algorithm), a BIC owner-code carrier-guess table, a
deadline engine (free-storage/demurrage), and a daily digest (on-demand +
nightly cron) computed from real container/document data.

Documented, not built:

- **Live vessel tracking** — `POST /containers/:id/refresh-tracking` is real
  and wired up, but only refreshes the carrier *guess*; no live-position
  third-party tracking API is integrated (each carrier has its own,
  unspecified here).
- **Mobile-money auto-verification** — `POST /gateway/sms-notifications`
  parses and attempts to match a real SMS to a pending `Payment`
  (`src/services/smsParser.ts`), but the regexes are only tuned against
  publicly documented Orange Money / Afrimoney formats, not real captured
  messages. It moves a matched payment to `submitted`, not straight to
  `activated` — a platform admin still verifies via the dashboard.
- **Push notifications** for new driver job assignments.
- **Driver license/ID document upload screen** — the upload purpose and
  presigned-URL flow exist (`license_document`), no endpoint calls it yet
  because there's no driver-app source to wire it into.
- Per-agency configurable status pipeline / document types / deadline day
  counts — currently fixed constants (`agencyController.ts`,
  `attentionEngine.ts`), not stored per agency.

## Why no Mongo transactions

`docker-compose.yml` runs a single-node MongoDB, which doesn't support
multi-document transactions (that needs a replica set). Where an operation
spans two documents that must not end up half-done — `registerAgency`
creating an `Agency` then a `User` — the code manually deletes the first
document if the second write fails, rather than reaching for a transaction
this deployment can't run. If you switch to a replica-set Mongo (Atlas, for
example), consider swapping that pattern for a real transaction.
