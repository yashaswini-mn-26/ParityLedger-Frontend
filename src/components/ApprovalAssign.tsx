import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { PageDoc, UserSummary } from '../api/types';
import { useToast } from './Toast';

export function ApprovalBox({ page, onUpdated }: { page: PageDoc; onUpdated: (p: PageDoc) => void }) {
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function approve() {
    setSaving(true);
    try {
      const updated = await api.approvePage(page.id);
      onUpdated(updated);
      toast('Approval added');
    } catch (e: any) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  }

  const approvals = [...(page.approvals || [])].reverse();
  const hasOfficialReview = (page.reviews || []).some((r) => r.reviewed_by_role === 'admin' || r.reviewed_by_role === 'user');

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        {approvals.length === 0 ? (
          <div className="compare-empty">Not yet approved.</div>
        ) : (
          approvals.map((ap) => (
            <div key={ap.id} style={{ fontSize: 12.5, color: 'var(--text-dim)', padding: '4px 0' }}>
              Approved by <b style={{ color: 'var(--text)' }}>{ap.approved_by_name}</b> · {new Date(ap.approved_date).toLocaleString()}
            </div>
          ))
        )}
      </div>
      <button className="btn btn-accent" disabled={saving || !hasOfficialReview} onClick={approve}>
        {saving ? 'Approving…' : 'Add my approval'}
      </button>
      {!hasOfficialReview && (
        <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 8 }}>
          An admin or viewer review is required before this can be approved.
        </div>
      )}
    </div>
  );
}

export function AssignBox({ page, onUpdated }: { page: PageDoc; onUpdated: (p: PageDoc) => void }) {
  const [devs, setDevs] = useState<UserSummary[]>([]);
  const [value, setValue] = useState(page.assigned_to || '');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.listDevelopers().then(setDevs).catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    try {
      const updated = await api.assignPage(page.id, value || null);
      onUpdated(updated);
      toast(value ? 'Assigned to developer' : 'Unassigned');
    } catch (e: any) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="row2" style={{ alignItems: 'flex-end' }}>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>Developer</label>
        <select value={value} onChange={(e) => setValue(e.target.value)}>
          <option value="">— Unassigned —</option>
          {devs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <button className="btn" disabled={saving} onClick={save} style={{width:"80px", backgroundColor:"#0E7FA6",}}>{saving ? 'Saving…' : 'Assign'}</button>
    </div>
  );
}
