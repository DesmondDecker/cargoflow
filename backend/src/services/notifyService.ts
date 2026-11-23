import { DriverModel } from '../models/Driver';
import { UserModel } from '../models/User';
import { sendPushNotifications } from './pushService';

// Push helpers for events that happen between agencies and drivers. A push
// is a convenience, never part of the action that triggered it, so every
// failure here is swallowed: assigning, accepting or delivering a job must
// succeed even if Expo's push service is down or a device has no token.
export async function pushToDriver(driverId: unknown, title: string, body: string, data: Record<string, unknown>): Promise<void> {
  try {
    const driver = await DriverModel.findById(driverId);
    if (!driver?.pushToken || driver.notificationPrefs?.jobAlerts === false) return;
    await sendPushNotifications([{ to: driver.pushToken, title, body, data }]);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[notify] driver push failed', err);
  }
}

export async function pushToAgencyUser(userId: unknown, title: string, body: string, data: Record<string, unknown>): Promise<void> {
  try {
    if (!userId) return;
    const user = await UserModel.findById(userId);
    if (!user?.pushToken || !user.isActive || user.notificationPrefs?.driverUpdates === false) return;
    await sendPushNotifications([{ to: user.pushToken, title, body, data }]);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[notify] agency push failed', err);
  }
}

// A push the user has no switch for because it is about their own submission
// (for example Customs approving or returning a record they sent). It still
// requires an active account with a registered device.
export async function pushToUser(userId: unknown, title: string, body: string, data: Record<string, unknown>): Promise<void> {
  try {
    if (!userId) return;
    const user = await UserModel.findById(userId);
    if (!user?.pushToken || !user.isActive) return;
    await sendPushNotifications([{ to: user.pushToken, title, body, data }]);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[notify] user push failed', err);
  }
}
