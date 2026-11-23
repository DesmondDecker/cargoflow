import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchQueue, Status, Submission } from '../api/portalApi';
import { apiErrorMessage } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { fmt, waiting } from '../utils';

const REFRESH_MS = 20000;

export function QueuePage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('pending');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Submission[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(25);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, returned: 0 });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetchQueue({ status, q: q || undefined, page });
      setItems(r.submissions);
      setTotal(r.total);
      setLimit(r.limit);
      setCounts(r.counts);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [status, q, page]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  // New submissions appear without anyone reloading the page.
  useEffect(() => {
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / limit));
  const tab = (s: Status, label: string) => (
    <button key={s} className={`btn btn-sm ${status === s ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setStatus(s); setPage(1); }}>
      {label} ({counts[s]})
    </button>
  );

  return (
    <>
      <h1 className="page-title">Review queue</h1>
      <p className="page-subtitle">Oldest first. Open a record to check it against Customs' own records, then approve it or return it for correction.</p>
      <div className="tabs">{tab('pending', 'Pending')}{tab('returned', 'Returned')}{tab('approved', 'Approved')}</div>
      <div className="toolbar">
        <input className="field" style={{ maxWidth: 360, padding: 8 }} placeholder="Search CVC, BL, container, ITS, reference…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      <div className="card">
        {items.length === 0 && !loading ? (
          <div className="empty-state">{status === 'pending' ? 'Nothing waiting for review.' : 'No records.'}</div>
        ) : (
          <table className="data">
            <thead>
              <tr><th>Container</th><th>CVC number</th><th>Bill of lading</th><th>From</th><th>{status === 'pending' ? 'Waiting' : 'Decided'}</th><th>Status</th></tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s._id} className="clickable" onClick={() => navigate(`/queue/${s._id}`)}>
                  <td><strong>{s.containerNumber}</strong></td>
                  <td>{s.cvcNumber}</td>
                  <td>{s.billOfLadingNumber}</td>
                  <td>{s.source === 'customs_assisted' ? `${s.onBehalfOf} (entered by Customs)` : s.submittedByName}</td>
                  <td>{status === 'pending' ? waiting(s.submittedAt) : fmt(s.reviewedAt)}</td>
                  <td><StatusBadge status={s.status} /></td>
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
    </>
  );
}
