import React, { useCallback, useEffect, useState } from 'react';
import { downloadOversightCsv, fetchOversightLog, fetchOversightStaff, OversightEntry, StaffRow } from '../api/portalApi';
import { apiErrorMessage } from '../api/client';
import { ACTION_FILTERS, actionLabel, OUTCOME_LABEL } from '../oversightLabels';
import { fmt } from '../utils';

// Supervisors only. Read-only: nothing on this page changes or deletes an entry.
// A supervisor sees their own institution's staff and nobody else's.
export function OversightPage() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [entries, setEntries] = useState<OversightEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(50);
  const [page, setPage] = useState(1);
  const [user, setUser] = useState('');
  const [action, setAction] = useState('');
  const [outcome, setOutcome] = useState('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const filters = { user: user || undefined, action: action || undefined, outcome: outcome || undefined, q: q || undefined, from: from || undefined, to: to || undefined };

  const loadStaff = useCallback(async () => {
    try {
      setStaff((await fetchOversightStaff()).staff);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }, []);

  const loadLog = useCallback(async () => {
    try {
      const r = await fetchOversightLog({ ...filters, page });
      setEntries(r.entries);
      setTotal(r.total);
      setLimit(r.limit);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, action, outcome, q, from, to, page]);

  useEffect(() => { loadStaff(); }, [loadStaff]);
  useEffect(() => {
    const t = setTimeout(loadLog, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadLog, q]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadOversightCsv(filters);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const reset = (fn: () => void) => { fn(); setPage(1); };
  const pages = Math.max(1, Math.ceil(total / limit));
  const watch = (n: number) => (n > 0 ? { color: '#B42318', fontWeight: 700 } : undefined);

  return (
    <>
      <h1 className="page-title">Staff activity</h1>
      <p className="page-subtitle">What your institution's staff have done in this portal: sign-ins, records opened, approvals, returns, downloads and refused attempts. You can read this; you cannot change or delete it.</p>
      {error ? <p className="error-text">{error}</p> : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Last 30 days, by person</h2>
        <table className="data">
          <thead><tr><th>Person</th><th>Last sign-in</th><th>Approved</th><th>Returned</th><th>Records opened</th><th>CSV downloads</th><th>Refused</th><th>Failed sign-ins</th><th>Entered and approved by same person</th></tr></thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className="clickable" onClick={() => reset(() => setUser(user === s.id ? '' : s.id))} style={user === s.id ? { background: 'rgba(0,0,0,0.05)' } : undefined}>
                <td>{s.name}{s.isSupervisor ? ' (supervisor)' : ''}{s.isActive ? '' : ' (deactivated)'}<br /><span style={{ fontSize: 12 }}>{s.email}</span></td>
                <td>{fmt(s.lastLoginAt)}</td>
                <td>{s.last30Days.approvals}</td>
                <td>{s.last30Days.returns}</td>
                <td>{s.last30Days.recordsViewed}</td>
                <td>{s.last30Days.exports}</td>
                <td style={watch(s.last30Days.refusedRequests)}>{s.last30Days.refusedRequests}</td>
                <td style={watch(s.last30Days.failedSignIns)}>{s.last30Days.failedSignIns}</td>
                <td style={watch(s.last30Days.selfApproved)}>{s.last30Days.selfApproved}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 12, marginBottom: 0 }}>Click a person to filter the log below to them. Red numbers are worth a look.</p>
      </div>

      <div className="toolbar" style={{ gap: 8, flexWrap: 'wrap' }}>
        <input className="field" style={{ maxWidth: 260, padding: 8 }} placeholder="Search name, container, CVC, reason…" value={q} onChange={(e) => reset(() => setQ(e.target.value))} />
        <select value={action} onChange={(e) => reset(() => setAction(e.target.value))}>
          {ACTION_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select value={outcome} onChange={(e) => reset(() => setOutcome(e.target.value))}>
          <option value="">Any result</option>
          <option value="ok">Done</option>
          <option value="denied">Refused</option>
          <option value="failed">Failed</option>
        </select>
        <label style={{ fontSize: 13 }}>From <input type="date" value={from} onChange={(e) => reset(() => setFrom(e.target.value))} /></label>
        <label style={{ fontSize: 13 }}>To <input type="date" value={to} onChange={(e) => reset(() => setTo(e.target.value))} /></label>
        {user ? <button className="btn btn-outline btn-sm" onClick={() => reset(() => setUser(''))}>Show everyone</button> : null}
        <button className="btn btn-outline btn-sm" onClick={exportCsv} disabled={exporting || total === 0}>{exporting ? 'Preparing…' : 'Download CSV'}</button>
      </div>

      <div className="card">
        {entries.length === 0 ? (
          <div className="empty-state">Nothing matches.</div>
        ) : (
          <table className="data">
            <thead><tr><th>When</th><th>Person</th><th>What</th><th>Record</th><th>Detail</th><th>Result</th><th>From</th></tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{fmt(e.at)}</td>
                  <td>{e.userName}{e.userId ? '' : <><br /><span style={{ fontSize: 12 }}>{e.email}</span></>}</td>
                  <td>{actionLabel(e.action)}</td>
                  <td>{e.targetLabel ?? '\u2014'}</td>
                  <td>{e.detail ?? '\u2014'}</td>
                  <td style={e.outcome === 'ok' ? undefined : { color: '#B42318', fontWeight: 700 }}>{OUTCOME_LABEL[e.outcome]}</td>
                  <td style={{ fontSize: 12 }}>{e.ip ?? '\u2014'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {pages > 1 ? (
        <div className="toolbar" style={{ marginTop: 12 }}>
          <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span style={{ fontSize: 13 }}>Page {page} of {pages} ({total} entries)</span>
          <button className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      ) : null}
    </>
  );
}
