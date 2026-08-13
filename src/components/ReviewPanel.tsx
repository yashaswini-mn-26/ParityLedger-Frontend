import React, { useState } from 'react';
import { api } from '../api/client';
import type { PageDoc, PageStatus, Role } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';

const badgeClass: Record<PageStatus, string> = {
  verified: 'sel-verified',
  mismatch: 'sel-mismatch',
  pending: 'sel-pending',
};

const roleLabel: Record<Role, string> = {
  admin: 'Admin',
  user: 'Viewer',
  developer: 'Developer',
};

export function ReviewPanel({ page, onUpdated }: { page: PageDoc; onUpdated: (p: PageDoc) => void }) {
  const [status, setStatus] = useState<PageStatus>('pending');
  const [verdict, setVerdict] = useState('');
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const toast = useToast();

  const isDeveloper = user?.role === 'developer';

  async function submit() {
    if (!verdict.trim()) { toast('Write a verdict before submitting'); return; }
    setSaving(true);
    try {
      const updated = await api.reviewPage(page.id, { status, verdict });
      onUpdated(updated);
      setVerdict('');
      toast(isDeveloper ? 'Developer review added' : 'Review added');
    } catch (e: any) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  }

  const reviews = [...(page.reviews || [])].reverse();

  return (
    <div className="review-panel">
      <div className="status-picker">
        {(['verified', 'mismatch', 'pending'] as PageStatus[]).map((s) => (
          <div
            key={s}
            className={`status-opt sel-${s} ${status === s ? 'active' : ''}`}
            onClick={() => setStatus(s)}
          >
            {s}
          </div>
        ))}
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>
          {isDeveloper ? 'Your developer note' : 'Your verdict'}{' '}
          <span className="hint">{isDeveloper ? "won't overwrite the official verdict" : "what you'd tell your manager"}</span>
        </label>
        <textarea rows={3} value={verdict} onChange={(e) => setVerdict(e.target.value)} placeholder="Add your review — this doesn't overwrite other reviewers' verdicts" />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <button className="btn btn-accent" disabled={saving} onClick={submit}>
          {saving ? 'Saving…' : isDeveloper ? 'Submit developer review' : 'Submit review'}
        </button>
      </div>

      <div style={{ marginTop: 18 }}>
        <div className="section-label" style={{ marginBottom: 8 }}>
          Review history <span className="hint">{reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}</span>
        </div>
        {reviews.length === 0 ? (
          <div className="compare-empty">No reviews submitted yet.</div>
        ) : (
          reviews.map((r) => (
            <div key={r.id} className="review-entry" style={{ borderTop: '1px solid var(--border)', padding: '10px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <span className={`status-opt ${badgeClass[r.status]}`} style={{ padding: '2px 8px', fontSize: 10.5 }}>{r.status}</span>
                <b style={{ fontSize: 12.5 }}>{r.reviewed_by_name}</b>
                <span className="badge role" style={{ fontSize: 9.5 }}>{roleLabel[r.reviewed_by_role] || r.reviewed_by_role}</span>
                <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{new Date(r.reviewed_date).toLocaleString()}</span>
              </div>
              {r.verdict && <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{r.verdict}</div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}