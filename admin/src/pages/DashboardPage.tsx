import React, { useEffect, useState } from 'react';
import { fetchAnalytics } from '../api/adminApi';
import { apiErrorMessage } from '../api/client';
import { Analytics } from '../types';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatCurrency(amount: number): string {
  return `Le ${amount.toLocaleString()}`;
}

export function DashboardPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics()
      .then(setData)
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading…</p>;
  if (error) return <p className="error-text">{error}</p>;
  if (!data) return null;

  const statusCount = (status: string) => data.agenciesByStatus.find((a) => a._id === status)?.count || 0;
  const paymentCount = (status: string) => data.paymentsByStatus.find((p) => p._id === status)?.count || 0;
  const maxRevenue = Math.max(...data.revenueByMonth.map((m) => m.total), 1);

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-subtitle">Platform-wide numbers across every agency.</p>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{data.totalAgencies}</div>
          <div className="stat-label">Total Agencies</div>
        </div>
        <div className="stat-card">
          <div className="stat-value normal">{statusCount('active')}</div>
          <div className="stat-label">Active Subscriptions</div>
        </div>
        <div className="stat-card">
          <div className="stat-value attention">{statusCount('trialing')}</div>
          <div className="stat-label">On Trial</div>
        </div>
        <div className="stat-card">
          <div className="stat-value urgent">{statusCount('expired') + statusCount('canceled')}</div>
          <div className="stat-label">Expired / Canceled</div>
        </div>
        <div className="stat-card">
          <div className="stat-value orange">{formatCurrency(data.revenue.total)}</div>
          <div className="stat-label">Total Revenue ({data.revenue.activatedCount} payments)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.newAgenciesLast30Days}</div>
          <div className="stat-label">New Agencies (30 days)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value attention">{data.pendingReviewCount}</div>
          <div className="stat-label">Payments Needing Review</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.totalContainers.toLocaleString()}</div>
          <div className="stat-label">Total Containers Tracked</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20 }}>
        <div className="card">
          <h2 className="card-title">Revenue by Month</h2>
          {data.revenueByMonth.length === 0 ? (
            <div className="empty-state">No activated payments yet.</div>
          ) : (
            data.revenueByMonth.map((m, i) => (
              <div className="bar-row" key={i}>
                <div className="bar-label">
                  {MONTH_NAMES[m._id.month - 1]} {m._id.year}
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(m.total / maxRevenue) * 100}%` }} />
                </div>
                <div className="bar-value">{formatCurrency(m.total)}</div>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <h2 className="card-title">Payments Pipeline</h2>
          {['pending', 'submitted', 'verified', 'activated', 'rejected'].map((status) => (
            <div key={status} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{status}</span>
              <strong>{paymentCount(status)}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
