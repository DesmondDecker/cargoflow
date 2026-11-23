import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { setPushToken } from '../api/driverApi';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type PushResult = 'registered' | 'no-device' | 'no-project' | 'denied' | 'failed';

// Registers this phone for new-job notifications. A real Expo push token needs
// an EAS project id (run `eas init`, which fills expo.extra.eas.projectId in
// app.json). Until then, or on a simulator, or if the driver refuses the
// permission, nothing is registered and the result says why.
export async function registerForPushNotifications(): Promise<PushResult> {
  if (!Device.isDevice) return 'no-device';
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId || projectId === 'REPLACE_WITH_YOUR_EAS_PROJECT_ID') return 'no-project';

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'default', importance: Notifications.AndroidImportance.HIGH });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return 'denied';

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    await setPushToken(token.data);
    return 'registered';
  } catch {
    return 'failed';
  }
}

export async function clearPushToken(): Promise<void> {
  try {
    await setPushToken(null);
  } catch {
    // Best effort at sign-out: a stale token is overwritten the next time any driver registers this phone.
  }
}
