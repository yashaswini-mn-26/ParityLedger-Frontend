import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Project, TreeNode } from '../api/types';
import { Tree } from '../components/Tree';
import { FolderModal } from '../components/FolderModal';
import { PageFormModal } from '../components/PageFormModal';
import { useToast } from '../components/Toast';

export interface ProjectOutletCtx {
  project: Project;
  refreshTree: () => void;
}

export default function ProjectLayout() {
  const { projectId, pageId } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showPageModal, setShowPageModal] = useState(false);
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  function refreshTree() {
    if (!projectId) return;
    api.getTree(projectId).then(setTree).catch(() => {});
  }

  useEffect(() => {
    if (!projectId) return;
    api.getProject(projectId).then(setProject).catch(() => navigate('/'));
    refreshTree();
  }, [projectId]);

  if (!project || !projectId) {
    return <div className="center-loading"><div className="spinner" /><span>LOADING PROJECT…</span></div>;
  }

  return (
    <div id="shell">
      <aside id="sidebar" className={sidebarOpen ? '' : 'collapsed'}>
        <div className="brand">
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="brand-mark" />
            <div className="brand-text">
              <span className="brand-eyebrow">Migration QA</span>
              <span className="brand-title">Parity Ledger</span>
            </div>
          </Link>
        </div>
        <div style={{ padding: '10px 14px 0', fontSize: 11.5, color: 'var(--text-faint)' }}>
          <Link to="/" style={{ color: 'var(--mig)' }}>← All projects</Link>
        </div>
        <div style={{ padding: '6px 14px 10px', fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: 14 }}>
          {project.name}
        </div>
        {isAdmin && (
          <div className="sidebar-actions">
            <button className="btn-mini" onClick={() => setShowFolderModal(true)}>+ Folder</button>
            <button className="btn-mini" onClick={() => setShowPageModal(true)}>+ Page</button>
          </div>
        )}
        <div id="tree">
          <Tree
            nodes={tree}
            projectId={projectId}
            activePageId={pageId}
            onFolderDeleted={() => {
              refreshTree();
              // If the page currently open lived inside the deleted folder, bounce back to the dashboard.
              if (pageId) {
                api.getPage(pageId).catch(() => navigate(`/projects/${projectId}`));
              }
            }}
          />
        </div>
      </aside>

      <div id="main">
        <div id="topbar">
          <button id="hamburger" onClick={() => setSidebarOpen((o) => !o)} title="Toggle sidebar">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
          <div className="crumbs"><b>{project.name}</b></div>
          <div className="user-chip"><b>{user?.name}</b>&nbsp;· {user?.role}</div>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Log out</button>
        </div>
        <div id="content">
          <Outlet context={{ project, refreshTree } satisfies ProjectOutletCtx} />
        </div>
      </div>

      {showFolderModal && (
        <FolderModal projectId={projectId} onClose={() => setShowFolderModal(false)} onCreated={refreshTree} />
      )}
      {showPageModal && (
        <PageFormModal
          projectId={projectId}
          onClose={() => setShowPageModal(false)}
          onSaved={(newId) => { refreshTree(); navigate(`/projects/${projectId}/pages/${newId}`); }}
        />
      )}
    </div>
  );
}