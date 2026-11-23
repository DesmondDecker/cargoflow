# CargoFlow Driver

Expo app for truck drivers, built against the backend's existing `/driver/*` routes.

## Expo SDK 57

React Native 0.86.3, React 19.2.3, TypeScript 6. Typechecks, passes its tests and bundles for Android; not run on a device. Notifications need a development or production build and an EAS project id.

## Run

```
cd driver-app
npm install
EXPO_PUBLIC_API_BASE_URL=https://<your-api>/api/v1 npx expo start
```

Use your computer's address or the deployed API, not `localhost`, when testing on a phone.

## What it does

- Sign up / sign in with phone and password (sessions refresh automatically)
- Open jobs list (refreshes every 30 s while open) and job history, with a greeting and counts
- Works offline: jobs and history are saved on the phone, and accept, decline, picked up, in transit and complete-delivery (photo and signature included) are saved and sent automatically when the connection returns. Anything the server rejects is listed in Settings.
- New-job notifications, and a tap opens the job
- Earnings: agreed fees for delivered jobs by week, month and all time (agreed amounts, not payments)
- Settings: notification switch, offline status, account, sign out
- Accept or decline a job, mark picked up, start trip
- Complete delivery: photo (required), receiver signature (optional), GPS location, notes
- Availability switch, vehicles, rating
- Verification request with a licence photo; an admin approves it in the admin app (Drivers page)

## Needs on the server

- `R2_*` storage env vars, or photo, signature and licence uploads fail with 501
- A platform admin to approve drivers. Agencies only see verified drivers.

- Notifications need `expo.extra.eas.projectId` in `app.json` (run `eas init`) and a development or production build.
- Earnings only count jobs where the agency entered a fee when assigning the driver.

## Not built

- Payments between agency and driver (earnings are agreed fees, not a payment record)
- Offline sign-up, sign-in, availability changes and verification requests (these need a connection)
