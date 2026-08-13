import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TreeNode } from '../api/types';

function FolderIcon({ open }: { open: boolean }) {
  const d = open
    ? 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v2H3V7z M3 9h18v8a2 2 0 01-2 2H5a2 2 0 01-2-2V9z'
    : 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z';
  return (
    <svg className="node-icon" viewBox="0 0 24 24" fill="none">
      <path d={d} fill="currentColor" opacity="0.85" />
    </svg>
  );
}
const PageIcon = () => (
  <svg className="node-icon" viewBox="0 0 24 24" fill="none">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="1.6" />
    <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

function statusColor(status?: string) {
  if (status === 'verified') return 'var(--verified)';
  if (status === 'mismatch') return 'var(--mismatch)';
  return 'var(--pending)';
}

function countPages(node: TreeNode): number {
  if (node.type === 'page') return 1;
  return (node.children || []).reduce((sum, c) => sum + countPages(c), 0);
}

function Node({ node, projectId, activePageId, level }: { node: TreeNode; projectId: string; activePageId?: string; level: number }) {
  const [open, setOpen] = useState(level < 1);
  const navigate = useNavigate();

  if (node.type === 'folder') {
    const pageCount = countPages(node);
    return (
      <div className="node">
        <div className="node-row" onClick={() => setOpen((o) => !o)}>
          <svg className={`chev ${open ? 'open' : ''}`} viewBox="0 0 24 24" fill="none">
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <FolderIcon open={open} />
          <span className="node-label">{node.name}</span>
          {pageCount > 0 && <span className="node-count">{pageCount}</span>}
        </div>
        {open && (
          <div className="node-children">
            {(node.children || []).map((c) => (
              <Node key={c.id} node={c} projectId={projectId} activePageId={activePageId} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="node">
      <div
        className={`node-row ${activePageId === node.id ? 'active' : ''}`}
        onClick={() => navigate(`/projects/${projectId}/pages/${node.id}`)}
      >
        <span style={{ width: 11 }} />
        <PageIcon />
        <span className="node-label">{node.name}</span>
        <span className="dot" style={{ background: statusColor(node.status) }} />
      </div>
    </div>
  );
}

export function Tree({ nodes, projectId, activePageId }: { nodes: TreeNode[]; projectId: string; activePageId?: string }) {
  if (nodes.length === 0) {
    return <div style={{ padding: '14px 10px', color: 'var(--text-faint)', fontSize: 12 }}>No folders yet.</div>;
  }
  return (
    <>
      {nodes.map((n) => (
        <Node key={n.id} node={n} projectId={projectId} activePageId={activePageId} level={0} />
      ))}
    </>
  );
}
