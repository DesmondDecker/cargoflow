import React, { useCallback, useEffect, useState } from 'react';
import { fetchInstitutionAudit, InstitutionAuditEntry } from '../api/adminApi';
import { apiErrorMessage } from '../api/client';

const fmt = (v?: string) => (v ? new Date(v).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '\u2014');
const LABEL: Record<string, string> = {
  'auth.login': 'Signed in', 'auth.logout': 'Signed out', 'auth.change_password': 'Changed password', 'access.denied': 'Tried something not allowed',
  'record.view': 'Opened a record', 'record.approve': 'Approved a record', 'record.return': 'Returned a record', 'record.create_assisted': 'Entered a record for an agent',
  'record.resend_email': 'Resent approval email', 'approved.view': 'Opened an approved record', 'approved.export_csv': 'Downloaded approved CSV', 'report.view': 'Viewed reports',
  'oversight.view_log': 'Viewed staff activity', 'oversight.export_log': 'Downloaded staff activity',
};

// Everything Customs and AGL staff do in the portal, both institutions, including what the
// supervisors themselves look at. Read-only: entries cannot be edited or deleted.
export function InstitutionAuditPage() {
  const [entries, setEntries] = useState<InstitutionAuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(50);
  const [page, setPage] = useState(1);
  const [institution, setInstitution] = useState('');
  const [action, setAction] = useState('');
  const [outcome, setOutcome] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetchInstitutionAudit({ institution: institution || undefined, action: action || undefined, outcome: outcome || undefined, q: q || undefined, page });
      setEntries(r.entries);
      setTotal(r.total);
      setLimit(r.limit);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }, [institution, action, outcome, q, page]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const pages = Math.max(1, Math.ceil(total / limit));
  const reset = (fn: () => void) => { fn(); setPage(1); };

  return (
    <div>
      <h1 className="page-title">Customs and AGL activity</h1>
      <p className="page-subtitle">Everything Customs and AGL staff do in the portal, including the supervisors' own views of this log. Entries cannot be changed or deleted. {total} match.</p>
      {error ? <p className="error-text">{error}</p> : null}
      <div className="toolbar" style={{ gap: 8, flexWrap: 'wrap' }}>
        <input placeholder="Search name, container, CVC, reason…" value={q} onChange={(e) => reset(() => setQ(e.target.value))} style={{ maxWidth: 280 }} />
        <select value={institution} onChange={(e) => reset(() => setInstitution(e.target.value))}>
          <option value="">Customs and AGL</option><option value="customs">Customs</option><option value="agl">AGL</option>
        </select>
        <select value={action} onChange={(e) => reset(() => setAction(e.target.value))}>
          <option value="">Everything</option><option value="auth.">Sign-ins and passwords</option><option value="record.approve">Approvals</option><option value="record.return">Returns</option>
          <option value="approved.export_csv">CSV downloads</option><option value="access.denied">Refused attempts</option><option value="oversight.">Supervisor views</option>
        </select>
        <select value={outcome} onChange={(e) => reset(() => setOutcome(e.target.value))}>
          <option value="">Any result</option><option value="ok">Done</option><option value="denied">Refused</option><option value="failed">Failed</option>
        </select>
      </div>
      <div className="card">
        {entries.length === 0 ? <p>Nothing matches.</p> : (
          <table>
            <thead><tr><th>When</th><th>Institution</th><th>Person</th><th>What</th><th>Record</th><th>Detail</th><th>Result</th><th>From</th></tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{fmt(e.at)}</td>
                  <td>{e.institution === 'customs' ? 'Customs' : e.institution === 'agl' ? 'AGL' : '\u2014'}</td>
                  <td>{e.userName}{e.email ? <><br /><span style={{ fontSize: 12 }}>{e.email}</span></> : null}</td>
                  <td>{LABEL[e.action] ?? e.action}</td>
                  <td>{e.targetLabel ?? '\u2014'}</td>
                  <td>{e.detail ?? '\u2014'}</td>
                  <td style={e.outcome === 'ok' ? undefined : { color: '#B42318', fontWeight: 700 }}>{e.outcome === 'ok' ? 'Done' : e.outcome === 'denied' ? 'Refused' : 'Failed'}</td>
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
          <span style={{ fontSize: 13 }}>Page {page} of {pages}</span>
          <button className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      ) : null}
    </div>
  );
}
