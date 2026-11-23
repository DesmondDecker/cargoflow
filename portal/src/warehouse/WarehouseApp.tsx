import React, { useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { useWarehouseStore } from './wstore';
import { WarehouseBookingsPage } from './WarehouseBookingsPage';
import { WarehouseListingPage } from './WarehouseListingPage';
import { AMENITIES } from './wapi';

function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const { signIn, signUp, loading, error } = useWarehouseStore();
  const navigate = useNavigate();
  const [f, setF] = useState({ ownerName: '', phone: '', password: '', businessName: '', location: '', capacityUnit: 'container_slot' as 'sqm' | 'container_slot', totalCapacity: '', pricePerUnitPerDay: '' });
  const [amenities, setAmenities] = useState<string[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    try {
      if (mode === 'login') await signIn(f.phone.trim(), f.password);
      else {
        if (f.password.length < 8) return setLocalError('Password must be at least 8 characters.');
        await signUp({ ownerName: f.ownerName.trim(), phone: f.phone.trim(), password: f.password, businessName: f.businessName.trim(), location: f.location.trim(), capacityUnit: f.capacityUnit, totalCapacity: Number(f.totalCapacity), pricePerUnitPerDay: Number(f.pricePerUnitPerDay), amenities });
      }
      navigate('/warehouse', { replace: true });
    } catch {
      // the store holds the server's message
    }
  };

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit} style={{ maxWidth: mode === 'signup' ? 520 : undefined }}>
        <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--navy)', marginBottom: 4 }}>Cargo Flow warehouses</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>{mode === 'login' ? 'Sign in to manage your listing and bookings' : 'List your storage space for clearing agents'}</div>
        {mode === 'signup' ? (
          <>
            <div className="field"><label>Your name</label><input value={f.ownerName} onChange={set('ownerName')} /></div>
            <div className="field"><label>Business name</label><input value={f.businessName} onChange={set('businessName')} /></div>
            <div className="field"><label>Location (area and address)</label><input value={f.location} onChange={set('location')} /></div>
          </>
        ) : null}
        <div className="field"><label>Phone number</label><input value={f.phone} onChange={set('phone')} autoComplete="username" /></div>
        <div className="field"><label>Password{mode === 'signup' ? ' (8+ characters)' : ''}</label><input type="password" value={f.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></div>
        {mode === 'signup' ? (
          <>
            <div className="two-col">
              <div className="field"><label>Space is measured in</label><select value={f.capacityUnit} onChange={set('capacityUnit')}><option value="container_slot">Container slots</option><option value="sqm">Square metres</option></select></div>
              <div className="field"><label>Total space</label><input type="number" min="1" value={f.totalCapacity} onChange={set('totalCapacity')} /></div>
            </div>
            <div className="field"><label>Price per unit per day (SLE)</label><input type="number" min="0" value={f.pricePerUnitPerDay} onChange={set('pricePerUnitPerDay')} /></div>
            <div className="field">
              <label>What you offer</label>
              {AMENITIES.map((a) => (
                <label key={a.key} style={{ display: 'block', fontSize: 14, fontWeight: 400 }}>
                  <input type="checkbox" checked={amenities.includes(a.key)} onChange={() => setAmenities((cur) => (cur.includes(a.key) ? cur.filter((k) => k !== a.key) : [...cur, a.key]))} /> {a.label}
                </label>
              ))}
            </div>
          </>
        ) : null}
        {(localError || error) && <p className="error-text">{localError || error}</p>}
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>{loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create warehouse account'}</button>
        <p style={{ fontSize: 13, marginTop: 16 }}>
          {mode === 'login' ? <>New warehouse? <Link to="/warehouse/signup">Create an account</Link></> : <>Already registered? <Link to="/warehouse/login">Sign in</Link></>}
          {' · '}<Link to="/login">Customs / AGL sign-in</Link>
        </p>
        {mode === 'signup' ? <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>A Cargo Flow admin verifies new warehouses. Agencies only see verified warehouses.</p> : null}
      </form>
    </div>
  );
}

function Shell() {
  const warehouse = useWarehouseStore((s) => s.warehouse);
  const signOut = useWarehouseStore((s) => s.signOut);
  if (!warehouse) return null;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">W</div>
          <div><div className="sidebar-title">{warehouse.businessName}</div><div className="sidebar-subtitle">Warehouse</div></div>
        </div>
        <NavLink to="/warehouse" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Bookings</NavLink>
        <NavLink to="/warehouse/listing" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>My listing</NavLink>
        <div className="nav-spacer" />
        <div style={{ padding: '0 20px' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 10 }}>{warehouse.ownerName}<br />{warehouse.phone}</div>
          <button className="btn btn-outline btn-sm" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)', width: '100%' }} onClick={signOut}>Log out</button>
        </div>
      </aside>
      <main className="main"><Outlet /></main>
    </div>
  );
}

// The warehouse owner's side of storage: sign up, keep the listing and space
// up to date, and answer booking requests from clearing agents.
export function WarehouseApp() {
  const status = useWarehouseStore((s) => s.status);
  const bootstrap = useWarehouseStore((s) => s.bootstrap);
  useEffect(() => {
    bootstrap();
  }, [bootstrap]);
  if (status === 'checking') return null;

  return (
    <Routes>
      <Route path="login" element={status === 'signedIn' ? <Navigate to="/warehouse" replace /> : <AuthPage mode="login" />} />
      <Route path="signup" element={status === 'signedIn' ? <Navigate to="/warehouse" replace /> : <AuthPage mode="signup" />} />
      <Route element={status === 'signedIn' ? <Shell /> : <Navigate to="/warehouse/login" replace />}>
        <Route index element={<WarehouseBookingsPage />} />
        <Route path="listing" element={<WarehouseListingPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/warehouse" replace />} />
    </Routes>
  );
}
