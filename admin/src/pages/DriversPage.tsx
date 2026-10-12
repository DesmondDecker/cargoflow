import React, { useEffect, useState } from 'react';
import { fetchDrivers, resetDriverPassword } from '../api/adminApi';
import { apiErrorMessage } from '../api/client';
import { Driver } from '../types';
import { SetPasswordModal } from '../components/SetPasswordModal';

function formatDate(value?: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<Driver | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = (query?: string) => {
    setLoading(true);
    setError(null);
    fetchDrivers(query)
      .then(setDrivers)
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), []);

  const applyPasswordReset = async (newPassword: string) => {
    if (!passwordTarget) return;
    setBusyId(passwordTarget._id);
    try {
      await resetDriverPassword(passwordTarget._id, newPassword);
      setPasswordTarget(null);
      setSuccessMessage(`Password reset for ${passwordTarget.name}. Share the new password with them directly.`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <h1 className="page-title">Drivers</h1>
      <p className="page-subtitle">Every driver registered on the platform, across all agencies.</p>

      <div className="toolbar">
        <input
          style={{ maxWidth: 320 }}
          placeholder="Search by name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load(search)}
        />
        <button className="btn btn-outline btn-sm" onClick={() => load(search)}>
          Search
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}
      {successMessage && <p style={{ color: 'var(--normal)', fontSize: 14, marginBottom: 12 }}>{successMessage}</p>}

      <div className="card">
        {loading ? (
          <p>Loading…</p>
        ) : drivers.length === 0 ? (
          <div className="empty-state">No drivers match this search.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Verification</th>
                <th>Rating</th>
                <th>Account</th>
                <th>Joined</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => (
                <tr key={driver._id}>
                  <td>{driver.name}</td>
                  <td>{driver.phone}</td>
                  <td style={{ textTransform: 'capitalize' }}>{driver.verificationStatus}</td>
                  <td>
                    {driver.ratingCount > 0 ? `${driver.ratingAverage.toFixed(1)} ★ (${driver.ratingCount})` : '—'}
                  </td>
                  <td>
                    <span className={`badge status-${driver.isActive ? 'active' : 'canceled'}`}>
                      {driver.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{formatDate(driver.createdAt)}</td>
                  <td>
                    <button className="btn btn-outline btn-sm" disabled={busyId === driver._id} onClick={() => setPasswordTarget(driver)}>
                      Reset Password
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {passwordTarget && (
        <SetPasswordModal
          title={`Reset password for ${passwordTarget.name}`}
          warning="This immediately revokes the driver's existing sessions on all their devices."
          busy={busyId === passwordTarget._id}
          onConfirm={applyPasswordReset}
          onCancel={() => setPasswordTarget(null)}
        />
      )}
    </div>
  );
}
