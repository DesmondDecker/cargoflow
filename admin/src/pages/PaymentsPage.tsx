import React, { useEffect, useState } from 'react';
import { fetchPayments, verifyPayment, rejectPayment } from '../api/adminApi';
import { apiErrorMessage } from '../api/client';
import { Payment, PaymentStatus, Agency } from '../types';
import { StatusBadge } from '../components/StatusBadge';

function formatDate(value?: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function agencyName(agencyId: Payment['agencyId']): string {
  return typeof agencyId === 'object' ? agencyId.name : agencyId;
}

export function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filter, setFilter] = useState<'all' | PaymentStatus>('submitted');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Payment | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = () => {
    setLoading(true);
    setError(null);
    fetchPayments(filter === 'all' ? undefined : filter)
      .then(setPayments)
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [filter]);

  const onVerify = async (payment: Payment) => {
    setBusyId(payment._id);
    try {
      await verifyPayment(payment._id);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const onReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    setBusyId(rejectTarget._id);
    try {
      await rejectPayment(rejectTarget._id, rejectReason.trim());
      setRejectTarget(null);
      setRejectReason('');
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <h1 className="page-title">Payments</h1>
      <p className="page-subtitle">
        Payments the automated SMS matcher couldn't confirm land here as <code>submitted</code> — check the mobile money account
        directly, then verify or reject.
      </p>

      <div className="toolbar">
        {(['submitted', 'pending', 'verified', 'activated', 'rejected', 'all'] as const).map((f) => (
          <button key={f} className={`chip${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card">
        {loading ? (
          <p>Loading…</p>
        ) : payments.length === 0 ? (
          <div className="empty-state">No payments in this view.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Agency</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Transaction ID</th>
                <th>Status</th>
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p._id}>
                  <td>{agencyName(p.agencyId)}</td>
                  <td>Le {p.amountExpected.toLocaleString()}</td>
                  <td>{p.paymentMethod === 'orange_money' ? 'Orange Money' : 'AfriMoney'}</td>
                  <td>
                    <code>{p.referenceCode}</code>
                  </td>
                  <td>{p.submittedTransactionId || '—'}</td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td>{formatDate(p.createdAt)}</td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    {p.status === 'submitted' && (
                      <>
                        <button className="btn btn-primary btn-sm" disabled={busyId === p._id} onClick={() => onVerify(p)}>
                          Verify
                        </button>
                        <button className="btn btn-danger btn-sm" disabled={busyId === p._id} onClick={() => setRejectTarget(p)}>
                          Reject
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {rejectTarget && (
        <div className="modal-overlay" onClick={() => setRejectTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="card-title">Reject payment {rejectTarget.referenceCode}?</h2>
            <div className="field">
              <label>Reason</label>
              <textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="e.g. Transaction ID doesn't match any received payment" />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline" onClick={() => setRejectTarget(null)} style={{ flex: 1 }}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={onReject} disabled={!rejectReason.trim() || busyId === rejectTarget._id} style={{ flex: 1 }}>
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
