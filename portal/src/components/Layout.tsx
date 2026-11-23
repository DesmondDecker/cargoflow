import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const NAV = {
  customs: [
    { to: '/queue', label: 'Review queue' },
    { to: '/new', label: 'Enter a record' },
    { to: '/approved', label: 'Approved records' },
    { to: '/reports', label: 'Reports' },
  ],
  agl: [
    { to: '/approved', label: 'Approved records' },
    { to: '/reports', label: 'Reports' },
  ],
};

export function Layout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  if (!user) return null;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">C</div>
          <div>
            <div className="sidebar-title">Cargo Flow</div>
            <div className="sidebar-subtitle">{user.institution === 'customs' ? 'Customs verification' : 'AGL approvals'}</div>
          </div>
        </div>
        {[...NAV[user.institution], ...(user.isSupervisor ? [{ to: '/oversight', label: 'Staff activity' }] : [])].map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            {item.label}
          </NavLink>
        ))}
        <div className="nav-spacer" />
        <div style={{ padding: '0 20px' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 10 }}>
            {user.name}
            <br />
            {user.email}
          </div>
          <button className="btn btn-outline btn-sm" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)', width: '100%' }} onClick={logout}>
            Log out
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
