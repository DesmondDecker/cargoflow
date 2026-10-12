import axios from 'axios';

// Expo's push service: free, no API key needed for basic sending (an
// optional access token adds enhanced security/receipts — not required to
// function). This is a real integration — POSTs to Expo's actual endpoint —
// but it only ever reaches a device that has itself registered a genuine
// Expo push token via the mobile app; nothing here can be tested against a
// real device from this environment.
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100; // Expo's own documented max per request

export interface PushMessage {
  to: string; // Expo push token, e.g. "ExponentPushToken[xxxxxxxx]"
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

function isExpoPushToken(token: string | undefined): token is string {
  return !!token && /^Expo(nent)?PushToken\[.+\]$/.test(token);
}

export async function sendPushNotifications(messages: PushMessage[]): Promise<void> {
  const valid = messages.filter((m) => isExpoPushToken(m.to));
  if (valid.length === 0) return;

  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    const batch = valid.slice(i, i + BATCH_SIZE);
    try {
      await axios.post(
        EXPO_PUSH_URL,
        batch.map((m) => ({ to: m.to, title: m.title, body: m.body, data: m.data, sound: 'default' })),
        { headers: { 'content-type': 'application/json', accept: 'application/json' }, timeout: 10000 }
      );
    } catch (err) {
      // A failed push batch must not take down the caller (a cron job) —
      // log and move on to the next batch/agency rather than throwing.
      // eslint-disable-next-line no-console
      console.error('[push] batch send failed', axios.isAxiosError(err) ? err.response?.data || err.message : err);
    }
  }
}
