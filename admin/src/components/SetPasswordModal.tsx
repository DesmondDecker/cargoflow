import React, { useState } from 'react';

interface Props {
  title: string;
  warning: string;
  busy: boolean;
  onConfirm: (newPassword: string) => void;
  onCancel: () => void;
}

export function SetPasswordModal({ title, warning, busy, onConfirm, onCancel }: Props) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    onConfirm(password);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="card-title">{title}</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>{warning}</p>

        <div className="field">
          <label>New Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" autoFocus />
        </div>
        <div className="field">
          <label>Confirm Password</label>
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password" />
        </div>

        {error && <p className="error-text">{error}</p>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline" onClick={onCancel} style={{ flex: 1 }}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy} style={{ flex: 1 }}>
            {busy ? 'Setting…' : 'Set Password'}
          </button>
        </div>
      </div>
    </div>
  );
}
