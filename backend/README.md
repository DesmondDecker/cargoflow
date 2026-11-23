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

- **Agency staff** (`cargoflow-mobile`): the shared agency password only lets
  new staff **join**. Everyone logs in with `agencyCode` + their name or phone
  + **their own 6-digit PIN** (bcrypt-hashed, 5 wrong tries locks that account
  for 15 minutes). Roles: `owner` / `admin` / `staff`. An owner (or an admin,
  for staff) can reset a teammate's PIN; a platform admin can reset an agency's
  only owner. Accounts created before PINs existed cannot sign in until given
  one: `npm run reset:pin -- <AGENCY_CODE> "<name or phone>" <PIN>`.
- **Drivers**: own collection, phone + password, nothing shared with agency staff.
- **Platform admins** (`cargoflow-admin`): email + password, no public signup.
  Roles: `super_admin` (everything, plus other admins, audit log, gateway phones),
  `finance` (payments, expenses, plans, subscriptions, sponsorships), `support`
  (agencies, drivers, warehouses, customs/AGL users), `viewer` (read-only). An
  account with no stored role is treated as `super_admin`, so upgrading locks
  nobody out. The last active super admin cannot be demoted or deactivated.
  The dashboard keeps the refresh token in an httpOnly cookie and the access
  token in memory only (see `ADMIN_COOKIE_SAMESITE`).

Every access token is a JWT carrying an `aud` (audience) claim —
`agency-app` / `driver-app` / `admin-app` — checked explicitly by each app's
auth middleware, so a stolen agency-staff token can't be replayed against a
driver or admin route even though all three share one JWT secret. Refresh
tokens are opaque random strings, stored server-side only as a salted hash,
one row per (subject, audience, device); rotating (via `/refresh`) always
burns the presented token, so a replayed refresh token — stolen or reused
after the legitimate client already rotated — is rejected outright.

Changing your own PIN, resetting someone's PIN, deactivating a driver/admin/user, or
suspending an agency revokes the relevant refresh tokens immediately. Changing the
agency join password does not sign anyone out.

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

- **Live vessel tracking** — a lookup chain exists (carrier API, MarineTraffic,
  public-page scraper, then generic public tracking; see
  `src/services/tracking/registry.ts` and `.env.example`) but no credentials
  are configured by default, so out of the box it only identifies the carrier
  and links its public page. Maersk's gateway rejected the keys tried so far.
- **Mobile-money auto-verification** — the phone-side app now exists (`../gateway-app`, foreground only, untested on a device). `POST /gateway/sms-notifications`
  parses and attempts to match a real SMS to a pending `Payment`
  (`src/services/smsParser.ts`), but the regexes are only tuned against
  publicly documented Orange Money / Afrimoney formats, not real captured
  messages. It moves a matched payment to `submitted`, not straight to
  `activated` — a platform admin still verifies via the dashboard.
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


## Supervisors' oversight log (Customs and AGL)

Every request a signed-in Customs or AGL user makes is written by the server to `InstitutionAuditLog`: sign-ins (including failed ones, with the email tried), records opened, approvals and returns (with the reason or approval reference), records entered for an agent, CSV downloads, report views, password changes, and refused attempts such as AGL reaching for the Customs queue. Timer-driven list refreshes are skipped so they don't bury the real entries. A route nobody listed is still logged under its method and path.

- **Append-only:** the model refuses updates and deletes and no route offers them. (Someone with direct database access can still change data; protect the database accordingly.)
- **Supervisors:** a platform admin ticks "Make supervisor" on a Customs/AGL account (`isSupervisor`). That person gets a *Staff activity* page in the portal showing their own institution's staff only: a 30-day summary per person (approvals, returns, records opened, downloads, refused requests, failed sign-ins, records the same officer entered and approved) and the full filterable log, with CSV export. Supervisors' own views of the log are logged too.
- **Platform view:** super admins see both institutions, supervisors included, under *Customs & AGL activity* in the admin dashboard (`GET /platform-admin/institution-audit`).
- **Not covered:** nothing is logged for a request with no valid login (no identity to record). Supervisors keep their normal Customs/AGL permissions; the log is a record, not a separation of duties.
