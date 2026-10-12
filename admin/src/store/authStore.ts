import { create } from 'zustand';
import * as adminApi from '../api/adminApi';
import { getAccessToken, setTokens, clearTokens, setForceLogoutHandler, apiErrorMessage } from '../api/client';

interface AdminUser {
  id: string;
  name: string;
  email: string;
}

interface AuthState {
  status: 'checking' | 'signedOut' | 'signedIn';
  admin: AdminUser | null;
  loading: boolean;
  error: string | null;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'checking',
  admin: null,
  loading: false,
  error: null,

  bootstrap: async () => {
    const token = getAccessToken();
    if (!token) {
      set({ status: 'signedOut' });
      return;
    }
    // A token being present isn't enough on its own — fetch the actual
    // admin identity so `admin` in the store is correct after a page
    // refresh, not just null with a stale-looking signed-in status. This
    // also doubles as a validity check: an expired/revoked token here
    // triggers the client's refresh flow, and if that fails too, the
    // forceLogoutHandler flips status back to signedOut.
    try {
      const admin = await adminApi.fetchOwnAdminProfile();
      set({ status: 'signedIn', admin: { id: admin._id || admin.id || '', name: admin.name, email: admin.email } });
    } catch {
      clearTokens();
      set({ status: 'signedOut' });
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const result = await adminApi.login(email, password);
      setTokens(result.accessToken, result.refreshToken);
      set({ status: 'signedIn', admin: result.admin, loading: false });
    } catch (err) {
      set({ loading: false, error: apiErrorMessage(err) });
      throw err;
    }
  },

  logout: () => {
    clearTokens();
    set({ status: 'signedOut', admin: null });
  },
}));

setForceLogoutHandler(() => {
  useAuthStore.setState({ status: 'signedOut', admin: null });
});
