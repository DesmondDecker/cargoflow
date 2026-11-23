import React, { useCallback, useEffect, useState } from 'react';
import { createInstitutionUser, fetchInstitutionUsers, InstitutionUser, resetInstitutionUserPassword, updateInstitutionUser } from '../api/adminApi';
import { apiErrorMessage } from '../api/client';
import { SetPasswordModal } from '../components/SetPasswordModal';

const fmt = (v?: string) => (v ? new Date(v).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Never');
const LABEL = { customs: 'Customs', agl: 'AGL' } as const;

// Accounts for the people at Customs and AGL who use the customs-verification
// portal. Created here by Summit staff for named people the institutions have
// nominated; there is no self-registration.
export function InstitutionUsersPage() {
  const [users, setUsers] = useState<InstitutionUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<InstitutionUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', institution: 'customs' as 'customs' | 'agl', password: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setUsers(await fetchInstitutionUsers());
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (id: string, action: () => Promise<void>, done: string) => {
    setBusyId(id);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(done);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createInstitutionUser(form);
      setMessage(`${form.name} can now sign in to the portal.`);
      setForm({ name: '', email: '', institution: 'customs', password: '' });
      setCreating(false);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Customs and AGL users</h1>
      <p className="page-subtitle">People at Customs and AGL who use the customs-verification portal. Customs officers review and approve; AGL users see approved records and are emailed when Customs approves.</p>
      {error ? <p className="error-text">{error}</p> : null}
      {message ? <p style={{ color: 'var(--success, #1B7F3B)' }}>{message}</p> : null}
      <div className="toolbar"><button className="btn btn-primary btn-sm" onClick={() => setCreating(!creating)}>{creating ? 'Cancel' : 'Add a user'}</button></div>

      {creating ? (
        <form className="card" onSubmit={create} style={{ maxWidth: 480, marginBottom: 16 }}>
          <div className="field"><label>Full name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="field"><label>Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="field">
            <label>Institution</label>
            <select value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value as 'customs' | 'agl' })}>
              <option value="customs">Customs (review and approve)</option>
              <option value="agl">AGL (view approved records, gets the approval email)</option>
            </select>
          </div>
          <div className="field"><label>Temporary password (10+ characters)</label><input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <button className="btn btn-primary" disabled={saving || !form.name || !form.email || form.password.length < 10}>{saving ? 'Saving…' : 'Create user'}</button>
        </form>
      ) : null}

      <div className="card">
        {users.length === 0 ? <div className="empty-state">No Customs or AGL users yet.</div> : (
          <table className="data">
            <thead><tr><th>Name</th><th>Email</th><th>Institution</th><th>Oversight</th><th>Status</th><th>Last sign-in</th><th /></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{LABEL[u.institution]}{u.institution === 'agl' ? (u.notifyByEmail ? ' · gets approval emails' : ' · no emails') : ''}</td>
                  <td>{u.isSupervisor ? 'Supervisor' : '\u2014'}</td>
                  <td>{u.isActive ? 'Active' : 'Deactivated'}</td>
                  <td>{fmt(u.lastLoginAt)}</td>
                  <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="btn btn-outline btn-sm" disabled={busyId === u.id} onClick={() => run(u.id, () => updateInstitutionUser(u.id, { isActive: !u.isActive }), `${u.name} is now ${u.isActive ? 'deactivated' : 'active'}.`)}>{u.isActive ? 'Deactivate' : 'Reactivate'}</button>
                    {u.institution === 'agl' ? (
                      <button className="btn btn-outline btn-sm" disabled={busyId === u.id} onClick={() => run(u.id, () => updateInstitutionUser(u.id, { notifyByEmail: !u.notifyByEmail }), 'Email setting saved.')}>{u.notifyByEmail ? 'Stop emails' : 'Send emails'}</button>
                    ) : null}
                    <button className="btn btn-outline btn-sm" disabled={busyId === u.id} onClick={() => run(u.id, () => updateInstitutionUser(u.id, { isSupervisor: !u.isSupervisor }), u.isSupervisor ? `${u.name} is no longer a supervisor.` : `${u.name} can now see the staff activity log for ${LABEL[u.institution]}.`)}>{u.isSupervisor ? 'Remove supervisor' : 'Make supervisor'}</button>
                    <button className="btn btn-outline btn-sm" disabled={busyId === u.id} onClick={() => setPasswordTarget(u)}>Reset password</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {passwordTarget ? (
        <SetPasswordModal
          title={`Reset password for ${passwordTarget.name}`}
          warning="This signs them out everywhere. Give them the new password in person or by phone, not by email."
          busy={busyId === passwordTarget.id}
          minLength={10}
          onConfirm={async (pw) => {
            const target = passwordTarget;
            await run(target.id, () => resetInstitutionUserPassword(target.id, pw), `Password reset for ${target.name}.`);
            setPasswordTarget(null);
          }}
          onCancel={() => setPasswordTarget(null)}
        />
      ) : null}
    </div>
  );
}
