import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { approve, fetchApprovedItem, fetchQueueItem, FIELDS, resendEmail, returnSubmission, Submission } from '../api/portalApi';
import { apiErrorMessage } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { fmt } from '../utils';

const ACTION_LABEL: Record<string, string> = {
  submitted: 'Submitted', resubmitted: 'Corrected and resubmitted', approved: 'Approved', returned: 'Returned for correction',
  email_sent: 'Approval email sent', email_failed: 'Approval email failed', email_not_configured: 'Approval email not sent',
};

const EMAIL_TEXT: Record<Submission['email']['status'], string> = {
  none: 'Not sent yet',
  sent: 'Sent to AGL',
  failed: 'Failed to send',
  not_configured: 'Not sent: email is not set up on the server',
};

// One record: the six fields, who sent it, and its full history. Customs
// officers decide a pending record here; everyone else sees it read-only.
export function RecordPage({ mode }: { mode: 'review' | 'approved' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [s, setS] = useState<Submission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [returning, setReturning] = useState(false);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setS(mode === 'review' ? await fetchQueueItem(id) : await fetchApprovedItem(id));
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }, [id, mode]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (action: () => Promise<Submission>) => {
    setBusy(true);
    setError(null);
    try {
      setS(await action());
      setReturning(false);
      setReason('');
    } catch (err) {
      setError(apiErrorMessage(err));
      load(); // someone else may have decided it: show the current state
    } finally {
      setBusy(false);
    }
  };

  if (!s) return <>{error ? <p className="error-text">{error}</p> : null}</>;

  const decidable = mode === 'review' && s.status === 'pending';

  return (
    <>
      <button className="btn btn-outline btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 12 }}>Back</button>
      <h1 className="page-title">{s.containerNumber} <StatusBadge status={s.status} /></h1>
      <p className="page-subtitle">
        {s.source === 'customs_assisted' ? `Entered by Customs for ${s.onBehalfOf}` : `Submitted by ${s.submittedByName}`} on {fmt(s.submittedAt)}
        {s.submissionCount > 1 ? ` (submitted ${s.submissionCount} times)` : ''}
      </p>
      {error ? <p className="error-text">{error}</p> : null}
      {s.selfApproved ? <div className="notice">This record was entered and approved by the same officer.</div> : null}

      <div className="card">
        <dl className="detail-grid">
          {FIELDS.map((f) => (
            <React.Fragment key={f.key}>
              <dt>{f.label}</dt>
              <dd>{s[f.key]}</dd>
            </React.Fragment>
          ))}
        </dl>
      </div>

      {s.status === 'approved' ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-title">Approval</div>
          <dl className="detail-grid">
            <dt>Approval reference</dt><dd>{s.approvalReference}</dd>
            <dt>Approved by</dt><dd>{s.reviewedByName}</dd>
            <dt>Approved at</dt><dd>{fmt(s.reviewedAt)}</dd>
            <dt>Email to AGL</dt><dd>{EMAIL_TEXT[s.email.status]}{s.email.attemptedAt ? ` (${fmt(s.email.attemptedAt)})` : ''}</dd>
          </dl>
          {mode === 'review' && s.email.status !== 'sent' ? (
            <div className="actions"><button className="btn btn-outline btn-sm" disabled={busy} onClick={() => run(() => resendEmail(s._id))}>Send the email again</button></div>
          ) : null}
        </div>
      ) : null}

      {s.status === 'returned' ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-title">Returned for correction</div>
          <p>{s.returnReason}</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>By {s.reviewedByName} on {fmt(s.reviewedAt)}. The agent corrects it and resubmits; it then comes back to the queue.</p>
        </div>
      ) : null}

      {decidable ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-title">Your decision</div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Check these details against Customs' own records. Approval is final: a decided record is not decided again. Cargo Flow does not verify the duty payment and makes no decision for you.</p>
          {returning ? (
            <>
              <div className="field">
                <label>What needs correcting?</label>
                <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus style={{ width: '100%' }} />
              </div>
              <div className="actions">
                <button className="btn btn-danger" disabled={busy || reason.trim().length < 3} onClick={() => run(() => returnSubmission(s._id, reason.trim()))}>Return to the agent</button>
                <button className="btn btn-outline" disabled={busy} onClick={() => setReturning(false)}>Cancel</button>
              </div>
            </>
          ) : (
            <div className="actions">
              <button className="btn btn-primary" disabled={busy} onClick={() => { if (window.confirm(`Approve ${s.containerNumber} (CVC ${s.cvcNumber})? This is final and notifies AGL by email.`)) run(() => approve(s._id)); }}>Approve</button>
              <button className="btn btn-outline" disabled={busy} onClick={() => setReturning(true)}>Return for correction</button>
            </div>
          )}
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-title">History</div>
        <ul className="history">
          {[...s.history].reverse().map((h, i) => (
            <li key={i}>
              <strong>{ACTION_LABEL[h.action] ?? h.action}</strong> by {h.actorName} <span style={{ color: 'var(--text-secondary)' }}>{fmt(h.at)}</span>
              {h.note ? <div style={{ color: 'var(--text-secondary)' }}>{h.note}</div> : null}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
