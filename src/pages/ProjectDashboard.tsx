import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { PageSummary, PageStatus } from '../api/types';
import { StatusBadge } from '../components/StatusBadge';
import type { ProjectOutletCtx } from './ProjectLayout';
import { useToast } from '../components/Toast';

type FilterStatus = 'all' | PageStatus;

export default function ProjectDashboard() {
  const { project } = useOutletContext<ProjectOutletCtx>();
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const navigate = useNavigate();
  const toast = useToast();

  function load() {
    setLoading(true);
    api.listPages(project.id).then(setPages).finally(() => setLoading(false));
  }
  useEffect(load, [project.id]);

  // Debounced server-side search when a query is typed; otherwise use the full cached list.
  useEffect(() => {
    const handle = setTimeout(() => {
      if (!search.trim() && statusFilter === 'all') { load(); return; }
      setLoading(true);
      api.search(project.id, search.trim(), statusFilter)
        .then(setPages)
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [search, statusFilter, project.id]);

  const stats = useMemo(() => {
    const verified = pages.filter((p) => p.status === 'verified').length;
    const mismatch = pages.filter((p) => p.status === 'mismatch').length;
    const pending = pages.filter((p) => p.status === 'pending').length;
    return { total: pages.length, verified, mismatch, pending };
  }, [pages]);

  async function exportProject() {
    try {
      await api.downloadFile(api.projectExcelUrl(project.id), `${project.name}-parity-summary.xlsx`);
    } catch (e: any) {
      toast(e.message);
    }
  }

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="view-eyebrow">Migration Parity Audit</div>
          <div className="view-title">{project.name}</div>
          <div className="view-sub">{project.description || 'Every migrated page logged against its original behaviour: APIs, raw queries, tables touched, and row impact.'}</div>
        </div>
        <button className="btn" onClick={exportProject}>Export project (Excel)</button>
      </div>

      <div className="stat-row">
        <div className="stat-card c-total" onClick={() => setStatusFilter('all')}><div className="stat-num">{stats.total}</div><div className="stat-label">Pages logged</div></div>
        <div className="stat-card c-verified" onClick={() => setStatusFilter('verified')}><div className="stat-num">{stats.verified}</div><div className="stat-label">Verified parity</div></div>
        <div className="stat-card c-mismatch" onClick={() => setStatusFilter('mismatch')}><div className="stat-num">{stats.mismatch}</div><div className="stat-label">Mismatch found</div></div>
        <div className="stat-card c-pending" onClick={() => setStatusFilter('pending')}><div className="stat-num">{stats.pending}</div><div className="stat-label">Pending review</div></div>
      </div>

      <div className="section-label">All pages</div>
      <div className="filter-row">
        {(['all', 'verified', 'mismatch', 'pending'] as FilterStatus[]).map((s) => (
          <button key={s} className={`chip-filter ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
            {s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
        <div className="topbar-search" style={{ marginLeft: 'auto' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.5, flex: 'none' }}><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" /><path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          <input type="text" placeholder="Search pages, paths, tables…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="empty-state"><b>Loading…</b></div>
      ) : pages.length === 0 ? (
        <div className="empty-state"><b>No pages match</b>Try a different status or search term.</div>
      ) : (
        <div className="table-wrap">
          <table className="page-table">
            <thead><tr><th>Page</th><th>APIs</th><th>Queries</th><th>Tables</th><th>Reviewer</th><th>Status</th></tr></thead>
            <tbody>
              {pages.map((p) => (
                <tr className="pagerow" key={p.id} onClick={() => navigate(`/projects/${project.id}/pages/${p.id}`)}>
                  <td>
                    <div className="pt-name">{p.name}</div>
                    <div className="pt-path">{p.path}</div>
                  </td>
                  <td className="pt-num">{p.api_count}</td>
                  <td className="pt-num">{p.query_count}</td>
                  <td className="pt-num">{p.table_count}</td>
                  <td className="pt-num">{p.reviewed_by_name || '—'}</td>
                  <td><StatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
