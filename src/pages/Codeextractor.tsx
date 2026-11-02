import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  extractAll, type QueryDiff, type QueryType,
} from '../utils/Codeextractor'
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

const DRAFT_KEY = 'pl_pending_page_draft';
const MAX_CODE_LINES = 1200;

function clampLines(text: string): { value: string; truncated: boolean } {
  const lines = text.split('\n');
  if (lines.length <= MAX_CODE_LINES) return { value: text, truncated: false };
  return { value: lines.slice(0, MAX_CODE_LINES).join('\n'), truncated: true };
}

export default function CodeExtractor() {
  const [vbCode, setVbCode] = useState('');
  const [migratedCode, setMigratedCode] = useState('');
  const [pageName, setPageName] = useState('');
  const [apiName, setApiName] = useState('');
  const [workflow, setWorkflow] = useState<string[]>([]);
  const [djangoWorkflow, setDjangoWorkflow] = useState<string[]>([]);
  const [queries, setQueries] = useState<QueryDiff[]>([]);
  const [hasExtracted, setHasExtracted] = useState(false);
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    if (!isAdmin) {
      navigate('/', { replace: true });
    }
  }, [isAdmin, navigate]);

  function runExtract() {
    if (!vbCode.trim() && !migratedCode.trim()) {
      toast('Paste some code on at least one side first');
      return;
    }
    const result = extractAll(vbCode, migratedCode);
    setPageName(result.pageName);
    setApiName(result.apiName);
    setWorkflow(result.workflow.length ? result.workflow : ['']);
    setDjangoWorkflow(result.djangoWorkflow);
    setQueries(result.queryDiffs);
    setHasExtracted(true);
    toast(`Found ${result.queryDiffs.length} ${result.queryDiffs.length === 1 ? 'query' : 'queries'} — review before saving`);
  }

  function updateQuery(id: string, patch: Partial<QueryDiff>) {
    setQueries((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }
  function removeQuery(id: string) {
    setQueries((qs) => qs.filter((q) => q.id !== id));
  }

  function buildDraft() {
    return {
      name: pageName.trim(),
      path: '',
      folder_id: '',
      workflow: workflow.filter((w) => w.trim()),
      comparison: { vbNotes: '', migNotes: '', vbImages: [], migImages: [] },
      apis: [
        {
          name: apiName.trim() || 'TODO: endpoint name',
          queries: queries.map((q) => ({
            id: q.id,
            type: q.type,
            sql: q.migratedSql,
            vbSql: q.vbSql,
            tables: q.tables,
            columns: q.columns,
            whereConditions: q.whereConditions,
            maxRows: q.maxRows,
            notes: q.notes,
          })),
        },
      ],
    };
  }

  async function copyJson() {
    const json = JSON.stringify(buildDraft(), null, 2);
    try {
      await navigator.clipboard.writeText(json);
      toast('Copied to clipboard');
    } catch {
      toast('Could not copy — select and copy manually');
    }
  }

  function saveDraftForPageForm() {
    if (!pageName.trim()) { toast('Give the page a name first'); return; }
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(buildDraft()));
    toast('Draft saved — open a project and click "+ Page" to load it');
  }

  const matchedCount = queries.filter((q) => q.matched).length;
  const issueCount = queries.filter((q) => q.notes.includes('🔴')).length;
  if (!isAdmin) return null;

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

      <div className="view" style={{ maxWidth: 1300 }}>
        <div className="view-header">
          <div>
            <div className="view-eyebrow">Offline tool · nothing leaves your browser</div>
            <div className="view-title">Code extractor</div>
            <div className="view-sub">
              Paste the VB (.aspx + .aspx.vb) on the left and the migrated Django + React code on the right.
              Parsing is plain-text pattern matching in your browser — no network calls, no AI, nothing is sent anywhere.
            </div>
          </div>
        </div>

        <div className="row2">
          <div className="field">
            <label>VB / ASPX (old) <span className="hint">paste .aspx + .aspx.vb together</span></label>
            <textarea
              rows={16}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}
              value={vbCode}
              onChange={(e) => { const { value, truncated } = clampLines(e.target.value); if (truncated) toast(`Only parsing first ${MAX_CODE_LINES} lines`); setVbCode(value); }}
              placeholder="Public Class EL_Promote_Family_Student_Grade&#10;    Public Function PromoteStudents(...)&#10;        ..."
            />
            <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 4 }}>{vbCode.split('\n').length} / {MAX_CODE_LINES} lines</div>
          </div>
          <div className="field">
            <label>Django + React (migrated) <span className="hint">paste views.py / urls.py / component together</span></label>
            <textarea
              rows={16}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}
              value={migratedCode}
              onChange={(e) => { const { value, truncated } = clampLines(e.target.value); if (truncated) toast(`Only parsing first ${MAX_CODE_LINES} lines`); setMigratedCode(value); }}
              placeholder="def promote_students(request):&#10;    EL_LoginStudent.objects.filter(...).update(...)&#10;    ..."
            />
            <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 4 }}>{migratedCode.split('\n').length} / {MAX_CODE_LINES} lines</div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', margin: '18px 0' }}>
          <button className="btn btn-accent" onClick={runExtract}>Extract &amp; compare</button>
        </div>

        {hasExtracted && (
          <>
            <div className="stat-row">
              <div className="stat-card c-total"><div className="stat-num">{queries.length}</div><div className="stat-label">Queries found</div></div>
              <div className="stat-card c-verified"><div className="stat-num">{matchedCount}</div><div className="stat-label">Matched pairs</div></div>
              <div className="stat-card c-mismatch"><div className="stat-num">{issueCount}</div><div className="stat-label">Flagged issues</div></div>
              <div className="stat-card c-pending"><div className="stat-num">{workflow.length}</div><div className="stat-label">Workflow steps</div></div>
            </div>

            <div className="row2">
              <div className="field">
                <label>Page name</label>
                <input type="text" value={pageName} onChange={(e) => setPageName(e.target.value)} placeholder="EL_Promote_Family_Student_Grade" />
              </div>
              <div className="field">
                <label>API name / endpoint</label>
                <input type="text" value={apiName} onChange={(e) => setApiName(e.target.value)} placeholder="api/promote-students/" />
              </div>
            </div>

            <div className="section-label">Workflow (from VB, in order — edit freely)</div>
            {workflow.map((w, i) => (
              <div className="wf-editor-row" key={i}>
                <span className="n">{i + 1}.</span>
                <input
                  type="text"
                  style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', color: 'var(--text)', fontSize: 12.5 }}
                  value={w}
                  onChange={(e) => setWorkflow((wf) => wf.map((x, xi) => (xi === i ? e.target.value : x)))}
                />
                {workflow.length > 1 && (
                  <button type="button" className="icon-btn" onClick={() => setWorkflow((wf) => wf.filter((_, xi) => xi !== i))}>×</button>
                )}
              </div>
            ))}
            <button type="button" className="add-link" onClick={() => setWorkflow((wf) => [...wf, ''])}>+ Add step</button>

            {djangoWorkflow.length > 0 && (
              <div className="panel" style={{ marginTop: 16 }}>
                <div className="panel-title">Django workflow <span className="n">reference only — not saved, compare against the VB steps above</span></div>
                <div className="workflow-list">
                  {djangoWorkflow.map((w, i) => (
                    <div className="wf-step" key={i}><div className="wf-num" /><div className="wf-text">{w}</div></div>
                  ))}
                </div>
              </div>
            )}

            <div className="section-label" style={{ marginTop: 24 }}>Queries — VB vs. migrated, with auto-flagged differences</div>
            {queries.length === 0 ? (
              <div className="empty-state"><b>No SQL/ORM statements detected</b>Add queries manually in the page form, or check the pasted code has recognizable SQL / .objects. calls.</div>
            ) : queries.map((q, qi) => (
              <div className="query-editor" key={q.id} style={{ borderLeft: q.notes.includes('🔴') ? '3px solid var(--mismatch)' : q.matched ? '3px solid var(--verified)' : '3px solid var(--pending)' }}>
                <div className="qe-top">
                  <select value={q.type} onChange={(e) => updateQuery(q.id, { type: e.target.value as QueryType })}>
                    {(['SELECT', 'INSERT', 'UPDATE', 'DELETE'] as QueryType[]).map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <span style={{ flex: 1, fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>Query {qi + 1}{!q.matched && ' — unmatched'}</span>
                  <button type="button" className="icon-btn" onClick={() => removeQuery(q.id)}>×</button>
                </div>
                <div className="row2">
                  <div className="field" style={{ marginBottom: 8 }}>
                    <label>VB query</label>
                    <textarea rows={3} value={q.vbSql} onChange={(e) => updateQuery(q.id, { vbSql: e.target.value })} placeholder="(no VB equivalent found)" />
                  </div>
                  <div className="field" style={{ marginBottom: 8 }}>
                    <label>Migrated query</label>
                    <textarea rows={3} value={q.migratedSql} onChange={(e) => updateQuery(q.id, { migratedSql: e.target.value })} placeholder="(no migrated equivalent found)" />
                  </div>
                </div>
                <div className="row3">
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Tables <span className="hint">comma-sep</span></label>
                    <input type="text" value={q.tables.join(', ')} onChange={(e) => updateQuery(q.id, { tables: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Columns set <span className="hint">comma-sep</span></label>
                    <input type="text" value={q.columns.join(', ')} onChange={(e) => updateQuery(q.id, { columns: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Max rows</label>
                    <input type="text" value={q.maxRows} onChange={(e) => updateQuery(q.id, { maxRows: e.target.value })} />
                  </div>
                </div>
                <div className="field" style={{ marginTop: 8, marginBottom: 0 }}>
                  <label>Where conditions</label>
                  <input type="text" value={q.whereConditions} onChange={(e) => updateQuery(q.id, { whereConditions: e.target.value })} />
                </div>
                <div className="field" style={{ marginTop: 8, marginBottom: 0 }}>
                  <label>Notes / auto-detected differences <span className="hint">edit or clear as needed</span></label>
                  <textarea rows={2} value={q.notes} onChange={(e) => updateQuery(q.id, { notes: e.target.value })} style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }} />
                </div>
              </div>
            ))}

            <div className="panel" style={{ marginTop: 20 }}>
              <div className="panel-title">Next step</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn btn-accent" onClick={saveDraftForPageForm}>Save draft for "+ Page" form</button>
                <button className="btn" onClick={copyJson}>Copy as JSON</button>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 10 }}>
                "Save draft" stores this locally in your browser (not on any server). Open the project you want it in, click <b>+ Page</b>, and a banner will offer to load it — review and edit before saving for real.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}