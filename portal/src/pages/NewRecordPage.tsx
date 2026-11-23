import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { createAssisted, FIELDS, FieldKey, Submission } from '../api/portalApi';
import { apiErrorMessage } from '../api/client';

const EMPTY = { cvcNumber: '', billOfLadingNumber: '', shippingAgency: '', containerNumber: '', documentName: '', itsNumber: '', onBehalfOf: '' };

// Customs-assisted submission: the agent gives the details to an officer, who
// enters them here. The record goes into the same queue and is reviewed like
// any other.
export function NewRecordPage() {
  const [values, setValues] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [created, setCreated] = useState<{ submission: Submission; warnings: string[] } | null>(null);

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setValues({ ...values, [key]: e.target.value });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      setCreated(await createAssisted(values));
      setValues(EMPTY);
    } catch (err) {
      setError(apiErrorMessage(err));
      if (axios.isAxiosError(err)) setFieldErrors((err.response?.data as { error?: { details?: Partial<Record<FieldKey, string>> } } | undefined)?.error?.details ?? {});
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1 className="page-title">Enter a record for an agent</h1>
      <p className="page-subtitle">For an agent who cannot or prefers not to submit through their own account. It joins the review queue like any other record.</p>

      {created ? (
        <div className="notice" style={{ background: '#E6F6EC', color: '#1B5E30' }}>
          Added to the queue: <Link to={`/queue/${created.submission._id}`}>{created.submission.containerNumber}</Link>.
          {created.warnings.map((w) => <div key={w}>{w}</div>)}
        </div>
      ) : null}

      <form className="card" onSubmit={onSubmit} style={{ maxWidth: 640 }}>
        <div className="field">
          <label>Agent (name or company)</label>
          <input value={values.onBehalfOf} onChange={set('onBehalfOf')} />
        </div>
        <div className="two-col">
          {FIELDS.map((f) => (
            <div className="field" key={f.key}>
              <label>{f.label}</label>
              <input value={values[f.key]} onChange={set(f.key)} />
              {fieldErrors[f.key] ? <span className="error-text">{fieldErrors[f.key]}</span> : null}
            </div>
          ))}
        </div>
        {error && Object.keys(fieldErrors).length === 0 ? <p className="error-text">{error}</p> : null}
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add to the queue'}</button>
      </form>
    </>
  );
}
