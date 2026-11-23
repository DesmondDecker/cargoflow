import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { baseURL } from '../api/client';

// A second API client for warehouse owners. They are not Customs or AGL staff:
// their own accounts, tokens (kept under different keys) and refresh endpoint.
const ACCESS = 'cargoflow_warehouse_access_token';
const REFRESH = 'cargoflow_warehouse_refresh_token';

export const wapi = axios.create({ baseURL, timeout: 20000 });

export const getWarehouseToken = (): string | null => sessionStorage.getItem(ACCESS);
export function setWarehouseTokens(access: string, refresh?: string): void {
  sessionStorage.setItem(ACCESS, access);
  if (refresh) sessionStorage.setItem(REFRESH, refresh);
}
export function clearWarehouseTokens(): void {
  sessionStorage.removeItem(ACCESS);
  sessionStorage.removeItem(REFRESH);
}

let onForceLogout: (() => void) | null = null;
export function setWarehouseLogoutHandler(handler: () => void): void {
  onForceLogout = handler;
}

wapi.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getWarehouseToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing: Promise<string> | null = null;

// Same rule as everywhere: the server rotates refresh tokens, so both are stored.
wapi.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const isAuth = original?.url?.includes('/warehouse/auth/');
    if (error.response?.status !== 401 || !original || original._retry || isAuth) return Promise.reject(error);
    original._retry = true;
    try {
      if (!refreshing) {
        refreshing = (async () => {
          const refreshToken = sessionStorage.getItem(REFRESH);
          if (!refreshToken) throw new Error('No refresh token');
          const { data } = await axios.post(`${baseURL}/warehouse/auth/refresh`, { refreshToken });
          setWarehouseTokens(data.data.accessToken as string, data.data.refreshToken as string);
          return data.data.accessToken as string;
        })().finally(() => {
          refreshing = null;
        });
      }
      const token = await refreshing;
      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${token}`;
      return wapi(original);
    } catch (e) {
      clearWarehouseTokens();
      onForceLogout?.();
      return Promise.reject(e);
    }
  }
);
