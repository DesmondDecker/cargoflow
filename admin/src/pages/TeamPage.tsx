import React, { useEffect, useState } from 'react';
import {
  fetchPlatformAdmins,
  createPlatformAdmin,
  deactivatePlatformAdmin,
  changeOwnPassword,
} from '../api/adminApi';
import { apiErrorMessage } from '../api/client';
import { PlatformAdmin } from '../types';
import { useAuthStore } from '../store/authStore';

function formatDate(value?: string): string {
  if (!value) return 'Never';
  return new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function TeamPage() {
  const currentAdmin = useAuthStore((s) => s.admin);
  const [admins, setAdmins] = useState<PlatformAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [ownNewPassword, setOwnNewPassword] = useState('');
  const [ownNewPasswordConfirm, setOwnNewPasswordConfirm] = useState('');
  const [changingOwn, setChangingOwn] = useState(false);
  const [ownPasswordSuccess, setOwnPasswordSuccess] = useState<string | null>(null);
  const [ownPasswordError, setOwnPasswordError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchPlatformAdmins()
      .then(setAdmins)
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const onCreate = async () => {
    if (!newName.trim() || !newEmail.trim() || newPassword.length < 8) return;
    setCreating(true);
    setError(null);
    try {
      await createPlatformAdmin(newName.trim(), newEmail.trim(), newPassword);
      setCreateSuccess(`Admin account created for ${newEmail}. Share the password with them directly.`);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const onDeactivate = async (id: string) => {
    try {
      await deactivatePlatformAdmin(id);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const onChangeOwnPassword = async () => {
    setOwnPasswordError(null);
    setOwnPasswordSuccess(null);
    if (ownNewPassword.length < 8) {
      setOwnPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (ownNewPassword !== ownNewPasswordConfirm) {
      setOwnPasswordError('Passwords do not match.');
      return;
    }
    setChangingOwn(true);
    try {
      await changeOwnPassword(currentPassword, ownNewPassword);
      setOwnPasswordSuccess('Password updated.');
      setCurrentPassword('');
      setOwnNewPassword('');
      setOwnNewPasswordConfirm('');
    } catch (err) {
      setOwnPasswordError(apiErrorMessage(err));
    } finally {
      setChangingOwn(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Team</h1>
      <p className="page-subtitle">Your own account, and the other Summit Technologies staff with admin access.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div className="card">
          <h2 className="card-title">Change Your Password</h2>
          <div className="field">
            <label>Current Password</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div className="field">
            <label>New Password</label>
            <input type="password" value={ownNewPassword} onChange={(e) => setOwnNewPassword(e.target.value)} placeholder="At least 8 characters" />
          </div>
          <div className="field">
            <label>Confirm New Password</label>
            <input type="password" value={ownNewPasswordConfirm} onChange={(e) => setOwnNewPasswordConfirm(e.target.value)} />
          </div>
          {ownPasswordError && <p className="error-text">{ownPasswordError}</p>}
          {ownPasswordSuccess && <p style={{ color: 'var(--normal)', fontSize: 14, marginBottom: 12 }}>{ownPasswordSuccess}</p>}
          <button className="btn btn-primary" onClick={onChangeOwnPassword} disabled={changingOwn || !currentPassword || !ownNewPassword}>
            {changingOwn ? 'Updating…' : 'Update Password'}
          </button>
        </div>

        <div className="card">
          <h2 className="card-title">Add a Team Member</h2>
          <div className="field">
            <label>Name</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          </div>
          <div className="field">
            <label>Temporary Password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" />
          </div>
          {createSuccess && <p style={{ color: 'var(--normal)', fontSize: 14, marginBottom: 12 }}>{createSuccess}</p>}
          <button className="btn btn-primary" onClick={onCreate} disabled={creating || !newName.trim() || !newEmail.trim() || newPassword.length < 8}>
            {creating ? 'Creating…' : 'Create Admin Account'}
          </button>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card">
        <h2 className="card-title">Admin Accounts</h2>
        {loading ? (
          <p>Loading…</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Last Login</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin._id}>
                  <td>{admin.name}</td>
                  <td>{admin.email}</td>
                  <td>
                    <span className={`badge status-${admin.isActive ? 'active' : 'canceled'}`}>{admin.isActive ? 'Active' : 'Deactivated'}</span>
                  </td>
                  <td>{formatDate(admin.lastLoginAt)}</td>
                  <td>
                    {admin.isActive && admin._id !== currentAdmin?.id && (
                      <button className="btn btn-danger btn-sm" onClick={() => admin._id && onDeactivate(admin._id)}>
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
