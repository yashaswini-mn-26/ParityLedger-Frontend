import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Role, UserSummary } from '../api/types';
import { useToast } from '../components/Toast';

export default function UsersAdmin() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('user');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  function load() {
    api.listUsers().then(setUsers).catch(() => {});
  }
  useEffect(load, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.createUser({ username, password, name: name || username, role });
      toast('User created');
      setUsername(''); setName(''); setPassword(''); setRole('user');
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <div id="topbar">
        <div className="brand" style={{ border: 'none', padding: 0 }}>
          <div className="brand-mark" />
          <div className="brand-text"><span className="brand-eyebrow">Migration QA</span><span className="brand-title">Parity Ledger</span></div>
        </div>
        <div className="crumbs" />
        <Link to="/" className="btn btn-ghost">← Projects</Link>
      </div>

      <div className="view">
        <div className="view-header">
          <div>
            <div className="view-eyebrow">Administration</div>
            <div className="view-title">Users &amp; roles</div>
            <div className="view-sub">Create logins for reviewers and developers. Admins can add/edit the ledger; users review, comment, and verify; developers get assigned pages to fix.</div>
          </div>
        </div>

        <div className="panel" style={{ maxWidth: 520 }}>
          <div className="panel-title">Create a login</div>
          <form onSubmit={create}>
            {error && <div className="form-error">{error}</div>}
            <div className="row2">
              <div className="field"><label>Username</label><input type="text" value={username} onChange={(e) => setUsername(e.target.value)} /></div>
              <div className="field"><label>Full name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} /></div>
            </div>
            <div className="row2">
              <div className="field"><label>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <div className="field">
                <label>Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  <option value="user">User (reviewer)</option>
                  <option value="developer">Developer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <button className="btn btn-accent" disabled={saving}>{saving ? 'Creating…' : 'Create login'}</button>
          </form>
        </div>

        <div className="section-label">All users</div>
        <div className="table-wrap">
          <table className="page-table">
            <thead><tr><th>Name</th><th>Username</th><th>Role</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="pt-name">{u.name}</td>
                  <td className="pt-num">{u.username}</td>
                  <td><span className="badge role">{u.role}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
