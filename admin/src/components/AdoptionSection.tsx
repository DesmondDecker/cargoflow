import React, { useEffect, useState } from 'react';
import { Adoption, fetchAdoption } from '../api/adminApi';
import { apiErrorMessage } from '../api/client';
import { BarChart } from './BarChart';

const pct = (active: number, registered: number) => (registered === 0 ? '—' : `${Math.round((active / registered) * 100)}%`);

// Registered and active are shown side by side, deliberately: sign-ups alone
// do not show use. "Active" means someone from the agency signed in during the
// last 30 days (drivers: had job activity).
export function AdoptionSection() {
  const [data, setData] = useState<Adoption | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdoption().then(setData).catch((e) => setError(apiErrorMessage(e)));
  }, []);

  if (error) return <p className="error-text">{error}</p>;
  if (!data) return null;
  const { registered, active30Days, customs, weekly } = data;
  const series = (rows: { weekStart: string; count: number }[]) => rows.map((r) => ({ label: r.weekStart, value: r.count }));

  const card = (label: string, reg: number, act: number) => (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{act} <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-secondary)' }}>active of {reg}</span></div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{pct(act, reg)} used in the last 30 days</div>
    </div>
  );

  return (
    <div style={{ marginTop: 24 }}>
      <h2 className="card-title" style={{ fontSize: 18 }}>Adoption</h2>
      <div className="stat-grid">
        {card('Agencies', registered.agencies, active30Days.agencies)}
        {card('Agency users', registered.users, active30Days.users)}
        {card('Drivers', registered.drivers, active30Days.drivers)}
        <div className="stat-card"><div className="stat-label">Verified drivers</div><div className="stat-value">{registered.verifiedDrivers}</div></div>
        <div className="stat-card"><div className="stat-label">Customs records approved</div><div className="stat-value">{customs.approved} <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-secondary)' }}>of {customs.submitted}</span></div></div>
      </div>
      <div className="two-col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, marginTop: 12 }}>
        <BarChart title="New agencies per week" data={series(weekly.agencies)} />
        <BarChart title="New users per week" data={series(weekly.users)} color="#1E6FD9" />
        <BarChart title="Containers added per week" data={series(weekly.containers)} color="#1B7F3B" />
        <BarChart title="Customs submissions per week" data={series(weekly.customsSubmissions)} color="#7A4AD9" />
      </div>
    </div>
  );
}
