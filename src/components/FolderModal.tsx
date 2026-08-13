import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { FolderOption } from '../api/types';
import { useToast } from './Toast';

export function FolderModal({
  projectId, onClose, onCreated,
}: { projectId: string; onClose: () => void; onCreated: () => void }) {
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  useEffect(() => {
    api.listFoldersFlat(projectId).then(setFolders).catch(() => {});
  }, [projectId]);

  async function save() {
    if (!name.trim()) { setError('Give the folder a name'); return; }
    setSaving(true);
    setError('');
    try {
      await api.createFolder(projectId, { name: name.trim(), parent_id: parentId || null });
      toast('Folder created');
      onCreated();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal narrow">
        <div className="modal-head">
          <h2>New folder</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}
          <div className="field">
            <label>Parent folder</label>
            <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">— Root —</option>
              {folders.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Folder name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. STUDENT" />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-accent" disabled={saving} onClick={save}>
            {saving ? 'Creating…' : 'Create folder'}
          </button>
        </div>
      </div>
    </div>
  );
}
