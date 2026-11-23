# CargoFlow SMS Gateway (Android)

The phone-side half of mobile-money payment checks. It receives payment text messages on a phone and forwards the ones from senders you list to the Cargo Flow server (`POST /gateway/sms-notifications` with the device's API key). The server matches them to pending payments; anything it cannot match is kept for an admin to reconcile.

## Setup

1. In the admin dashboard, open **Gateway Devices**, add a device and copy its API key.
2. `cd gateway-app && npm install`, then build a development or production build (`eas build --platform android`). This app uses a native SMS module, so it does **not** run in Expo Go.
3. On the phone: enter the server address (ending `/api/v1`), the API key, and the sender names or numbers of the mobile-money services (for example `OrangeMoney, Afrimoney`). Save.
4. Tap **Start listening** and allow the SMS permission.

## What it does and does not do

- Forwards only messages from the senders you list. Everyone else's messages are never read, sent or stored; the log keeps only who they were from.
- Keeps every message queued until the server has it. No signal, a server error or a wrong key all keep it queued and it is retried; a message the server refuses as invalid is dropped and logged.
- Ignores the same message arriving twice.

## Limits you need to know

- **It only receives messages while the app is open.** The SMS library registers its receiver inside the running app and has no background service, and Android stops background apps. Use a dedicated phone, on charge, with the app open and the screen kept on (the app has a switch for that). Anything sent while the app was not running is not picked up.
- The SMS library (`@maniac-tech/react-native-expo-read-sms`) was last documented for Expo SDK 50. It is bundled and type-checked on SDK 57 here, but **whether it receives messages on a real phone running this React Native version has not been tested.** Test with a real SMS first.
- Google Play restricts SMS permissions to apps that are the default SMS handler or meet a narrow exception. Install this app directly (APK) on your own phone(s); do not plan on Play Store distribution.
- Only the message text is sent, because that is all the server's endpoint accepts. The server decides provider and amount from the text.
