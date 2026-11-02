
import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { FolderOption } from '../api/types';
import { useToast } from './Toast';

export function FolderModal({
  projectId,
  onClose,
  onCreated,
}: {
  projectId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [error, setError] = useState('');

  const toast = useToast();

  useEffect(() => {
    let active = true;

    async function loadFolders() {
      setLoadingFolders(true);

      try {
        const data = await api.listFoldersFlat(projectId);

        if (active) {
          setFolders(data);
        }
      } catch (e: any) {
        if (active) {
          setError(e.message || 'Could not load folders');
        }
      } finally {
        if (active) {
          setLoadingFolders(false);
        }
      }
    }

    loadFolders();

    return () => {
      active = false;
    };
  }, [projectId]);

  function close() {
    if (saving) return;
    onClose();
  }

  async function save() {
    if (saving) return;

    if (!name.trim()) {
      setError('Give the folder a name');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await api.createFolder(projectId, {
        name: name.trim(),
        parent_id: parentId || null,
      });

      toast('Folder created');
      onCreated();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Could not create folder');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal narrow">
        <div className="modal-head">
          <h2>New folder</h2>

          <button
            className="modal-close"
            onClick={close}
            disabled={saving}
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="form-error">{error}</div>
          )}

          <div className="field">
            <label>Parent folder</label>

            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              disabled={saving || loadingFolders}
            >
              <option value="">— Root —</option>

              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>

            {loadingFolders && (
              <small>Loading folders…</small>
            )}
          </div>

          <div className="field">
            <label>Folder name</label>

            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. STUDENT"
              disabled={saving}
              autoFocus
            />
          </div>
        </div>

        <div className="modal-foot">
          <button
            className="btn btn-ghost"
            onClick={close}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            className="btn btn-accent"
            disabled={saving || loadingFolders}
            onClick={save}
          >
            {saving ? 'Creating…' : 'Create folder'}
          </button>
        </div>
      </div>
    </div>
  );
}
