import React, { useEffect, useState } from 'react';
import { approveExpense, fetchExpenses, rejectExpense } from '../api/adminApi';
import { apiErrorMessage } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { Agency, Expense, ExpenseStatus } from '../types';

function formatDate(value?: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function formatCurrency(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function agencyName(agencyId: Expense['agencyId']): string {
  return typeof agencyId === 'object' ? agencyId.name : agencyId;
}

function containerName(containerId: Expense['containerId']): string {
  if (!containerId || typeof containerId === 'string') return '—';
  return containerId.containerNumber || '—';
}

export function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filter, setFilter] = useState<'all' | ExpenseStatus>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Expense | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = () => {
    setLoading(true);
    setError(null);
    fetchExpenses(filter === 'all' ? undefined : filter)
      .then(setExpenses)
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [filter]);

  const onApprove = async (expense: Expense) => {
    setBusyId(expense._id);
    try {
      await approveExpense(expense._id);
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
      await rejectExpense(rejectTarget._id, rejectReason.trim());
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
      <h1 className="page-title">Expenses</h1>
      <p className="page-subtitle">
        Review recorded operating costs from agencies, approve valid claims, and reject mismatched receipts before they hit the financial dashboard.
      </p>

      <div className="toolbar">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((f) => (
          <button key={f} className={`chip${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card">
        {loading ? (
          <p>Loading…</p>
        ) : expenses.length === 0 ? (
          <div className="empty-state">No expenses in this view.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Agency</th>
                <th>Container</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Description</th>
                <th>Evidence</th>
                <th>Status</th>
                <th>Recorded</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense._id}>
                  <td>{agencyName(expense.agencyId)}</td>
                  <td>{containerName(expense.containerId)}</td>
                  <td>{expense.category}</td>
                  <td>{formatCurrency(expense.amount, expense.currency)}</td>
                  <td>{expense.description || '—'}</td>
                  <td>{expense.evidenceUrls.length > 0 ? <a href={expense.evidenceUrls[0]} target="_blank" rel="noreferrer">{expense.evidenceUrls.length} file(s)</a> : '—'}</td>
                  <td>
                    <StatusBadge status={expense.status} />
                  </td>
                  <td>{formatDate(expense.createdAt)}</td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    {expense.status === 'pending' && (
                      <>
                        <button className="btn btn-primary btn-sm" disabled={busyId === expense._id} onClick={() => onApprove(expense)}>
                          Approve
                        </button>
                        <button className="btn btn-danger btn-sm" disabled={busyId === expense._id} onClick={() => setRejectTarget(expense)}>
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
            <h2 className="card-title">Reject expense for {agencyName(rejectTarget.agencyId)}?</h2>
            <div className="field">
              <label>Reason</label>
              <textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="e.g. Receipt is missing or amount doesn't match evidence" />
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
