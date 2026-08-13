import React from 'react';
import type { PageStatus } from '../api/types';

const LABELS: Record<PageStatus, string> = {
  verified: 'Verified',
  mismatch: 'Mismatch',
  pending: 'Pending',
};

export function StatusBadge({ status }: { status: PageStatus }) {
  return (
    <span className={`badge ${status}`}>
      <span className="dot" />
      {LABELS[status]}
    </span>
  );
}

export function StatusSeal({ status }: { status: PageStatus }) {
  const icon = status === 'verified' ? '✓' : status === 'mismatch' ? '✕' : '…';
  const label = status === 'verified' ? 'Parity confirmed' : status === 'mismatch' ? 'Mismatch found' : 'Pending review';
  return (
    <div className={`seal ${status}`}>
      <div className="seal-shape">
        <div className="seal-icon">{icon}</div>
        <div className="seal-word">{label}</div>
      </div>
    </div>
  );
}
