
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { CreateUserRole, UserSummary } from '../api/types';
import { useToast } from '../components/Toast';

export default function UsersAdmin() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<CreateUserRole>('user');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const data = await api.listUsers();
      setUsers(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Could not load users';

      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (saving) return;

    if (!username.trim() || !password.trim()) {
      setError('Username and password are required');
      return;
    }

    setError('');
    setSaving(true);

    try {
      await api.createUser({
        username: username.trim(),
        password,
        name: name.trim() || username.trim(),
        role,
      });

      toast('User created');

      setUsername('');
      setName('');
      setPassword('');
      setRole('user');

      await load();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Could not create user'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <div id="topbar">
        <div className="brand" style={{ border: 'none', padding: 0 }}>
          <div className="brand-mark" />
          <div className="brand-text">
            <span className="brand-eyebrow">Migration QA</span>
            <span className="brand-title">Parity Ledger</span>
          </div>
        </div>

        <div className="crumbs" />

        <Link to="/" className="btn btn-ghost">
          ← Projects
        </Link>
      </div>

      <div className="view">
        <div className="view-header">
          <div>
            <div className="view-eyebrow">Administration</div>
            <div className="view-title">Users &amp; roles</div>
            <div className="view-sub">
              Create logins for reviewers and developers. Admins can manage
              the ledger; users review, comment, and verify; developers get
              assigned pages to fix.
            </div>
          </div>
        </div>

        <div className="panel" style={{ maxWidth: 520 }}>
          <div className="panel-title">Create a login</div>

          <form onSubmit={create}>
            {error && <div className="form-error">{error}</div>}

            <div className="row2">
              <div className="field">
                <label>Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={saving}
                  autoComplete="off"
                />
              </div>

              <div className="field">
                <label>Full name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="row2">
              <div className="field">
                <label>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={saving}
                  autoComplete="new-password"
                />
              </div>

              <div className="field">
                <label>Role</label>
                <select
                  value={role}
                  onChange={(e) =>
                    setRole(e.target.value as CreateUserRole)
                  }
                  disabled={saving}
                >
                  <option value="user">User (reviewer)</option>
                  <option value="developer">Developer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-accent"
              disabled={saving}
            >
              {saving ? 'Creating…' : 'Create login'}
            </button>
          </form>
        </div>

        <div className="section-label">All users</div>

        {loadError && (
          <div className="form-error">
            {loadError}
            <button
              type="button"
              className="btn"
              onClick={load}
              style={{ marginLeft: 10 }}
            >
              Retry
            </button>
          </div>
        )}

        <div className="table-wrap">
          <table className="page-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Role</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3}>Loading users…</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={3}>No users found</td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td className="pt-name">{u.name}</td>
                    <td className="pt-num">{u.username}</td>
                    <td>
                      <span className="badge role">{u.role}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
