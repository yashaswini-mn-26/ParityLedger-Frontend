import React, { useState } from 'react';
import { api } from '../api/client';
import { useToast } from './Toast';
import { useNavigate } from 'react-router-dom';

export function ProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();
  const navigate = useNavigate();

  async function save() {
    if (!name.trim()) { setError('Project name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const project = await api.createProject({ name: name.trim(), description: description.trim() });
      toast('Project created');
      onCreated();
      onClose();
      navigate(`/projects/${project.id}`);
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
          <h2>New project</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}
          <div className="field">
            <label>Project name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kinetic Education Portal" />
          </div>
          <div className="field">
            <label>Description <span className="hint">optional</span></label>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is being migrated, and from what stack" />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-accent" disabled={saving} onClick={save}>
            {saving ? 'Creating…' : 'Create project'}
          </button>
        </div>
      </div>
    </div>
  );
}
