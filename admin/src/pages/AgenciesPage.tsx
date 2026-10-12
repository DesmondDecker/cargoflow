import React, { useEffect, useState } from 'react';
import { fetchAgencies, updateAgencySubscription, updateAgencyActive, resetAgencyPassword } from '../api/adminApi';
import { apiErrorMessage } from '../api/client';
import { Agency, SubscriptionStatus } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { SetPasswordModal } from '../components/SetPasswordModal';

function formatDate(value?: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function AgenciesPage() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | SubscriptionStatus>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ agency: Agency; nextStatus: SubscriptionStatus } | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<{ agency: Agency; nextActive: boolean } | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<Agency | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchAgencies()
      .then(setAgencies)
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const applySubscriptionChange = async () => {
    if (!confirmTarget) return;
    setBusyId(confirmTarget.agency._id);
    try {
      await updateAgencySubscription(confirmTarget.agency._id, confirmTarget.nextStatus);
      setConfirmTarget(null);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const applySuspendChange = async () => {
    if (!suspendTarget) return;
    setBusyId(suspendTarget.agency._id);
    try {
      await updateAgencyActive(suspendTarget.agency._id, suspendTarget.nextActive);
      setSuspendTarget(null);
      load();
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
      await resetAgencyPassword(passwordTarget._id, newPassword);
      setPasswordTarget(null);
      setSuccessMessage(`Password reset for ${passwordTarget.name}. Share the new password with them directly — it won't be shown again here.`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const filtered = filter === 'all' ? agencies : agencies.filter((a) => a.subscription.status === filter);

  return (
    <div>
      <h1 className="page-title">Agencies</h1>
      <p className="page-subtitle">Every clearing company using CargoFlow.</p>

      <div className="toolbar">
        {(['all', 'trialing', 'active', 'expired', 'canceled'] as const).map((f) => (
          <button key={f} className={`chip${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}
      {successMessage && <p style={{ color: 'var(--normal)', fontSize: 14, marginBottom: 12 }}>{successMessage}</p>}

      <div className="card">
        {loading ? (
          <p>Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="empty-state">No agencies match this filter.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Agency</th>
                <th>Code</th>
                <th>Subscription</th>
                <th>Account</th>
                <th>Period Ends</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((agency) => (
                <tr key={agency._id}>
                  <td>{agency.name}</td>
                  <td>
                    <code>{agency.agencyCode}</code>
                  </td>
                  <td>
                    <StatusBadge status={agency.subscription.status} />
                  </td>
                  <td>
                    <span className={`badge status-${agency.isActive ? 'active' : 'canceled'}`}>
                      {agency.isActive ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td>{formatDate(agency.subscription.currentPeriodEnd)}</td>
                  <td>{formatDate(agency.createdAt)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {agency.subscription.status !== 'active' && (
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={busyId === agency._id}
                          onClick={() => setConfirmTarget({ agency, nextStatus: 'active' })}
                        >
                          Activate
                        </button>
                      )}
                      {agency.subscription.status !== 'canceled' && (
                        <button
                          className="btn btn-danger btn-sm"
                          disabled={busyId === agency._id}
                          onClick={() => setConfirmTarget({ agency, nextStatus: 'canceled' })}
                        >
                          Disable Sub.
                        </button>
                      )}
                      <button
                        className="btn btn-outline btn-sm"
                        disabled={busyId === agency._id}
                        onClick={() => setSuspendTarget({ agency, nextActive: !agency.isActive })}
                      >
                        {agency.isActive ? 'Suspend Account' : 'Reactivate'}
                      </button>
                      <button className="btn btn-outline btn-sm" disabled={busyId === agency._id} onClick={() => setPasswordTarget(agency)}>
                        Reset Password
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {confirmTarget && (
        <div className="modal-overlay" onClick={() => setConfirmTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="card-title">
              {confirmTarget.nextStatus === 'active' ? 'Activate' : 'Disable'} subscription for {confirmTarget.agency.name}?
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              {confirmTarget.nextStatus === 'active'
                ? 'This immediately grants access, bypassing the payment flow. Use this for manual corrections or goodwill.'
                : "This immediately cuts off the agency's subscription access to CargoFlow."}
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-outline" onClick={() => setConfirmTarget(null)} style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                className={confirmTarget.nextStatus === 'active' ? 'btn btn-primary' : 'btn btn-danger'}
                onClick={applySubscriptionChange}
                disabled={busyId === confirmTarget.agency._id}
                style={{ flex: 1 }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {suspendTarget && (
        <div className="modal-overlay" onClick={() => setSuspendTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="card-title">
              {suspendTarget.nextActive ? 'Reactivate' : 'Suspend'} {suspendTarget.agency.name}'s account?
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              {suspendTarget.nextActive
                ? 'Staff will be able to log in again.'
                : "This locks every staff member out immediately, regardless of subscription status — all existing sessions are revoked."}
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-outline" onClick={() => setSuspendTarget(null)} style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                className={suspendTarget.nextActive ? 'btn btn-primary' : 'btn btn-danger'}
                onClick={applySuspendChange}
                disabled={busyId === suspendTarget.agency._id}
                style={{ flex: 1 }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {passwordTarget && (
        <SetPasswordModal
          title={`Reset password for ${passwordTarget.name}`}
          warning="This immediately revokes every staff member's session. Verify who you're talking to before doing this — this endpoint doesn't check identity beyond your own admin login."
          busy={busyId === passwordTarget._id}
          onConfirm={applyPasswordReset}
          onCancel={() => setPasswordTarget(null)}
        />
      )}
    </div>
  );
}
