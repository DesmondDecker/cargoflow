import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'cargoflow_access_token';
const REFRESH_TOKEN_KEY = 'cargoflow_refresh_token';

const baseURL = (Constants.expoConfig?.extra?.apiBaseUrl as string) || 'http://localhost:4000/api/v1';

export const api = axios.create({ baseURL, timeout: 15000 });

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function setTokens(accessToken: string, refreshToken?: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

// Set by the auth store at startup, so this plain module (no React/zustand
// import here, to avoid a client.ts <-> authStore.ts <-> authApi.ts <->
// client.ts circular import) can still force the app back to the signed-out
// screen when a refresh ultimately fails — without this, the tokens get
// cleared but the UI has no idea and keeps rendering the main app while
// every subsequent request quietly 401s.
let forceLogoutHandler: (() => void) | null = null;
export function setForceLogoutHandler(handler: () => void): void {
  forceLogoutHandler = handler;
}

// Same pattern, for when the backend blocks a request because the agency's
// subscription is inactive (a platform admin deactivated it). Registered by
// the auth store; checked on every response so any screen's API call can
// trigger the blocking "subscription inactive" screen, not just a specific
// one.
let subscriptionInactiveHandler: (() => void) | null = null;
export function setSubscriptionInactiveHandler(handler: () => void): void {
  subscriptionInactiveHandler = handler;
}

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getAccessToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    const code = (error.response?.data as { error?: { code?: string } } | undefined)?.error?.code;
    if (error.response?.status === 402 && code === 'SUBSCRIPTION_INACTIVE') {
      subscriptionInactiveHandler?.();
    }
    return Promise.reject(error);
  }
);

let isRefreshing = false;
let pendingQueue: { resolve: (token: string) => void; reject: (err: unknown) => void }[] = [];

function flushQueue(error: unknown, token: string | null) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token);
    else reject(error);
  });
  pendingQueue = [];
}

// On a 401, try exactly one silent refresh before giving up — queues any
// requests that fail while a refresh is already in flight rather than
// firing a refresh call per request.
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (error.response?.status !== 401 || !original || original._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({
          resolve: (token) => {
            original.headers = original.headers || {};
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          },
          reject,
        });
      });
    }

    original._retry = true;
    isRefreshing = true;
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) throw new Error('No refresh token');
      const { data } = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
      const newAccessToken = data.data.accessToken as string;
      await setTokens(newAccessToken);
      flushQueue(null, newAccessToken);
      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(original);
    } catch (refreshError) {
      flushQueue(refreshError, null);
      await clearTokens();
      forceLogoutHandler?.();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = (err.response?.data as { error?: { message?: string } } | undefined)?.error?.message;
    if (msg) return msg;
    if (err.message === 'Network Error') return 'Cannot reach the server — check your connection.';
  }
  return 'Something went wrong. Please try again.';
}
