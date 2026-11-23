import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'cargoflow_driver_access_token';
const REFRESH_TOKEN_KEY = 'cargoflow_driver_refresh_token';

export const baseURL = (Constants.expoConfig?.extra?.apiBaseUrl as string) || 'http://localhost:4000/api/v1';

export const api = axios.create({ baseURL, timeout: 15000 });

export const getAccessToken = () => SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
export const getRefreshToken = () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY);

export async function setTokens(accessToken: string, refreshToken?: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

// Registered by the auth provider so a failed refresh returns the app to the
// sign-in screen instead of leaving a signed-out UI that 401s on every call.
let forceLogoutHandler: (() => void) | null = null;
export function setForceLogoutHandler(handler: () => void): void {
  forceLogoutHandler = handler;
}

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getAccessToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing: Promise<string> | null = null;

// One silent refresh on a 401. The backend rotates refresh tokens (the one
// used is revoked and a new one returned), so BOTH tokens are stored. Calls
// that fail while a refresh is in flight share that same refresh.
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const isAuthCall = original?.url?.includes('/driver/auth/');
    if (error.response?.status !== 401 || !original || original._retry || isAuthCall) return Promise.reject(error);
    original._retry = true;

    try {
      if (!refreshing) {
        refreshing = (async () => {
          const refreshToken = await getRefreshToken();
          if (!refreshToken) throw new Error('No refresh token');
          const { data } = await axios.post(`${baseURL}/driver/auth/refresh`, { refreshToken });
          await setTokens(data.data.accessToken as string, data.data.refreshToken as string);
          return data.data.accessToken as string;
        })().finally(() => {
          refreshing = null;
        });
      }
      const token = await refreshing;
      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${token}`;
      return api(original);
    } catch (refreshError) {
      await clearTokens();
      forceLogoutHandler?.();
      return Promise.reject(refreshError);
    }
  }
);

export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = (err.response?.data as { error?: { message?: string } } | undefined)?.error?.message;
    if (msg) return msg;
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) return 'The server took too long to respond. Please try again.';
    if (!err.response) return 'Cannot reach the server. Check your connection.';
  }
  if (err instanceof Error && err.message) return err.message;
  return 'Something went wrong. Please try again.';
}
