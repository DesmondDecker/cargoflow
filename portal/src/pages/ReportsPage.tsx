import React, { useCallback, useEffect, useState } from 'react';
import { fetchReport, Report } from '../api/portalApi';
import { apiErrorMessage } from '../api/client';

const dash = (v: number | null, unit = '') => (v === null ? '\u2014' : `${v}${unit}`);

export function ReportsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setReport(await fetchReport({ from: from || undefined, to: to || undefined }));
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const s = report?.summary;
  return (
    <>
      <h1 className="page-title">Reports</h1>
      <p className="page-subtitle">Measured from the records, for the pilot's evaluation. Defaults to the last 30 days. Review time is from submission to Customs' decision, so it depends on officer availability.</p>
      <div className="toolbar" style={{ gap: 12 }}>
        <label style={{ fontSize: 13 }}>From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label style={{ fontSize: 13 }}>To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      {s ? (
        <>
          <div className="stat-grid">
            <div className="stat-card"><div className="stat-label">Submitted</div><div className="stat-value">{s.total}</div></div>
            <div className="stat-card"><div className="stat-label">Approved</div><div className="stat-value">{s.approved}</div></div>
            <div className="stat-card"><div className="stat-label">Returned</div><div className="stat-value">{s.returned}</div></div>
            <div className="stat-card"><div className="stat-label">Still pending</div><div className="stat-value">{s.pending}</div></div>
            <div className="stat-card"><div className="stat-label">Return rate</div><div className="stat-value">{dash(s.returnRate, '%')}</div></div>
            <div className="stat-card"><div className="stat-label">Median review time</div><div className="stat-value">{dash(s.reviewMinutes.median, ' min')}</div></div>
            <div className="stat-card"><div className="stat-label">Slowest 10% took over</div><div className="stat-value">{dash(s.reviewMinutes.p90, ' min')}</div></div>
            <div className="stat-card"><div className="stat-label">Decided within 10 min</div><div className="stat-value">{dash(s.withinTenMinutesPct, '%')}</div></div>
            <div className="stat-card"><div className="stat-label">Email sent after approval</div><div className="stat-value">{dash(s.emailDelaySeconds.median, ' s')}</div></div>
            <div className="stat-card"><div className="stat-label">Entered by Customs</div><div className="stat-value">{dash(report!.assistedShare, '%')}</div></div>
          </div>
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-title">By day (date submitted)</div>
            {report!.byDay.length === 0 ? <div className="empty-state">No submissions in this period.</div> : (
              <table className="data">
                <thead><tr><th>Date</th><th>Submitted</th><th>Approved</th><th>Returned</th></tr></thead>
                <tbody>{report!.byDay.map((d) => <tr key={d.date}><td>{d.date}</td><td>{d.submitted}</td><td>{d.approved}</td><td>{d.returned}</td></tr>)}</tbody>
              </table>
            )}
          </div>
        </>
      ) : null}
    </>
  );
}
