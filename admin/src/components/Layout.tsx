import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

// Pages only a super admin can open (the server enforces this too; hiding is just tidiness).
const SUPER_ONLY = new Set(['/gateway-devices', '/audit-log', '/institution-audit', '/team']);

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/agencies', label: 'Agencies' },
  { to: '/drivers', label: 'Drivers' },
  { to: '/payments', label: 'Payments' },
  { to: '/expenses', label: 'Expenses' },
  { to: '/gateway-devices', label: 'Gateway Devices' },
  { to: '/warehouses', label: 'Warehouses' },
  { to: '/institution-users', label: 'Customs & AGL users' },
  { to: '/plans', label: 'Plans' },
  { to: '/audit-log', label: 'Audit log' },
  { to: '/institution-audit', label: 'Customs & AGL activity' },
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

        {NAV_ITEMS.filter((item) => admin?.role === 'super_admin' || !SUPER_ONLY.has(item.to) || item.to === '/team').map((item) => (
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
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 10 }}>{admin.email}{admin.role ? ` · ${admin.role.replace('_', ' ')}` : ''}</div>
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
