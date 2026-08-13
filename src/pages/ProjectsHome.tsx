import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Project } from '../api/types';
import { ProjectModal } from '../components/ProjectModal';
import { useToast } from '../components/Toast';

export default function ProjectsHome() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  function load() {
    setLoading(true);
    api.listProjects().then(setProjects).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function remove(id: string, name: string) {
    if (!confirm(`Delete project "${name}" and everything in it? This can't be undone.`)) return;
    try {
      await api.deleteProject(id);
      toast('Project deleted');
      load();
    } catch (e: any) {
      toast(e.message);
    }
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <div id="topbar" style={{ borderBottom: '1px solid var(--border-soft)' }}>
        <div className="brand" style={{ border: 'none', padding: 0 }}>
          <div className="brand-mark" />
          <div className="brand-text">
            <span className="brand-eyebrow">Migration QA</span>
            <span className="brand-title">Parity Ledger</span>
          </div>
        </div>
        <div className="crumbs" />
        <div className="user-chip"><b>{user?.name}</b>&nbsp;· {user?.role}</div>
        {isAdmin && <button className="btn btn-ghost" onClick={() => navigate('/admin/users')}>Manage users</button>}
        <button className="btn btn-ghost" onClick={logout}>Log out</button>
      </div>

      <div className="view">
        <div className="view-header">
          <div>
            <div className="view-eyebrow">Migration Parity Audit</div>
            <div className="view-title">Projects</div>
            <div className="view-sub">Pick a project to review its migration ledger, or create a new one.</div>
          </div>
          {isAdmin && <button className="btn btn-accent" onClick={() => setShowModal(true)}>+ New project</button>}
        </div>

        {loading ? (
          <div className="empty-state"><b>Loading…</b></div>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            <b>No projects yet</b>
            {isAdmin ? 'Click "New project" to create the first one.' : 'Ask an admin to create a project.'}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="page-table">
              <thead>
                <tr><th>Project</th><th>Folders</th><th>Pages</th><th>Created</th>{isAdmin && <th></th>}</tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr className="pagerow" key={p.id} onClick={() => navigate(`/projects/${p.id}`)}>
                    <td>
                      <div className="pt-name">{p.name}</div>
                      {p.description && <div className="pt-path">{p.description}</div>}
                    </td>
                    <td className="pt-num">{p.folder_count ?? '—'}</td>
                    <td className="pt-num">{p.page_count ?? '—'}</td>
                    <td className="pt-num">{p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</td>
                    {isAdmin && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <button className="btn btn-ghost btn-danger btn-sm" onClick={() => remove(p.id, p.name)}>Delete</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && <ProjectModal onClose={() => setShowModal(false)} onCreated={load} />}
    </div>
  );
}
