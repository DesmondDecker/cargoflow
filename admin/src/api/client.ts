import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// The API address is read from /config.js when the page loads, so the same built files work on any server
// (edit config.js, no rebuild). VITE_API_BASE_URL is only the fallback.
export const baseURL = window.__CARGOFLOW__?.apiBaseUrl || (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:4000/api/v1';

// withCredentials: the refresh token is an httpOnly cookie the browser sends by itself.
// X-CargoFlow-Admin is required by the cookie endpoints (refresh, logout) as a CSRF guard.
export const api = axios.create({ baseURL, timeout: 15000, withCredentials: true });
const ADMIN_HEADER = { 'X-CargoFlow-Admin': '1' };

// The access token lives in page memory only: nothing is written to localStorage,
// so a script injected into the page cannot read a stored token. After a page reload
// the app gets a fresh one from the refresh cookie (see refreshSession).
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}
export function setAccessToken(token: string | null): void {
  accessToken = token;
}
export function clearTokens(): void {
  accessToken = null;
}

// Uses the refresh cookie to get a new access token. Returns the admin, or null if not signed in.
export async function refreshSession(): Promise<{ id: string; name: string; email: string; role?: string } | null> {
  try {
    const { data } = await axios.post(`${baseURL}/platform-admin/refresh`, {}, { withCredentials: true, headers: ADMIN_HEADER });
    accessToken = data.data.accessToken as string;
    return data.data.admin;
  } catch {
    accessToken = null;
    return null;
  }
}

export async function serverLogout(): Promise<void> {
  try {
    await api.post('/platform-admin/logout', {}, { headers: ADMIN_HEADER });
  } catch {
    // Already signed out or offline: the local token is dropped either way.
  }
}


let forceLogoutHandler: (() => void) | null = null;
export function setForceLogoutHandler(handler: () => void): void {
  forceLogoutHandler = handler;
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let pendingQueue: { resolve: (token: string) => void; reject: (err: unknown) => void }[] = [];

function flushQueue(error: unknown, token: string | null) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token);
    else reject(error);
  });
  pendingQueue = [];
}

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
      // The server rotates the refresh cookie on every use.
      const { data } = await axios.post(`${baseURL}/platform-admin/refresh`, {}, { withCredentials: true, headers: ADMIN_HEADER });
      const newAccessToken = data.data.accessToken as string;
      accessToken = newAccessToken;
      flushQueue(null, newAccessToken);
      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(original);
    } catch (refreshError) {
      flushQueue(refreshError, null);
      clearTokens();
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
