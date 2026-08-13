import React, { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { PageDoc } from '../api/types';
import { StatusSeal } from '../components/StatusBadge';
import { PageFormModal } from '../components/PageFormModal';
import { ReviewPanel } from '../components/ReviewPanel';
import { ApprovalBox, AssignBox } from '../components/ApprovalAssign';
import { CommentsPanel } from '../components/CommentsPanel';
import type { ProjectOutletCtx } from './ProjectLayout';
import { useToast } from '../components/Toast';
import { ImageLightbox } from '../components/ImageLightbox';

function computeStats(page: PageDoc) {
  let select = 0, insert = 0, update = 0, del = 0;
  page.apis.forEach((a) => a.queries.forEach((q) => {
    if (q.type === 'SELECT') select++;
    else if (q.type === 'INSERT') insert++;
    else if (q.type === 'UPDATE') update++;
    else if (q.type === 'DELETE') del++;
  }));
  return { select, insert, update, delete: del, total: select + insert + update + del, apis: page.apis.length };
}

function tableSummary(page: PageDoc) {
  const map: Record<string, { columns: Set<string>; select: number; insert: number; update: number; delete: number; maxRows: string[] }> = {};
  page.apis.forEach((a) => a.queries.forEach((q) => {
    q.tables.forEach((t) => {
      if (!t.trim()) return;
      if (!map[t]) map[t] = { columns: new Set(), select: 0, insert: 0, update: 0, delete: 0, maxRows: [] };
      const key = q.type.toLowerCase() as 'select' | 'insert' | 'update' | 'delete';
      map[t][key]++;
      q.columns.forEach((c) => c.trim() && map[t].columns.add(c.trim()));
      if (q.maxRows) map[t].maxRows.push(q.maxRows);
    });
  }));
  return map;
}

export default function PageDetail() {
  const { project, refreshTree } = useOutletContext<ProjectOutletCtx>();
  const { pageId } = useParams();
  const [page, setPage] = useState<PageDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [openApis, setOpenApis] = useState<Set<string>>(new Set());
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  function load() {
    if (!pageId) return;
    setLoading(true);
    api.getPage(pageId).then((p) => { setPage(p); setOpenApis(new Set(p.apis.map((a) => a.id))); }).finally(() => setLoading(false));
  }
  useEffect(load, [pageId]);

  async function remove() {
    if (!page || !confirm(`Delete "${page.name}" from the ledger? This can't be undone.`)) return;
    try {
      await api.deletePage(page.id);
      toast('Page deleted');
      refreshTree();
      navigate(`/projects/${project.id}`);
    } catch (e: any) {
      toast(e.message);
    }
  }

  if (loading || !page) {
    return <div className="empty-state" style={{ margin: 32 }}><b>Loading page…</b></div>;
  }

  const stats = computeStats(page);
  const tables = tableSummary(page);

  return (
    <div className="view">
      <div className="detail-header">
        <div>
          <div className="view-eyebrow">Page review</div>
          <div className="view-title">{page.name}</div>
          <div className="detail-path">{page.path}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <StatusSeal status={page.status} />
          <div className="detail-actions">
            <button className="btn btn-ghost" onClick={() => navigate(`/projects/${project.id}`)}>Dashboard</button>
            {isAdmin && (
              <>
                <button className="btn btn-ghost" onClick={() => setShowEdit(true)}>Edit</button>
                <button className="btn btn-ghost btn-danger" onClick={remove}>Delete</button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="chipstats">
        <div className="chipstat"><b>{stats.apis}</b><span>APIs</span></div>
        <div className="chipstat"><b>{stats.total}</b><span>Queries</span></div>
        <div className="chipstat k-select" onClick={() => navigate(`/projects/${project.id}/pages/${page.id}/queries/SELECT`)}><b>{stats.select}</b><span>Select</span></div>
        <div className="chipstat k-insert" onClick={() => navigate(`/projects/${project.id}/pages/${page.id}/queries/INSERT`)}><b>{stats.insert}</b><span>Insert</span></div>
        <div className="chipstat k-update" onClick={() => navigate(`/projects/${project.id}/pages/${page.id}/queries/UPDATE`)}><b>{stats.update}</b><span>Update</span></div>
        <div className="chipstat k-delete" onClick={() => navigate(`/projects/${project.id}/pages/${page.id}/queries/DELETE`)}><b>{stats.delete}</b><span>Delete</span></div>
        <div className="chipstat"><b>{Object.keys(tables).length}</b><span>Tables</span></div>
      </div>

      <div className="panel">
        <div className="panel-title">Export</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm" onClick={() => api.downloadFile(api.pagePdfUrl(page.id), `${page.name}-parity-review.pdf`).catch((e) => toast(e.message))}>Export PDF</button>
          <button className="btn btn-sm" onClick={() => api.downloadFile(api.pageExcelUrl(page.id), `${page.name}-parity-review.xlsx`).catch((e) => toast(e.message))}>Export Excel</button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Tables touched <span className="n">columns updated · S/I/U/D counts · max rows</span></div>
        <div className="table-wrap">
          <table className="mini">
            <thead><tr><th>Table</th><th>Columns updated</th><th>S / I / U / D</th><th>Max rows affected</th></tr></thead>
            <tbody>
              {Object.keys(tables).length === 0 ? (
                <tr><td colSpan={4} style={{ color: 'var(--text-faint)' }}>No tables logged yet.</td></tr>
              ) : Object.entries(tables).map(([t, d]) => (
                <tr key={t}>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--mig)' }}>{t}</td>
                  <td>{[...d.columns].length ? [...d.columns].map((c) => <span className="col-pill" key={c}>{c}</span>) : <span style={{ color: 'var(--text-faint)' }}>— read only —</span>}</td>
                  <td className="pt-num">{d.select} / {d.insert} / {d.update} / {d.delete}</td>
                  <td style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>{d.maxRows.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">APIs &amp; queries</div>
        {page.apis.length === 0 ? (
          <div className="empty-state" style={{ padding: 24 }}><b>No APIs logged</b>{isAdmin ? 'Edit this page to add API and query detail.' : ''}</div>
        ) : page.apis.map((a) => {
          const open = openApis.has(a.id);
          return (
            <div className="api-block" key={a.id}>
              <div className="api-head" onClick={() => setOpenApis((s) => { const n = new Set(s); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; })}>
                <svg className={`chev ${open ? 'open' : ''}`} width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <code>{a.name}</code>
                <span className="api-badge">{a.queries.length} {a.queries.length === 1 ? 'query' : 'queries'}</span>
              </div>
              <div className={`api-body ${open ? '' : 'collapsed'}`}>
                {a.queries.map((q) => (
                  <div className="qrow" key={q.id}>
                    <div className={`qtype ${q.type}`}>{q.type}</div>
                    <div className="qbody">
                      <div className="qsql-compare">
                        <div className="qsql-col">
                          <div className="qsql-label">VB original</div>
                          <div className="qsql">{q.vbSql || <span style={{ color: 'var(--text-faint)' }}>— not recorded —</span>}</div>
                        </div>
                        <div className="qsql-col">
                          <div className="qsql-label">Migrated</div>
                          <div className="qsql">{q.sql}</div>
                        </div>
                      </div>
                      <div className="qmeta">
                        {q.tables.length > 0 && <span><b>Tables:</b> {q.tables.join(', ')}</span>}
                        {q.columns.length > 0 && <span><b>Columns set:</b> {q.columns.join(', ')}</span>}
                        {q.maxRows && <span><b>Max rows:</b> {q.maxRows}</span>}
                        {q.whereConditions && <span><b>Where:</b> {q.whereConditions}</span>}
                      </div>
                      {q.notes && <div className="qnotes">{q.notes}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="panel">
        <div className="panel-title">Workflow</div>
        <div className="workflow-list">
          {page.workflow.length === 0 ? (
            <div className="compare-empty">No workflow steps logged yet.</div>
          ) : page.workflow.map((w, i) => (
            <div className="wf-step" key={i}><div className="wf-num" /><div className="wf-text">{w}</div></div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">VB original vs. migrated — side by side</div>
        <div className="compare-grid">
          <div className="compare-col vb">
            <div className="compare-head">VB.NET original</div>
            <div className="compare-body">
              <p>{page.comparison.vbNotes || <span className="compare-empty">No notes logged.</span>}</p>
              {(page.comparison.vbImages || []).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {page.comparison.vbImages.map((src, i) => (
                    <img key={i} className="compare-img" src={src} style={{ cursor: 'zoom-in', maxWidth: 160 }} onClick={() => setLightbox(src)} />
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="compare-col mig">
            <div className="compare-head">Migrated (React/Django)</div>
            <div className="compare-body">
              <p>{page.comparison.migNotes || <span className="compare-empty">No notes logged.</span>}</p>
              {(page.comparison.migImages || []).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {page.comparison.migImages.map((src, i) => (
                    <img key={i} className="compare-img" src={src} style={{ cursor: 'zoom-in', maxWidth: 160 }} onClick={() => setLightbox(src)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Review &amp; verdict</div>
        <ReviewPanel page={page} onUpdated={setPage} />
      </div>

      {isAdmin && (
        <div className="panel">
          <div className="panel-title">Approval</div>
          <ApprovalBox page={page} onUpdated={setPage} />
        </div>
      )}

      {isAdmin && (
        <div className="panel">
          <div className="panel-title">Assign to developer</div>
          <AssignBox page={page} onUpdated={setPage} />
        </div>
      )}
      {!isAdmin && page.assigned_to_name && (
        <div className="panel">
          <div className="panel-title">Assigned to</div>
          <div style={{ fontSize: 13 }}>{page.assigned_to_name}</div>
        </div>
      )}

      <div className="verdict-box-wrap panel">
        <div className="panel-title">Current verdict</div>
        <div className={`verdict-box ${page.status}`}>
          {page.verdict || 'No verdict written yet.'}
          <div className="verdict-meta">
            {page.reviews?.length ? `${page.reviews.length} review${page.reviews.length > 1 ? 's' : ''} · latest by ${page.reviewed_by_name}` : 'No reviews yet'}
            {page.reviewed_date ? ` · ${new Date(page.reviewed_date).toLocaleString()}` : ''}
            {page.approvals?.length ? ` · ${page.approvals.length} approval${page.approvals.length > 1 ? 's' : ''}` : ''}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Comments</div>
        <CommentsPanel page={page} onUpdated={setPage} />
      </div>

      {showEdit && (
        <PageFormModal
          projectId={project.id}
          existing={page}
          onClose={() => setShowEdit(false)}
          onSaved={() => { load(); refreshTree(); }}
        />
      )}
      <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}