
import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type {
  ApiBlock,
  FolderOption,
  PageDoc,
  QueryItem,
  QueryType,
} from '../api/types';
import { parseQueriesFromCode, collapseWs } from '../utils/sqlParser';
import { useToast } from './Toast';
import { ImageLightbox } from './ImageLightbox';

const MAX_METHOD_LINES = 500;
const MAX_IMAGES = 6;
const DRAFT_KEY = 'pl_pending_page_draft';

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function blankQuery(): QueryItem {
  return {
    id: uid(),
    type: 'SELECT',
    sql: '',
    vbSql: '',
    tables: [],
    columns: [],
    whereConditions: '',
    maxRows: '',
    notes: '',
  };
}

function blankApi(): ApiBlock {
  return {
    id: uid(),
    name: '',
    queries: [blankQuery()],
  };
}

interface Draft {
  name: string;
  path: string;
  folder_id: string;
  apis: ApiBlock[];
  workflow: string[];
  comparison: {
    vbNotes: string;
    migNotes: string;
    vbImages: string[];
    migImages: string[];
  };
}

function toDraft(p?: PageDoc, defaultFolderId?: string): Draft {
  if (p) {
    return {
      name: p.name,
      path: p.path,
      folder_id: p.folder_id || '',
      apis: p.apis.length
        ? p.apis.map((a) => ({
            ...a,
            queries: a.queries.map((q) => ({ ...q })),
          }))
        : [blankApi()],
      workflow: p.workflow.length ? [...p.workflow] : [''],
      comparison: {
        vbNotes: p.comparison.vbNotes || '',
        migNotes: p.comparison.migNotes || '',
        vbImages: [],
        migImages: [],
      },
    };
  }

  return {
    name: '',
    path: '',
    folder_id: defaultFolderId || '',
    apis: [blankApi()],
    workflow: [''],
    comparison: {
      vbNotes: '',
      migNotes: '',
      vbImages: [],
      migImages: [],
    },
  };
}

/** Shape written by the Code Extractor tool. */
interface ExtractorDraft {
  name: string;
  path: string;
  folder_id: string;
  workflow: string[];
  comparison: {
    vbNotes: string;
    migNotes: string;
    vbImages: string[];
    migImages: string[];
  };
  apis: {
    name: string;
    queries: Partial<QueryItem>[];
  }[];
}

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > 4 * 1024 * 1024) {
      reject(new Error('Image too large — keep under 4MB'));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read image'));

    reader.readAsDataURL(file);
  });
}

function clampLines(text: string): {
  value: string;
  truncated: boolean;
} {
  const lines = text.split('\n');

  if (lines.length <= MAX_METHOD_LINES) {
    return { value: text, truncated: false };
  }

  return {
    value: lines.slice(0, MAX_METHOD_LINES).join('\n'),
    truncated: true,
  };
}

export function PageFormModal({
  projectId,
  existing,
  defaultFolderId,
  onClose,
  onSaved,
}: {
  projectId: string;
  existing?: PageDoc;
  defaultFolderId?: string;
  onClose: () => void;
  onSaved: (pageId: string) => void;
}) {
  const { isAdmin } = useAuth();
  const toast = useToast();

  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [draft, setDraft] = useState<Draft>(() =>
    toDraft(existing, defaultFolderId)
  );

  const [saving, setSaving] = useState(false);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [error, setError] = useState('');
  const [scratchCode, setScratchCode] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [pendingExtractorDraft, setPendingExtractorDraft] =
    useState<ExtractorDraft | null>(null);
  const [loadingImages, setLoadingImages] = useState(false);

  // Load folders belonging to this project.
  useEffect(() => {
    let cancelled = false;

    async function loadFolders() {
      setLoadingFolders(true);

      try {
        const data = await api.listFoldersFlat(projectId);

        if (!cancelled) {
          setFolders(data);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || 'Could not load folders');
        }
      } finally {
        if (!cancelled) {
          setLoadingFolders(false);
        }
      }
    }

    loadFolders();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Existing pages only carry image counts in the light fetch.
  // Fetch actual screenshot bytes before allowing an edit to be saved.
  useEffect(() => {
    if (!existing) return;

    let cancelled = false;

    setLoadingImages(true);

    api.getComparisonImages(existing.id)
      .then((imgs) => {
        if (cancelled) return;

        setDraft((d) => ({
          ...d,
          comparison: {
            ...d.comparison,
            vbImages: imgs.vbImages,
            migImages: imgs.migImages,
          },
        }));
      })
      .catch((e: any) => {
        if (!cancelled) {
          toast(e.message || 'Could not load existing screenshots');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingImages(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [existing?.id]);

  // Pending Code Extractor drafts are available only to admins.
  // Demo users can still manually paste code and parse SQL below.
  useEffect(() => {
    if (existing || !isAdmin) return;

    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);

      if (raw) {
        setPendingExtractorDraft(JSON.parse(raw));
      }
    } catch {
      // Ignore malformed or outdated drafts.
    }
  }, [existing, isAdmin]);

  function close() {
    if (saving) return;
    onClose();
  }

  function loadExtractorDraft() {
    if (!isAdmin || !pendingExtractorDraft || saving) return;

    const d = pendingExtractorDraft;

    setDraft((prev) => ({
      ...prev,
      name: d.name || prev.name,
      path: d.path || prev.path,
      workflow: d.workflow?.length ? d.workflow : prev.workflow,
      comparison: {
        vbNotes: d.comparison?.vbNotes || prev.comparison.vbNotes,
        migNotes: d.comparison?.migNotes || prev.comparison.migNotes,
        vbImages: d.comparison?.vbImages?.length
          ? d.comparison.vbImages
          : prev.comparison.vbImages,
        migImages: d.comparison?.migImages?.length
          ? d.comparison.migImages
          : prev.comparison.migImages,
      },
      apis: d.apis?.length
        ? d.apis.map((a) => ({
            id: uid(),
            name: a.name,
            queries: a.queries?.length
              ? a.queries.map((q) => ({
                  id: uid(),
                  type: (q.type as QueryType) || 'SELECT',
                  sql: q.sql || '',
                  vbSql: q.vbSql || '',
                  tables: q.tables || [],
                  columns: q.columns || [],
                  whereConditions: q.whereConditions || '',
                  maxRows: q.maxRows || '',
                  notes: q.notes || '',
                }))
              : [blankQuery()],
          }))
        : prev.apis,
    }));

    sessionStorage.removeItem(DRAFT_KEY);
    setPendingExtractorDraft(null);

    toast('Draft loaded — review every field before saving');
  }

  function dismissExtractorDraft() {
    if (!isAdmin || saving) return;

    sessionStorage.removeItem(DRAFT_KEY);
    setPendingExtractorDraft(null);
  }

  function updateApi(apiId: string, patch: Partial<ApiBlock>) {
    setDraft((d) => ({
      ...d,
      apis: d.apis.map((a) =>
        a.id === apiId ? { ...a, ...patch } : a
      ),
    }));
  }

  function updateQuery(
    apiId: string,
    queryId: string,
    patch: Partial<QueryItem>
  ) {
    setDraft((d) => ({
      ...d,
      apis: d.apis.map((a) =>
        a.id !== apiId
          ? a
          : {
              ...a,
              queries: a.queries.map((q) =>
                q.id === queryId ? { ...q, ...patch } : q
              ),
            }
      ),
    }));
  }

  function setScratch(apiId: string, code: string) {
    const { value, truncated } = clampLines(code);

    if (truncated) {
      toast(`Only parsing first ${MAX_METHOD_LINES} lines`);
    }

    setScratchCode((s) => ({
      ...s,
      [apiId]: value,
    }));
  }

  function parseApiCode(apiId: string) {
    const a = draft.apis.find((x) => x.id === apiId);
    const code = scratchCode[apiId] || '';

    if (!a || !code.trim()) {
      toast('Paste method code first');
      return;
    }

    const parsed = parseQueriesFromCode(code);

    if (parsed.length === 0) {
      toast('No SQL statements detected — add queries manually if needed');
      return;
    }

    const existingSql = new Set(
      a.queries
        .filter((q) => q.sql.trim())
        .map((q) => collapseWs(q.sql).toUpperCase())
    );

    const newItems: QueryItem[] = parsed
      .filter((p) => !existingSql.has(p.sql.toUpperCase()))
      .map((p) => ({
        id: uid(),
        type: p.type,
        sql: p.sql,
        vbSql: '',
        tables: p.tables,
        columns: p.columns,
        whereConditions: p.whereConditions,
        maxRows: p.maxRows,
        notes: '',
      }));

    if (newItems.length === 0) {
      toast('All detected queries are already listed');
      return;
    }

    updateApi(apiId, {
      queries: [
        ...a.queries.filter((q) => q.sql.trim()),
        ...newItems,
      ],
    });

    toast(
      `Detected ${newItems.length} ${
        newItems.length === 1 ? 'query' : 'queries'
      } — review and edit below`
    );
  }

  async function handleImages(
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'vbImages' | 'migImages'
  ) {
    const files = Array.from(e.target.files || []);

    if (files.length === 0) return;

    const current = draft.comparison[field];
    const room = MAX_IMAGES - current.length;

    if (room <= 0) {
      toast(`Maximum ${MAX_IMAGES} images allowed`);
      e.target.value = '';
      return;
    }

    const toRead = files.slice(0, room);

    if (files.length > room) {
      toast(`Only added ${room} — max ${MAX_IMAGES} images per side`);
    }

    try {
      const dataUrls = await Promise.all(toRead.map(readImage));

      setDraft((d) => ({
        ...d,
        comparison: {
          ...d.comparison,
          [field]: [
            ...d.comparison[field],
            ...dataUrls,
          ].slice(0, MAX_IMAGES),
        },
      }));
    } catch (err: any) {
      toast(err.message || 'Could not read image');
    }

    e.target.value = '';
  }

  function removeImage(
    field: 'vbImages' | 'migImages',
    index: number
  ) {
    setDraft((d) => ({
      ...d,
      comparison: {
        ...d.comparison,
        [field]: d.comparison[field].filter(
          (_, i) => i !== index
        ),
      },
    }));
  }

  async function save() {
    if (saving) return;

    if (!draft.name.trim()) {
      setError('Page name is required');
      return;
    }

    if (loadingFolders) {
      toast('Please wait while folders are loading');
      return;
    }

    if (existing && loadingImages) {
      toast('Still loading existing screenshots — wait a moment before saving');
      return;
    }

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
        .map((a) => ({
          ...a,
          queries: a.queries.filter((q) => q.sql.trim()),
        })),
    };

    try {
      const saved = existing
        ? await api.updatePage(existing.id, payload)
        : await api.createPage(projectId, payload);

      toast(existing ? 'Page review updated' : 'Page review saved');

      onSaved(saved.id);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Could not save page');
    } finally {
      setSaving(false);
    }
  }

  function renderImageGrid(
    field: 'vbImages' | 'migImages'
  ) {
    const images = draft.comparison[field];

    return (
      <>
        <label className="file-drop" style={{ display: 'block', marginTop: 8 }}>
          {images.length >= MAX_IMAGES
            ? `Max ${MAX_IMAGES} images reached`
            : `Attach screenshots (${images.length}/${MAX_IMAGES})`}

          <input
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            disabled={saving || images.length >= MAX_IMAGES}
            onChange={(e) => handleImages(e, field)}
          />
        </label>

        {existing && loadingImages && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-faint)',
              marginTop: 6,
            }}
          >
            Loading existing screenshots…
          </div>
        )}

        {images.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 8,
            }}
          >
            {images.map((src, i) => (
              <div className="thumb-wrap" key={i}>
                <img className="thumb-preview" src={src} alt={`Comparison screenshot ${i + 1}`} />

                <div className="thumb-overlay">
                  <button
                    type="button"
                    className="thumb-btn"
                    title="View fullscreen"
                    onClick={() => setLightbox(src)}
                    disabled={saving}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>

                  <button
                    type="button"
                    className="thumb-btn thumb-btn-danger"
                    title="Remove image"
                    onClick={() => removeImage(field, i)}
                    disabled={saving}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M18 6L6 18M6 6l12 12"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    );
  }

  const disabled = saving;

  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal" style={{ maxWidth: 840 }}>
        <div className="modal-head">
          <h2>{existing ? 'Edit page review' : 'New page review'}</h2>

          <button
            className="modal-close"
            onClick={close}
            disabled={disabled}
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}

          {isAdmin && pendingExtractorDraft && (
            <div
              className="panel"
              style={{
                background: 'var(--mig-dim)',
                borderColor: 'var(--mig)',
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <b style={{ color: 'var(--mig)' }}>
                    Draft found from Code Extractor
                  </b>

                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-dim)',
                      marginTop: 2,
                    }}
                  >
                    "{pendingExtractorDraft.name || 'Untitled'}" —{' '}
                    {pendingExtractorDraft.apis?.[0]?.queries?.length || 0}{' '}
                    queries, {pendingExtractorDraft.workflow?.length || 0}{' '}
                    workflow steps.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={dismissExtractorDraft}
                    disabled={disabled}
                  >
                    Dismiss
                  </button>

                  <button
                    type="button"
                    className="btn btn-accent btn-sm"
                    onClick={loadExtractorDraft}
                    disabled={disabled}
                  >
                    Load draft
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="row2">
            <div className="field">
              <label>Page name</label>

              <input
                type="text"
                value={draft.name}
                disabled={disabled}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, name: e.target.value }))
                }
                placeholder="EL_Promote_Family_Student_Grade"
              />
            </div>

            <div className="field">
              <label>Folder</label>

              <select
                value={draft.folder_id}
                disabled={disabled || loadingFolders}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    folder_id: e.target.value,
                  }))
                }
              >
                <option value="">— Root —</option>

                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>

              {loadingFolders && <small>Loading folders…</small>}
            </div>
          </div>

          <div className="field">
            <label>Page path</label>

            <input
              type="text"
              value={draft.path}
              disabled={disabled}
              onChange={(e) =>
                setDraft((d) => ({ ...d, path: e.target.value }))
              }
              placeholder="SUPPORT\EL_Promote_Family_Student_Grade.tsx"
            />
          </div>

          <div className="section-label" style={{ marginTop: 20 }}>
            APIs &amp; queries
          </div>

          {draft.apis.map((a, ai) => (
            <div className="api-editor" key={a.id}>
              <div className="api-editor-head">
                <b>API {ai + 1}</b>

                {draft.apis.length > 1 && (
                  <button
                    type="button"
                    className="icon-btn"
                    disabled={disabled}
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        apis: d.apis.filter((x) => x.id !== a.id),
                      }))
                    }
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="field">
                <label>Endpoint</label>

                <input
                  type="text"
                  value={a.name}
                  disabled={disabled}
                  onChange={(e) =>
                    updateApi(a.id, { name: e.target.value })
                  }
                  placeholder="api/promote-students/"
                />
              </div>

              <div className="field">
                <label>
                  Paste backend method code{' '}
                  <span className="hint">
                    not saved — used only to auto-fill queries below
                  </span>
                </label>

                <textarea
                  rows={8}
                  value={scratchCode[a.id] || ''}
                  disabled={disabled}
                  onChange={(e) => setScratch(a.id, e.target.value)}
                  placeholder="Paste the Django view / VB method here…"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11.5,
                  }}
                />

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10.5,
                      color: 'var(--text-faint)',
                    }}
                  >
                    {(scratchCode[a.id] || '').split('\n').filter(Boolean).length
                      ? (scratchCode[a.id] || '').split('\n').length
                      : 0}{' '}
                    / {MAX_METHOD_LINES} lines
                  </span>

                  <button
                    type="button"
                    className="add-link"
                    disabled={disabled}
                    onClick={() => parseApiCode(a.id)}
                  >
                    Parse queries from code
                  </button>
                </div>
              </div>

              {a.queries.map((q, qi) => (
                <div className="query-editor" key={q.id}>
                  <div className="qe-top">
                    <select
                      value={q.type}
                      disabled={disabled}
                      onChange={(e) =>
                        updateQuery(a.id, q.id, {
                          type: e.target.value as QueryType,
                        })
                      }
                    >
                      {(['SELECT', 'INSERT', 'UPDATE', 'DELETE'] as QueryType[]).map(
                        (t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        )
                      )}
                    </select>

                    <span
                      style={{
                        flex: 1,
                        fontSize: 11,
                        color: 'var(--text-faint)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      Query {qi + 1}
                    </span>

                    {a.queries.length > 1 && (
                      <button
                        type="button"
                        className="icon-btn"
                        disabled={disabled}
                        onClick={() =>
                          updateApi(a.id, {
                            queries: a.queries.filter(
                              (x) => x.id !== q.id
                            ),
                          })
                        }
                      >
                        ×
                      </button>
                    )}
                  </div>

                  <div className="field" style={{ marginBottom: 8 }}>
                    <label>Migrated SQL / ORM statement</label>

                    <textarea
                      rows={3}
                      value={q.sql}
                      disabled={disabled}
                      onChange={(e) =>
                        updateQuery(a.id, q.id, { sql: e.target.value })
                      }
                      placeholder="SQL / ORM statement (Django)"
                    />
                  </div>

                  <div className="field" style={{ marginBottom: 8 }}>
                    <label>
                      Equivalent VB query <span className="hint">original</span>
                    </label>

                    <textarea
                      rows={3}
                      value={q.vbSql}
                      disabled={disabled}
                      onChange={(e) =>
                        updateQuery(a.id, q.id, { vbSql: e.target.value })
                      }
                      placeholder="Original VB.NET SQL / stored proc call"
                    />
                  </div>

                  <div className="row3">
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>
                        Tables <span className="hint">comma-sep</span>
                      </label>

                      <input
                        type="text"
                        value={q.tables.join(', ')}
                        disabled={disabled}
                        onChange={(e) =>
                          updateQuery(a.id, q.id, {
                            tables: e.target.value
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </div>

                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>
                        Columns set <span className="hint">comma-sep</span>
                      </label>

                      <input
                        type="text"
                        value={q.columns.join(', ')}
                        disabled={disabled}
                        onChange={(e) =>
                          updateQuery(a.id, q.id, {
                            columns: e.target.value
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </div>

                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Max rows</label>

                      <input
                        type="text"
                        value={q.maxRows}
                        disabled={disabled}
                        onChange={(e) =>
                          updateQuery(a.id, q.id, {
                            maxRows: e.target.value,
                          })
                        }
                        placeholder="e.g. 1, or 'full roster'"
                      />
                    </div>
                  </div>

                  <div
                    className="field"
                    style={{ marginTop: 8, marginBottom: 0 }}
                  >
                    <label>Where conditions</label>

                    <input
                      type="text"
                      value={q.whereConditions}
                      disabled={disabled}
                      onChange={(e) =>
                        updateQuery(a.id, q.id, {
                          whereConditions: e.target.value,
                        })
                      }
                      placeholder="SchoolCode = ?, FamilyCode = ?, Login = ?"
                    />
                  </div>

                  <div
                    className="field"
                    style={{ marginTop: 8, marginBottom: 0 }}
                  >
                    <label>Notes</label>

                    <input
                      type="text"
                      value={q.notes}
                      disabled={disabled}
                      onChange={(e) =>
                        updateQuery(a.id, q.id, {
                          notes: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              ))}

              <button
                type="button"
                className="add-link"
                disabled={disabled}
                onClick={() =>
                  updateApi(a.id, {
                    queries: [...a.queries, blankQuery()],
                  })
                }
              >
                + Add query
              </button>
            </div>
          ))}

          <button
            type="button"
            className="add-link"
            disabled={disabled}
            onClick={() =>
              setDraft((d) => ({
                ...d,
                apis: [...d.apis, blankApi()],
              }))
            }
          >
            + Add API
          </button>

          <div className="section-label" style={{ marginTop: 20 }}>
            Workflow steps
          </div>

          {draft.workflow.map((w, i) => (
            <div className="wf-editor-row" key={i}>
              <span className="n">{i + 1}.</span>

              <input
                type="text"
                disabled={disabled}
                style={{
                  flex: 1,
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 7,
                  padding: '8px 10px',
                  color: 'var(--text)',
                  fontSize: 12.5,
                }}
                value={w}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    workflow: d.workflow.map((x, xi) =>
                      xi === i ? e.target.value : x
                    ),
                  }))
                }
              />

              {draft.workflow.length > 1 && (
                <button
                  type="button"
                  className="icon-btn"
                  disabled={disabled}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      workflow: d.workflow.filter(
                        (_, xi) => xi !== i
                      ),
                    }))
                  }
                >
                  ×
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            className="add-link"
            disabled={disabled}
            onClick={() =>
              setDraft((d) => ({
                ...d,
                workflow: [...d.workflow, ''],
              }))
            }
          >
            + Add step
          </button>

          <div className="section-label" style={{ marginTop: 20 }}>
            VB vs. migrated comparison
          </div>

          <div className="row2">
            <div className="field">
              <label>VB.NET notes / observations</label>

              <textarea
                rows={3}
                value={draft.comparison.vbNotes}
                disabled={disabled}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    comparison: {
                      ...d.comparison,
                      vbNotes: e.target.value,
                    },
                  }))
                }
              />

              {renderImageGrid('vbImages')}
            </div>

            <div className="field">
              <label>Migrated notes / observations</label>

              <textarea
                rows={3}
                value={draft.comparison.migNotes}
                disabled={disabled}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    comparison: {
                      ...d.comparison,
                      migNotes: e.target.value,
                    },
                  }))
                }
              />

              {renderImageGrid('migImages')}
            </div>
          </div>
        </div>

        <ImageLightbox
          src={lightbox}
          onClose={() => setLightbox(null)}
        />

        <div className="modal-foot">
          <button
            className="btn btn-ghost"
            onClick={close}
            disabled={disabled}
          >
            Cancel
          </button>

          <button
            className="btn btn-accent"
            disabled={saving || loadingFolders || (existing !== undefined && loadingImages)}
            onClick={save}
          >
            {saving ? 'Saving…' : 'Save page review'}
          </button>
        </div>
      </div>
    </div>
  );
}
