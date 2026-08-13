import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { ApiBlock, FolderOption, PageDoc, QueryItem, QueryType } from '../api/types';
import { parseQueriesFromCode, collapseWs } from '../utils/sqlParser';
import { useToast } from './Toast';

const MAX_METHOD_LINES = 500;

function uid() { return Math.random().toString(36).slice(2, 9); }

function blankQuery(): QueryItem {
  return { id: uid(), type: 'SELECT', sql: '', vbSql: '', tables: [], columns: [], whereConditions: '', maxRows: '', notes: '' };
}
function blankApi(): ApiBlock {
  return { id: uid(), name: '', queries: [blankQuery()] };
}

interface Draft {
  name: string;
  path: string;
  folder_id: string;
  apis: ApiBlock[];
  workflow: string[];
  comparison: { vbNotes: string; migNotes: string; vbImage: string; migImage: string };
}

function toDraft(p?: PageDoc, defaultFolderId?: string): Draft {
  if (p) {
    return {
      name: p.name, path: p.path, folder_id: p.folder_id || '',
      apis: p.apis.length ? p.apis.map((a) => ({ ...a, queries: a.queries.map((q) => ({ ...q })) })) : [blankApi()],
      workflow: p.workflow.length ? [...p.workflow] : [''],
      comparison: { ...p.comparison },
    };
  }
  return {
    name: '', path: '', folder_id: defaultFolderId || '',
    apis: [blankApi()], workflow: [''],
    comparison: { vbNotes: '', migNotes: '', vbImage: '', migImage: '' },
  };
}

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > 4 * 1024 * 1024) { reject(new Error('Image too large — keep under 4MB')); return; }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.readAsDataURL(file);
  });
}

function clampLines(text: string): { value: string; truncated: boolean } {
  const lines = text.split('\n');
  if (lines.length <= MAX_METHOD_LINES) return { value: text, truncated: false };
  return { value: lines.slice(0, MAX_METHOD_LINES).join('\n'), truncated: true };
}

export function PageFormModal({
  projectId, existing, defaultFolderId, onClose, onSaved,
}: {
  projectId: string;
  existing?: PageDoc;
  defaultFolderId?: string;
  onClose: () => void;
  onSaved: (pageId: string) => void;
}) {
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [draft, setDraft] = useState<Draft>(() => toDraft(existing, defaultFolderId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Scratch pad only — never saved to the backend, purely for parsing queries out of pasted code.
  const [scratchCode, setScratchCode] = useState<Record<string, string>>({});
  const toast = useToast();

  useEffect(() => {
    api.listFoldersFlat(projectId).then(setFolders).catch(() => {});
  }, [projectId]);

  function updateApi(apiId: string, patch: Partial<ApiBlock>) {
    setDraft((d) => ({ ...d, apis: d.apis.map((a) => (a.id === apiId ? { ...a, ...patch } : a)) }));
  }
  function updateQuery(apiId: string, queryId: string, patch: Partial<QueryItem>) {
    setDraft((d) => ({
      ...d,
      apis: d.apis.map((a) => a.id !== apiId ? a : {
        ...a,
        queries: a.queries.map((q) => (q.id === queryId ? { ...q, ...patch } : q)),
      }),
    }));
  }

  function setScratch(apiId: string, code: string) {
    const { value, truncated } = clampLines(code);
    if (truncated) toast(`Only parsing first ${MAX_METHOD_LINES} lines`);
    setScratchCode((s) => ({ ...s, [apiId]: value }));
  }

  function parseApiCode(apiId: string) {
    const a = draft.apis.find((x) => x.id === apiId);
    const code = scratchCode[apiId] || '';
    if (!a || !code.trim()) { toast('Paste method code first'); return; }
    const parsed = parseQueriesFromCode(code);
    if (parsed.length === 0) { toast('No SQL statements detected — add queries manually if needed'); return; }

    const existingSql = new Set(a.queries.filter((q) => q.sql.trim()).map((q) => collapseWs(q.sql).toUpperCase()));
    const newItems: QueryItem[] = parsed
      .filter((p) => !existingSql.has(p.sql.toUpperCase()))
      .map((p) => ({
        id: uid(), type: p.type, sql: p.sql, vbSql: '',
        tables: p.tables, columns: p.columns, whereConditions: p.whereConditions,
        maxRows: p.maxRows, notes: '',
      }));

    if (newItems.length === 0) { toast('All detected queries are already listed'); return; }

    updateApi(apiId, { queries: [...a.queries.filter((q) => q.sql.trim()), ...newItems] });
    toast(`Detected ${newItems.length} ${newItems.length === 1 ? 'query' : 'queries'} — review and edit below`);
  }

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>, field: 'vbImage' | 'migImage') {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readImage(file);
      setDraft((d) => ({ ...d, comparison: { ...d.comparison, [field]: dataUrl } }));
    } catch (err: any) {
      toast(err.message);
    }
  }

  async function save() {
    if (!draft.name.trim()) { setError('Page name is required'); return; }
    setSaving(true);
    setError('');
    const payload = {
      name: draft.name.trim(),
      path: draft.path.trim(),
      folder_id: draft.folder_id || null,
      workflow: draft.workflow.filter((w) => w.trim()),
      comparison: draft.comparison,
      apis: draft.apis
        .filter((a) => a.name.trim())
        .map((a) => ({ ...a, queries: a.queries.filter((q) => q.sql.trim()) })),
    };
    try {
      const saved = existing
        ? await api.updatePage(existing.id, payload)
        : await api.createPage(projectId, payload);
      toast(existing ? 'Page review updated' : 'Page review saved');
      onSaved(saved.id);
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 840 }}>
        <div className="modal-head">
          <h2>{existing ? 'Edit page review' : 'New page review'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}

          <div className="row2">
            <div className="field">
              <label>Page name</label>
              <input type="text" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="EL_Promote_Family_Student_Grade" />
            </div>
            <div className="field">
              <label>Folder</label>
              <select value={draft.folder_id} onChange={(e) => setDraft((d) => ({ ...d, folder_id: e.target.value }))}>
                <option value="">— Root —</option>
                {folders.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>
          </div>

          <div className="field">
            <label>Page path</label>
            <input type="text" value={draft.path} onChange={(e) => setDraft((d) => ({ ...d, path: e.target.value }))} placeholder="SUPPORT\EL_Promote_Family_Student_Grade.tsx" />
          </div>

          <div className="section-label" style={{ marginTop: 20 }}>APIs &amp; queries</div>
          {draft.apis.map((a, ai) => (
            <div className="api-editor" key={a.id}>
              <div className="api-editor-head">
                <b>API {ai + 1}</b>
                {draft.apis.length > 1 && (
                  <button type="button" className="icon-btn" onClick={() => setDraft((d) => ({ ...d, apis: d.apis.filter((x) => x.id !== a.id) }))}>×</button>
                )}
              </div>
              <div className="field">
                <label>Endpoint</label>
                <input type="text" value={a.name} onChange={(e) => updateApi(a.id, { name: e.target.value })} placeholder="api/promote-students/" />
              </div>

              <div className="field">
                <label>Paste backend method code <span className="hint">not saved — used only to auto-fill queries below</span></label>
                <textarea
                  rows={8}
                  value={scratchCode[a.id] || ''}
                  onChange={(e) => setScratch(a.id, e.target.value)}
                  placeholder="Paste the Django view / VB method here…"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                  <span style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>
                    {(scratchCode[a.id] || '').split('\n').filter(Boolean).length ? (scratchCode[a.id] || '').split('\n').length : 0} / {MAX_METHOD_LINES} lines
                  </span>
                  <button type="button" className="add-link" onClick={() => parseApiCode(a.id)}>Parse queries from code</button>
                </div>
              </div>

              {a.queries.map((q, qi) => (
                <div className="query-editor" key={q.id}>
                  <div className="qe-top">
                    <select value={q.type} onChange={(e) => updateQuery(a.id, q.id, { type: e.target.value as QueryType })}>
                      {(['SELECT', 'INSERT', 'UPDATE', 'DELETE'] as QueryType[]).map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <span style={{ flex: 1, fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>Query {qi + 1}</span>
                    {a.queries.length > 1 && (
                      <button type="button" className="icon-btn" onClick={() => updateApi(a.id, { queries: a.queries.filter((x) => x.id !== q.id) })}>×</button>
                    )}
                  </div>
                  <div className="field" style={{ marginBottom: 8 }}>
                    <label>Migrated SQL / ORM statement</label>
                    <textarea rows={3} value={q.sql} onChange={(e) => updateQuery(a.id, q.id, { sql: e.target.value })} placeholder="SQL / ORM statement (Django)" />
                  </div>
                  <div className="field" style={{ marginBottom: 8 }}>
                    <label>Equivalent VB query <span className="hint">original</span></label>
                    <textarea rows={3} value={q.vbSql} onChange={(e) => updateQuery(a.id, q.id, { vbSql: e.target.value })} placeholder="Original VB.NET SQL / stored proc call" />
                  </div>
                  <div className="row3">
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Tables <span className="hint">comma-sep</span></label>
                      <input type="text" value={q.tables.join(', ')} onChange={(e) => updateQuery(a.id, q.id, { tables: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Columns set <span className="hint">comma-sep</span></label>
                      <input type="text" value={q.columns.join(', ')} onChange={(e) => updateQuery(a.id, q.id, { columns: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Max rows</label>
                      <input type="text" value={q.maxRows} onChange={(e) => updateQuery(a.id, q.id, { maxRows: e.target.value })} placeholder="e.g. 1, or 'full roster'" />
                    </div>
                  </div>
                  <div className="field" style={{ marginTop: 8, marginBottom: 0 }}>
                    <label>Where conditions</label>
                    <input type="text" value={q.whereConditions} onChange={(e) => updateQuery(a.id, q.id, { whereConditions: e.target.value })} placeholder="SchoolCode = ?, FamilyCode = ?, Login = ?" />
                  </div>
                  <div className="field" style={{ marginTop: 8, marginBottom: 0 }}>
                    <label>Notes</label>
                    <input type="text" value={q.notes} onChange={(e) => updateQuery(a.id, q.id, { notes: e.target.value })} />
                  </div>
                </div>
              ))}
              <button type="button" className="add-link" onClick={() => updateApi(a.id, { queries: [...a.queries, blankQuery()] })}>+ Add query</button>
            </div>
          ))}
          <button type="button" className="add-link" onClick={() => setDraft((d) => ({ ...d, apis: [...d.apis, blankApi()] }))}>+ Add API</button>

          <div className="section-label" style={{ marginTop: 20 }}>Workflow steps</div>
          {draft.workflow.map((w, i) => (
            <div className="wf-editor-row" key={i}>
              <span className="n">{i + 1}.</span>
              <input
                type="text"
                style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', color: 'var(--text)', fontSize: 12.5 }}
                value={w}
                onChange={(e) => setDraft((d) => ({ ...d, workflow: d.workflow.map((x, xi) => (xi === i ? e.target.value : x)) }))}
              />
              {draft.workflow.length > 1 && (
                <button type="button" className="icon-btn" onClick={() => setDraft((d) => ({ ...d, workflow: d.workflow.filter((_, xi) => xi !== i) }))}>×</button>
              )}
            </div>
          ))}
          <button type="button" className="add-link" onClick={() => setDraft((d) => ({ ...d, workflow: [...d.workflow, ''] }))}>+ Add step</button>

          <div className="section-label" style={{ marginTop: 20 }}>VB vs. migrated comparison</div>
          <div className="row2">
            <div className="field">
              <label>VB.NET notes / observations</label>
              <textarea rows={3} value={draft.comparison.vbNotes} onChange={(e) => setDraft((d) => ({ ...d, comparison: { ...d.comparison, vbNotes: e.target.value } }))} />
              <label className="file-drop" style={{ display: 'block', marginTop: 8 }}>
                Click to attach VB screenshot
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleImage(e, 'vbImage')} />
              </label>
              {draft.comparison.vbImage && <img className="thumb-preview" src={draft.comparison.vbImage} />}
            </div>
            <div className="field">
              <label>Migrated notes / observations</label>
              <textarea rows={3} value={draft.comparison.migNotes} onChange={(e) => setDraft((d) => ({ ...d, comparison: { ...d.comparison, migNotes: e.target.value } }))} />
              <label className="file-drop" style={{ display: 'block', marginTop: 8 }}>
                Click to attach migrated screenshot
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleImage(e, 'migImage')} />
              </label>
              {draft.comparison.migImage && <img className="thumb-preview" src={draft.comparison.migImage} />}
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-accent" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save page review'}
          </button>
        </div>
      </div>
    </div>
  );
}