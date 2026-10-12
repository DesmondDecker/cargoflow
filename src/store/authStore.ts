import { create } from 'zustand';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { AgencySummary, AuthUser } from '../types/api';
import * as authApi from '../api/authApi';
import { setTokens, clearTokens, getAccessToken, setForceLogoutHandler, setSubscriptionInactiveHandler } from '../api/client';

interface AuthState {
  status: 'checking' | 'signedOut' | 'signedIn';
  user: AuthUser | null;
  agency: AgencySummary | null;
  error: string | null;
  loading: boolean;
  subscriptionInactive: boolean;
  bootstrap: () => Promise<void>;
  registerAgency: (input: Omit<Parameters<typeof authApi.registerAgency>[0], 'deviceId'>) => Promise<void>;
  joinAgency: (input: Omit<Parameters<typeof authApi.joinAgency>[0], 'deviceId'>) => Promise<void>;
  login: (input: Omit<Parameters<typeof authApi.login>[0], 'deviceId'>) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  dismissSubscriptionInactive: () => void;
}

function getDeviceId(): string {
  // Best-effort stable device identifier; falls back to a per-session id
  // on platforms/setups where a native identifier isn't available.
  if (Platform.OS === 'android') return Application.getAndroidId?.() || 'android-unknown-device';
  return Application.applicationId || 'device-unknown';
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'checking',
  user: null,
  agency: null,
  error: null,
  loading: false,
  subscriptionInactive: false,

  bootstrap: async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        set({ status: 'signedOut' });
        return;
      }
      const me = await authApi.fetchMe();
      set({ status: 'signedIn', user: me.user, agency: me.agency, subscriptionInactive: false });
    } catch {
      await clearTokens();
      set({ status: 'signedOut' });
    }
  },

  registerAgency: async (input) => {
    set({ loading: true, error: null });
    try {
      const result = await authApi.registerAgency({ ...input, deviceId: getDeviceId() });
      await setTokens(result.accessToken, result.refreshToken);
      set({ status: 'signedIn', user: result.user, agency: result.agency, loading: false, subscriptionInactive: false });
    } catch (err) {
      set({ loading: false, error: extractMessage(err) });
      throw err;
    }
  },

  joinAgency: async (input) => {
    set({ loading: true, error: null });
    try {
      const result = await authApi.joinAgency({ ...input, deviceId: getDeviceId() });
      await setTokens(result.accessToken, result.refreshToken);
      set({ status: 'signedIn', user: result.user, agency: result.agency, loading: false, subscriptionInactive: false });
    } catch (err) {
      set({ loading: false, error: extractMessage(err) });
      throw err;
    }
  },

  login: async (input) => {
    set({ loading: true, error: null });
    try {
      const result = await authApi.login({ ...input, deviceId: getDeviceId() });
      await setTokens(result.accessToken, result.refreshToken);
      set({ status: 'signedIn', user: result.user, agency: result.agency, loading: false, subscriptionInactive: false });
    } catch (err) {
      set({ loading: false, error: extractMessage(err) });
      throw err;
    }
  },

  logout: async () => {
    await clearTokens();
    set({ status: 'signedOut', user: null, agency: null });
  },

  clearError: () => set({ error: null }),

  dismissSubscriptionInactive: () => set({ subscriptionInactive: false }),
}));

function extractMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const response = (err as { response?: { data?: { error?: { message?: string } } } }).response;
    if (response?.data?.error?.message) return response.data.error.message;
  }
  return 'Something went wrong. Please try again.';
}

// Wired up once at module load: if the API client's silent refresh
// ultimately fails (refresh token expired/revoked), flip the store back to
// signed-out so the UI actually navigates to the login flow instead of
// sitting on the main app with every request quietly failing.
setForceLogoutHandler(() => {
  useAuthStore.setState({ status: 'signedOut', user: null, agency: null });
});

setSubscriptionInactiveHandler(() => {
  useAuthStore.setState({ subscriptionInactive: true });
});
