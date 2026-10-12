import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/agencies', label: 'Agencies' },
  { to: '/drivers', label: 'Drivers' },
  { to: '/payments', label: 'Payments' },
  { to: '/expenses', label: 'Expenses' },
  { to: '/gateway-devices', label: 'Gateway Devices' },
  { to: '/team', label: 'Team' },
];

export function Layout() {
  const admin = useAuthStore((s) => s.admin);
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">C</div>
          <div>
            <div className="sidebar-title">CargoFlow</div>
            <div className="sidebar-subtitle">Platform Admin</div>
          </div>
        </div>

        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}

        <div className="nav-spacer" />

        <div style={{ padding: '0 20px' }}>
          {admin ? (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 10 }}>{admin.email}</div>
          ) : null}
          <button className="btn btn-outline btn-sm" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)', width: '100%' }} onClick={logout}>
            Log Out
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
