import { create } from 'zustand';
import * as adminApi from '../api/adminApi';
import { setAccessToken, clearTokens, refreshSession, serverLogout, setForceLogoutHandler, apiErrorMessage } from '../api/client';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role?: string;
}

interface AuthState {
  status: 'checking' | 'signedOut' | 'signedIn';
  admin: AdminUser | null;
  loading: boolean;
  error: string | null;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'checking',
  admin: null,
  loading: false,
  error: null,

  bootstrap: async () => {
    // No token is stored in the browser. If the refresh cookie is still valid
    // the server hands back a new access token and the admin's identity.
    const admin = await refreshSession();
    if (!admin) {
      set({ status: 'signedOut', admin: null });
      return;
    }
    set({ status: 'signedIn', admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const result = await adminApi.login(email, password);
      setAccessToken(result.accessToken);
      set({ status: 'signedIn', admin: result.admin, loading: false });
    } catch (err) {
      set({ loading: false, error: apiErrorMessage(err) });
      throw err;
    }
  },

  logout: async () => {
    await serverLogout(); // revokes the refresh token and clears the cookie
    clearTokens();
    set({ status: 'signedOut', admin: null });
  },
}));

setForceLogoutHandler(() => {
  useAuthStore.setState({ status: 'signedOut', admin: null });
});
