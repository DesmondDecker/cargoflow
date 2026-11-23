import React, { useCallback, useEffect, useState } from 'react';
import { AuditEntry, fetchAuditLog } from '../api/adminApi';
import { apiErrorMessage } from '../api/client';

const when = (v: string) => new Date(v).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' });

// Every change an admin makes in this dashboard, who made it and when. Secrets
// such as passwords are never stored in it.
export function AuditLogPage() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(50);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetchAuditLog({ page, q: q || undefined });
      setEntries(r.entries);
      setTotal(r.total);
      setLimit(r.limit);
      setError(null);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  }, [page, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div>
      <h1 className="page-title">Audit log</h1>
      <p className="page-subtitle">{total} recorded change{total === 1 ? '' : 's'}. Newest first.</p>
      {error ? <p className="error-text">{error}</p> : null}
      <div className="toolbar"><input className="field" style={{ maxWidth: 320, padding: 8 }} placeholder="Search admin or path…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
      <div className="card">
        {entries.length === 0 ? <div className="empty-state">Nothing recorded yet.</div> : (
          <table className="data">
            <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Details</th></tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e._id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{when(e.createdAt)}</td>
                  <td>{e.adminName}</td>
                  <td><strong>{e.method}</strong> {e.route.replace('/api/v1', '')}<br /><span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{e.path.replace('/api/v1', '')}</span></td>
                  <td style={{ fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all' }}>{Object.keys(e.summary).length ? JSON.stringify(e.summary) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {pages > 1 ? (
        <div className="toolbar" style={{ marginTop: 12 }}>
          <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span style={{ fontSize: 13 }}>Page {page} of {pages}</span>
          <button className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      ) : null}
    </div>
  );
}
