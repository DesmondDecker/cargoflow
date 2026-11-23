import React, { useEffect, useState } from 'react';
import { fetchDrivers, resetDriverPassword, setDriverSponsorship, setDriverVerification } from '../api/adminApi';
import { apiErrorMessage } from '../api/client';
import { Driver } from '../types';
import { SetPasswordModal } from '../components/SetPasswordModal';
import { SponsorModal } from '../components/SponsorModal';

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

  const [sponsorTarget, setSponsorTarget] = useState<Driver | null>(null);

  const setVerification = async (driver: Driver, status: Driver['verificationStatus']) => {
    setBusyId(driver._id);
    setError(null);
    try {
      await setDriverVerification(driver._id, status);
      setSuccessMessage(`${driver.name} is now ${status}.`);
      load(search);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

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
                  <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {driver.licenseDocumentUrl ? (
                      <a className="btn btn-outline btn-sm" href={driver.licenseDocumentUrl} target="_blank" rel="noreferrer">
                        View licence
                      </a>
                    ) : null}
                    {driver.verificationStatus !== 'verified' ? (
                      <button className="btn btn-outline btn-sm" disabled={busyId === driver._id} onClick={() => setVerification(driver, 'verified')}>
                        Verify
                      </button>
                    ) : null}
                    {driver.verificationStatus !== 'rejected' ? (
                      <button className="btn btn-outline btn-sm" disabled={busyId === driver._id} onClick={() => setVerification(driver, 'rejected')}>
                        Reject
                      </button>
                    ) : null}
                    <button className="btn btn-outline btn-sm" disabled={busyId === driver._id} onClick={() => setSponsorTarget(driver)}>
                      {driver.sponsored ? `Boosted to ${formatDate(driver.sponsoredUntil ?? undefined)}` : 'Sponsor'}
                    </button>
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

      {sponsorTarget && (
        <SponsorModal
          name={sponsorTarget.name}
          currentlySponsored={!!sponsorTarget.sponsored}
          busy={busyId === sponsorTarget._id}
          onCancel={() => setSponsorTarget(null)}
          onConfirm={async (on, until) => {
            const t = sponsorTarget;
            setBusyId(t._id);
            try {
              await setDriverSponsorship(t._id, on, until);
              setSuccessMessage(on ? `${t.name} is boosted until ${formatDate(until)}.` : `${t.name} is no longer boosted.`);
              load(search);
            } catch (err) {
              setError(apiErrorMessage(err));
            } finally {
              setBusyId(null);
              setSponsorTarget(null);
            }
          }}
        />
      )}

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
