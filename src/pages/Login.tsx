import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <div className="brand-mark" />
          <div className="brand-text">
            <span className="brand-eyebrow">Migration QA</span>
            <span className="brand-title">Parity Ledger</span>
          </div>
        </div>
        <div className="login-title">Sign in</div>
        <div className="login-sub">Track VB.NET → React/Django migration parity, page by page.</div>

        {error && <div className="form-error">{error}</div>}

        <div className="field">
          <label>Username</label>
          <input type="text" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} placeholder="jane.doe" />
        </div>
        <div className="field" style={{ marginBottom: 20 }}>
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        <button className="btn btn-accent" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 16, textAlign: 'center' }}>
          Don't have an account? Ask an admin to create one for you.
        </div>
      </form>
    </div>
  );
}
