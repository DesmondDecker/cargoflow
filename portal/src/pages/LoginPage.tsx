import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);
  const storeError = useAuthStore((s) => s.error);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    if (!email || !password) return setValidationError('Enter your email and password.');
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch {
      // the store already holds the server's message
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div className="sidebar-logo">C</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--navy)' }}>Cargo Flow</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Customs verification portal</div>
          </div>
        </div>
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus autoComplete="username" />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        {(validationError || storeError) && <p className="error-text">{validationError || storeError}</p>}
        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 16 }}>Accounts are created for named Customs and AGL staff. Contact Summit Technologies if you need access. Warehouse owner? <a href="/warehouse/login">Sign in here</a>.</p>
      </form>
    </div>
  );
}
