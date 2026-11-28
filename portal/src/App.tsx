import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { QueuePage } from './pages/QueuePage';
import { RecordPage } from './pages/RecordPage';
import { NewRecordPage } from './pages/NewRecordPage';
import { ApprovedPage } from './pages/ApprovedPage';
import { ReportsPage } from './pages/ReportsPage';
import { OversightPage } from './pages/OversightPage';
import { WarehouseApp } from './warehouse/WarehouseApp';
import { LandingPage } from './pages/LandingPage';

function RequireAuth({ children }: { children: React.ReactElement }) {
  const status = useAuthStore((s) => s.status);
  if (status === 'signedOut') return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  if (status === 'checking') return null;
  const home = user?.institution === 'customs' ? '/queue' : '/approved';

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={status === 'signedIn' ? <Navigate to={home} replace /> : <LandingPage />} />
        <Route path="/warehouse/*" element={<WarehouseApp />} />
        <Route path="/login" element={status === 'signedIn' ? <Navigate to={home} replace /> : <LoginPage />} />
        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          {user?.institution === 'customs' ? (
            <>
              <Route path="/queue" element={<QueuePage />} />
              <Route path="/queue/:id" element={<RecordPage mode="review" />} />
              <Route path="/new" element={<NewRecordPage />} />
            </>
          ) : null}
          <Route path="/approved" element={<ApprovedPage />} />
          <Route path="/approved/:id" element={<RecordPage mode="approved" />} />
          <Route path="/reports" element={<ReportsPage />} />
          {user?.isSupervisor ? <Route path="/oversight" element={<OversightPage />} /> : null}
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
