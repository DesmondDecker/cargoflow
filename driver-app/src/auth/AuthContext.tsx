import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { clearTokens, getAccessToken, setForceLogoutHandler } from '../api/client';
import * as driverApi from '../api/driverApi';
import { Driver } from '../types';
import { startSync } from '../offline/sync';
import { clearAllQueued } from '../offline/queue';
import { clearJobCache } from '../offline/jobCache';
import { clearPushToken, registerForPushNotifications } from '../notifications/pushRegistration';

interface AuthState {
  driver: Driver | null;
  booting: boolean;
  login: (phone: string, password: string) => Promise<void>;
  signup: (name: string, phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setDriver: (driver: Driver) => void;
  reloadDriver: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [booting, setBooting] = useState(true);

  const logout = useCallback(async () => {
    await clearPushToken(); // while the session is still valid
    await clearTokens();
    // The next person to sign in on this phone must not see this driver's jobs.
    await Promise.all([clearJobCache(), clearAllQueued()]);
    setDriver(null);
  }, []);

  const driverId = driver?.id;
  useEffect(() => {
    if (!driverId) return undefined;
    registerForPushNotifications(); // best effort; Settings shows the outcome
    return startSync();
  }, [driverId]);

  useEffect(() => {
    setForceLogoutHandler(() => setDriver(null));
    (async () => {
      try {
        if (await getAccessToken()) setDriver(await driverApi.fetchMe());
      } catch {
        // Not signed in, or the stored session is no longer valid.
        setDriver(null);
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      driver,
      booting,
      login: async (phone, password) => setDriver(await driverApi.login(phone, password)),
      signup: async (name, phone, password) => setDriver(await driverApi.signup(name, phone, password)),
      logout,
      setDriver,
      reloadDriver: async () => setDriver(await driverApi.fetchMe()),
    }),
    [driver, booting, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
