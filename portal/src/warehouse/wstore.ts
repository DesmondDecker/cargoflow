import { create } from 'zustand';
import * as wapi from './wapi';
import { clearWarehouseTokens, getWarehouseToken, setWarehouseLogoutHandler, setWarehouseTokens } from './wclient';
import { apiErrorMessage } from '../api/client';

interface State {
  status: 'checking' | 'signedOut' | 'signedIn';
  warehouse: wapi.Warehouse | null;
  loading: boolean;
  error: string | null;
  bootstrap: () => Promise<void>;
  signIn: (phone: string, password: string) => Promise<void>;
  signUp: (input: Parameters<typeof wapi.signup>[0]) => Promise<void>;
  refresh: () => Promise<void>;
  setWarehouse: (w: wapi.Warehouse) => void;
  signOut: () => void;
}

export const useWarehouseStore = create<State>((set) => {
  setWarehouseLogoutHandler(() => set({ status: 'signedOut', warehouse: null }));
  return {
    status: 'checking',
    warehouse: null,
    loading: false,
    error: null,
    bootstrap: async () => {
      if (!getWarehouseToken()) return set({ status: 'signedOut' });
      try {
        set({ status: 'signedIn', warehouse: await wapi.me() });
      } catch {
        clearWarehouseTokens();
        set({ status: 'signedOut' });
      }
    },
    signIn: async (phone, password) => {
      set({ loading: true, error: null });
      try {
        const r = await wapi.login(phone, password);
        setWarehouseTokens(r.accessToken, r.refreshToken);
        set({ status: 'signedIn', warehouse: r.warehouse, loading: false });
      } catch (err) {
        set({ loading: false, error: apiErrorMessage(err) });
        throw err;
      }
    },
    signUp: async (input) => {
      set({ loading: true, error: null });
      try {
        const r = await wapi.signup(input);
        setWarehouseTokens(r.accessToken, r.refreshToken);
        set({ status: 'signedIn', warehouse: r.warehouse, loading: false });
      } catch (err) {
        set({ loading: false, error: apiErrorMessage(err) });
        throw err;
      }
    },
    refresh: async () => set({ warehouse: await wapi.me() }),
    setWarehouse: (warehouse) => set({ warehouse }),
    signOut: () => {
      clearWarehouseTokens();
      set({ status: 'signedOut', warehouse: null });
    },
  };
});
