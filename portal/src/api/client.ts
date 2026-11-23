import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const ACCESS_TOKEN_KEY = 'cargoflow_portal_access_token';
const REFRESH_TOKEN_KEY = 'cargoflow_portal_refresh_token';

// The API address is read from /config.js when the page loads, so the same built files work on any server
// (edit config.js, no rebuild). VITE_API_BASE_URL is only the fallback.
export const baseURL = window.__CARGOFLOW__?.apiBaseUrl || (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:4000/api/v1';

export const api = axios.create({ baseURL, timeout: 20000 });

export const getAccessToken = (): string | null => sessionStorage.getItem(ACCESS_TOKEN_KEY);
const getRefreshToken = (): string | null => sessionStorage.getItem(REFRESH_TOKEN_KEY);

// Tokens live in sessionStorage, not localStorage: this portal is used at
// shared government workstations, so closing the tab ends the session.
export function setTokens(accessToken: string, refreshToken?: string): void {
  sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}
export function clearTokens(): void {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
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

let refreshing: Promise<string> | null = null;

// One silent refresh on a 401. The server rotates refresh tokens (the one used
// is revoked and a new one returned), so both are stored. Calls that fail
// while a refresh is in flight share it.
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const isAuthCall = original?.url?.includes('/institution/auth/login') || original?.url?.includes('/institution/auth/refresh');
    if (error.response?.status !== 401 || !original || original._retry || isAuthCall) return Promise.reject(error);
    original._retry = true;
    try {
      if (!refreshing) {
        refreshing = (async () => {
          const refreshToken = getRefreshToken();
          if (!refreshToken) throw new Error('No refresh token');
          const { data } = await axios.post(`${baseURL}/institution/auth/refresh`, { refreshToken });
          setTokens(data.data.accessToken as string, data.data.refreshToken as string);
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
      clearTokens();
      forceLogoutHandler?.();
      return Promise.reject(refreshError);
    }
  }
);

export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = (err.response?.data as { error?: { message?: string } } | undefined)?.error?.message;
    if (msg) return msg;
    if (err.message === 'Network Error') return 'Cannot reach the server. Check your connection.';
  }
  return 'Something went wrong. Please try again.';
}
