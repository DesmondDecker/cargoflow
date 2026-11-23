import React, { useCallback, useEffect, useState } from 'react';
import { createPlan, fetchAllPlans, Plan, updatePlan } from '../api/adminApi';
import { apiErrorMessage } from '../api/client';

const blank = { planId: '', name: '', amount: '', currency: 'SLE', periodDays: '30', description: '' };

// The subscription plans agencies can pay for. Editing a plan changes what new
// payments are charged and how long they last; agencies already subscribed
// keep what they paid for until it ends.
export function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [edit, setEdit] = useState({ name: '', amount: '', currency: '', periodDays: '', description: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setPlans(await fetchAllPlans());
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (action: () => Promise<void>, done: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(done);
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (p: Plan) => {
    setEditing(p.id);
    setEdit({ name: p.name, amount: String(p.amount), currency: p.currency, periodDays: String(p.periodDays), description: p.description ?? '' });
  };

  return (
    <div>
      <h1 className="page-title">Subscription plans</h1>
      <p className="page-subtitle">Changes apply to payments made from now on. Agencies already subscribed keep what they paid for until it ends. A plan that is switched off can no longer be bought.</p>
      {error ? <p className="error-text">{error}</p> : null}
      {message ? <p style={{ color: 'var(--success, #1B7F3B)' }}>{message}</p> : null}
      <div className="toolbar"><button className="btn btn-primary btn-sm" onClick={() => setCreating(!creating)}>{creating ? 'Cancel' : 'Add a plan'}</button></div>

      {creating ? (
        <form
          className="card"
          style={{ maxWidth: 520, marginBottom: 16 }}
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await createPlan({ planId: form.planId, name: form.name, amount: Number(form.amount), currency: form.currency, periodDays: Number(form.periodDays), description: form.description || undefined });
              setForm(blank);
              setCreating(false);
            }, 'Plan created.');
          }}
        >
          <div className="field"><label>Plan id (lowercase, e.g. monthly)</label><input value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })} /></div>
          <div className="field"><label>Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="field"><label>Price</label><input type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
          <div className="field"><label>Currency (3 letters)</label><input value={form.currency} maxLength={3} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} /></div>
          <div className="field"><label>Lasts (days)</label><input type="number" min="1" value={form.periodDays} onChange={(e) => setForm({ ...form, periodDays: e.target.value })} /></div>
          <div className="field"><label>Description (optional)</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <button className="btn btn-primary" disabled={busy || !form.planId || !form.name || form.amount === '' || form.currency.length !== 3}>Create plan</button>
        </form>
      ) : null}

      <div className="card">
        {plans.length === 0 ? <div className="empty-state">No plans yet.</div> : (
          <table className="data">
            <thead><tr><th>Plan</th><th>Price</th><th>Lasts</th><th>Status</th><th /></tr></thead>
            <tbody>
              {plans.map((p) =>
                editing === p.id ? (
                  <tr key={p.id}>
                    <td colSpan={5}>
                      <div className="two-col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                        <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Name" />
                        <input type="number" min="0" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} placeholder="Price" />
                        <input value={edit.currency} maxLength={3} onChange={(e) => setEdit({ ...edit, currency: e.target.value.toUpperCase() })} placeholder="Currency" />
                        <input type="number" min="1" value={edit.periodDays} onChange={(e) => setEdit({ ...edit, periodDays: e.target.value })} placeholder="Days" />
                        <input value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} placeholder="Description" />
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(async () => { await updatePlan(p.id, { name: edit.name, amount: Number(edit.amount), currency: edit.currency, periodDays: Number(edit.periodDays), description: edit.description }); setEditing(null); }, `${p.name} updated.`)}>Save</button>
                        <button className="btn btn-outline btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong><br /><span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{p.id}{p.description ? ` · ${p.description}` : ''}</span></td>
                    <td>{p.currency} {p.amount.toLocaleString()}</td>
                    <td>{p.periodDays} days</td>
                    <td>{p.isActive ? 'For sale' : 'Switched off'}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => startEdit(p)}>Edit</button>
                      <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => run(() => updatePlan(p.id, { isActive: !p.isActive }), `${p.name} is ${p.isActive ? 'switched off' : 'for sale again'}.`)}>{p.isActive ? 'Switch off' : 'Switch on'}</button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
