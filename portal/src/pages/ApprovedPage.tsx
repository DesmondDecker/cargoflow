import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { downloadApprovedCsv, fetchApproved, Submission } from '../api/portalApi';
import { apiErrorMessage } from '../api/client';
import { fmt } from '../utils';

export function ApprovedPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Submission[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(25);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const params = { q: q || undefined, from: from || undefined, to: to || undefined };

  const load = useCallback(async () => {
    try {
      const r = await fetchApproved({ ...params, page });
      setItems(r.submissions);
      setTotal(r.total);
      setLimit(r.limit);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, from, to, page]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  useEffect(() => {
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadApprovedCsv(params);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <>
      <h1 className="page-title">Approved records</h1>
      <p className="page-subtitle">Records Customs has approved, with the six details and the approval reference. {total} match.</p>
      <div className="toolbar" style={{ gap: 8, flexWrap: 'wrap' }}>
        <input className="field" style={{ maxWidth: 300, padding: 8 }} placeholder="Search CVC, BL, container, ITS, reference…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <label style={{ fontSize: 13 }}>From <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} /></label>
        <label style={{ fontSize: 13 }}>To <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} /></label>
        <button className="btn btn-outline btn-sm" onClick={exportCsv} disabled={exporting || total === 0}>{exporting ? 'Preparing…' : 'Download CSV'}</button>
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      <div className="card">
        {items.length === 0 ? (
          <div className="empty-state">No approved records match.</div>
        ) : (
          <table className="data">
            <thead><tr><th>Reference</th><th>Approved</th><th>Container</th><th>CVC number</th><th>Bill of lading</th><th>Shipping agency</th><th>Document</th><th>ITS number</th></tr></thead>
            <tbody>
              {items.map((s) => (
                <tr key={s._id} className="clickable" onClick={() => navigate(`/approved/${s._id}`)}>
                  <td><strong>{s.approvalReference}</strong></td>
                  <td>{fmt(s.reviewedAt)}</td>
                  <td>{s.containerNumber}</td>
                  <td>{s.cvcNumber}</td>
                  <td>{s.billOfLadingNumber}</td>
                  <td>{s.shippingAgency}</td>
                  <td>{s.documentName}</td>
                  <td>{s.itsNumber}</td>
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
