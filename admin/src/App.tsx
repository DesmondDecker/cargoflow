import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { AgenciesPage } from './pages/AgenciesPage';
import { DriversPage } from './pages/DriversPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { GatewayDevicesPage } from './pages/GatewayDevicesPage';
import { TeamPage } from './pages/TeamPage';

function RequireAuth({ children }: { children: React.ReactElement }) {
  const status = useAuthStore((s) => s.status);
  if (status === 'checking') return null;
  if (status === 'signedOut') return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  if (status === 'checking') return null;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="agencies" element={<AgenciesPage />} />
          <Route path="drivers" element={<DriversPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="gateway-devices" element={<GatewayDevicesPage />} />
          <Route path="team" element={<TeamPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
