
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { api } from '../api/client';
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
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const navigate = useNavigate();
  const toast = useToast();

  // Prevent older requests from overwriting newer search results.
  const requestId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const currentRequest = ++requestId.current;

    const handle = setTimeout(async () => {
      setLoading(true);
      setError('');

      try {
        let result: PageSummary[];

        if (!search.trim() && statusFilter === 'all') {
          result = await api.listPages(project.id);
        } else {
          result = await api.search(
            project.id,
            search.trim(),
            statusFilter
          );
        }

        if (!cancelled && currentRequest === requestId.current) {
          setPages(result);
        }
      } catch (err: unknown) {
        if (!cancelled && currentRequest === requestId.current) {
          setError(
            err instanceof Error
              ? err.message
              : 'Could not load project pages'
          );
        }
      } finally {
        if (!cancelled && currentRequest === requestId.current) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [project.id, search, statusFilter, refreshKey]);

  const stats = useMemo(() => {
    const verified = pages.filter(
      (p) => p.status === 'verified'
    ).length;

    const mismatch = pages.filter(
      (p) => p.status === 'mismatch'
    ).length;

    const pending = pages.filter(
      (p) => p.status === 'pending'
    ).length;

    return {
      total: pages.length,
      verified,
      mismatch,
      pending,
    };
  }, [pages]);

  async function exportProject() {
    try {
      await api.downloadFile(
        api.projectExcelUrl(project.id),
        `${project.name}-parity-summary.xlsx`
      );
      toast('Project exported successfully');
    } catch (err: unknown) {
      toast(
        err instanceof Error
          ? err.message
          : 'Could not export project'
      );
    }
  }

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="view-eyebrow">Migration Parity Audit</div>
          <div className="view-title">{project.name}</div>
          <div className="view-sub">
            {project.description ||
              'Every migrated page logged against its original behaviour: APIs, raw queries, tables touched, and row impact.'}
          </div>
        </div>

        <button className="btn" onClick={exportProject}>
          Export project (Excel)
        </button>
      </div>

      <div className="stat-row">
        <div
          className="stat-card c-total"
          onClick={() => setStatusFilter('all')}
          style={{ cursor: 'pointer' }}
        >
          <div className="stat-num">{stats.total}</div>
          <div className="stat-label">Pages logged</div>
        </div>

        <div
          className="stat-card c-verified"
          onClick={() => setStatusFilter('verified')}
          style={{ cursor: 'pointer' }}
        >
          <div className="stat-num">{stats.verified}</div>
          <div className="stat-label">Verified parity</div>
        </div>

        <div
          className="stat-card c-mismatch"
          onClick={() => setStatusFilter('mismatch')}
          style={{ cursor: 'pointer' }}
        >
          <div className="stat-num">{stats.mismatch}</div>
          <div className="stat-label">Mismatch found</div>
        </div>

        <div
          className="stat-card c-pending"
          onClick={() => setStatusFilter('pending')}
          style={{ cursor: 'pointer' }}
        >
          <div className="stat-num">{stats.pending}</div>
          <div className="stat-label">Pending review</div>
        </div>
      </div>

      <div className="section-label">All pages</div>

      <div className="filter-row">
        {(['all', 'verified', 'mismatch', 'pending'] as FilterStatus[]).map(
          (status) => (
            <button
              key={status}
              className={`chip-filter ${statusFilter === status ? 'active' : ''
                }`}
              onClick={() => setStatusFilter(status)}
            >
              {status[0].toUpperCase() + status.slice(1)}
            </button>
          )
        )}

        <div className="topbar-search" style={{ marginLeft: 'auto' }}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            style={{ opacity: 0.5, flex: 'none' }}
          >
            <circle
              cx="11"
              cy="11"
              r="7"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M21 21l-4.3-4.3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>

          <input
            type="text"
            placeholder="Search pages, paths, tables…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="empty-state">
          <b>Loading…</b>
        </div>
      ) : error ? (
        <div className="empty-state">
          <b>Could not load pages</b>
          {error}
          <button
            className="btn"
            onClick={() => {
              // Trigger a fresh request without changing the search.
              setRefreshKey((value) => value + 1);
              setSearch((value) => value);
              setStatusFilter((value) => value);
              setError('');
              setLoading(true);
              requestId.current++;
            }}
          >
            Retry
          </button>
        </div>
      ) : pages.length === 0 ? (
        <div className="empty-state">
          <b>No pages match</b>
          Try a different status or search term.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="page-table">
            <thead>
              <tr>
                <th>Page</th>
                <th>APIs</th>
                <th>Queries</th>
                <th>Tables</th>
                <th>Reviewer</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {pages.map((page) => (
                <tr
                  className="pagerow"
                  key={page.id}
                  onClick={() =>
                    navigate(
                      `/projects/${project.id}/pages/${page.id}`
                    )
                  }
                >
                  <td>
                    <div className="pt-name">{page.name}</div>
                    <div className="pt-path">{page.path}</div>
                  </td>

                  <td className="pt-num">{page.api_count}</td>
                  <td className="pt-num">{page.query_count}</td>
                  <td className="pt-num">{page.table_count}</td>

                  <td className="pt-num">
                    {page.reviewed_by_name || '—'}
                  </td>

                  <td>
                    <StatusBadge status={page.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
