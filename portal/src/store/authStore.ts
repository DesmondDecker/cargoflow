import { create } from 'zustand';
import * as portalApi from '../api/portalApi';
import { apiErrorMessage, clearTokens, getAccessToken, setForceLogoutHandler, setTokens } from '../api/client';

interface AuthState {
  status: 'checking' | 'signedOut' | 'signedIn';
  user: portalApi.PortalUser | null;
  loading: boolean;
  error: string | null;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => {
  setForceLogoutHandler(() => set({ status: 'signedOut', user: null }));
  return {
    status: 'checking',
    user: null,
    loading: false,
    error: null,

    bootstrap: async () => {
      if (!getAccessToken()) return set({ status: 'signedOut' });
      try {
        set({ status: 'signedIn', user: await portalApi.me() });
      } catch {
        clearTokens();
        set({ status: 'signedOut' });
      }
    },

    login: async (email, password) => {
      set({ loading: true, error: null });
      try {
        const result = await portalApi.login(email, password);
        setTokens(result.accessToken, result.refreshToken);
        set({ status: 'signedIn', user: result.user, loading: false });
      } catch (err) {
        set({ loading: false, error: apiErrorMessage(err) });
        throw err;
      }
    },

    logout: async () => {
      try {
        await portalApi.logout();
      } catch {
        // Signing out locally still has to work if the server cannot be reached.
      }
      clearTokens();
      set({ status: 'signedOut', user: null });
    },
  };
});
