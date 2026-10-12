import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { setPushToken } from '../api/authApi';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// A real Expo push token (the kind that reaches a device over the network,
// as opposed to a local-only notification) requires an EAS project ID —
// Expo's push service has needed this since the FCM v1 migration. There is
// no way to generate a working one from inside this app; it comes from
// running `eas init` (or creating a project at expo.dev) once, which sets
// expo.extra.eas.projectId in app.json. Until that's a real ID, this
// function fails fast and silently rather than crashing the app or sending
// a token the backend can never actually deliver to.
export async function registerForPushNotifications(): Promise<void> {
  if (!Device.isDevice) {
    return; // push tokens don't exist on simulators/emulators
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId || projectId === 'REPLACE_WITH_YOUR_EAS_PROJECT_ID') {
    // eslint-disable-next-line no-console
    console.warn('[push] Skipping push registration: no EAS project ID configured in app.json (expo.extra.eas.projectId). Run `eas init` first.');
    return;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return; // user declined — nothing to register, and we don't nag them here
  }

  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    await setPushToken(tokenResponse.data);
  } catch (err) {
    // Registration failing must not block sign-in or crash the app — the
    // person just won't get push reminders until this succeeds on a later
    // launch.
    // eslint-disable-next-line no-console
    console.warn('[push] Failed to register push token', err);
  }
}

export async function clearPushToken(): Promise<void> {
  try {
    await setPushToken(null);
  } catch {
    // Best-effort on logout — an old token lingering server-side until it's
    // next overwritten isn't worth failing the sign-out over.
  }
}
