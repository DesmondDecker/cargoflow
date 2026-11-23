import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { api, baseURL, getAccessToken } from '../api/client';

// Downloads a file the API serves to signed-in users and hands it to the
// phone's share sheet. A cheap authenticated call goes first so an expired
// login is refreshed before the download, which does not go through axios.
export async function downloadAndShare(path: string, fileName: string, mimeType: string, title: string): Promise<void> {
  await api.get('/auth/me');
  const token = await getAccessToken();
  const file = await File.downloadFileAsync(`${baseURL}${path}`, new File(Paths.cache, fileName), { headers: { Authorization: `Bearer ${token}` }, idempotent: true });
  if (!(await Sharing.isAvailableAsync())) throw new Error(`Saved to ${file.uri}, but sharing is not available on this device.`);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: title });
}
