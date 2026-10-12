# CargoFlow Admin Dashboard

Internal web console for Summit Technologies — not for clearing agencies or drivers. React + Vite + TypeScript, talking to the same `cargoflow-backend` API via the `platform-admin` routes.

## Setup

```bash
npm install
cp .env.example .env   # set VITE_API_BASE_URL to your backend
npm run dev
```

Log in with a `PlatformAdmin` account. There's no public registration — create the first one on the backend with:
```bash
PLATFORM_ADMIN_EMAIL=you@summittech.sl PLATFORM_ADMIN_PASSWORD=... PLATFORM_ADMIN_NAME="Your Name" npm run seed
```
(run from `cargoflow-backend`, not here).

## What's here

- **Dashboard** — platform-wide analytics: agency counts by subscription status, revenue (total + by month, from activated payments only), the payments pipeline (pending/submitted/verified/activated/rejected counts), new agencies in the last 30 days, payments waiting on manual review, and total containers tracked platform-wide.
- **Agencies** — every agency, filterable by subscription status, with **Activate** / **Disable** buttons that call `PATCH /platform-admin/agencies/:id/subscription` directly — a manual override that bypasses the payment flow entirely (for corrections, goodwill extensions, or cutting off access immediately). Both actions require a confirmation modal since they take effect immediately.
- **Payments** — the manual-review queue for anything the automated SMS matcher couldn't confirm. Verify (issues the same activation-code flow as an auto-match) or reject with a reason.
- **Gateway Devices** — register the office phone(s) authorized to forward mobile money SMS. Creating one shows the API key exactly once — copy it into the forwarding app's config before closing the dialog, since it can't be retrieved again (only revoked and replaced with a new device).
- **Drivers** — every driver on the platform, searchable by name/phone, with a **Reset Password** action for a locked-out driver.
- **Team** — your own password change (self-service, requires your current password), and adding/deactivating other Summit Technologies admin accounts. There's no public registration for platform admins by design — this page and the backend seed script are the only ways in.

Password resets on the **Agencies** page (shared agency password) and **Drivers** page (individual driver password) are recovery paths, not self-service — there's no "forgot password" email/SMS flow wired up yet, so this is how a locked-out customer actually gets back in: they contact support, an admin verifies who they are some other way (phone call, ID check — that verification happens outside this system), then resets it here and relays the new password directly. Both immediately revoke existing sessions.

## Design

Same orange/white/dark-navy brand as the mobile app, done in plain CSS custom properties (`src/theme/global.css`) rather than a component library — this is a small internal tool, not worth a design-system dependency.

## Auth

JWT access/refresh, same pattern as the mobile app: tokens in `localStorage` (acceptable here since this is an internal tool on trusted machines, not a customer-facing app), automatic silent refresh on a 401, forced sign-out if the refresh itself fails.

## Not built yet

- Editing subscription plans (currently static config on the backend — `GET /platform-admin/plans` is read-only here)
- Audit log view (the backend already logs every admin action via `ActivityLog`, just no UI for browsing it yet)
- Any charts beyond the simple bar visualization for revenue — fine for now, would need a real charting library if the data volume grows

## Deploying

```bash
docker build --build-arg VITE_API_BASE_URL=https://api.yourdomain.sl/api/v1 -t cargoflow-admin .
docker run -p 8080:80 cargoflow-admin
```

Serves the built SPA via nginx with client-side routing fallback (`nginx.conf`) — refreshing on `/agencies` or any other route won't 404. Put this behind the same HTTPS reverse proxy as the backend, on its own subdomain (e.g. `admin.yourdomain.sl`), and make sure it's not publicly linked from anywhere customer-facing — this is an internal tool.
