import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { PageDoc, QueryItem, QueryType } from '../api/types';

interface FlatQuery extends QueryItem {
  apiName: string;
}

export default function QueryDrilldown() {
  const { projectId, pageId, type } = useParams<{ projectId: string; pageId: string; type: string }>();
  const [page, setPage] = useState<PageDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!pageId) return;
    setLoading(true);
    api.getPage(pageId).then(setPage).finally(() => setLoading(false));
  }, [pageId]);

  if (loading || !page) {
    return <div className="empty-state" style={{ margin: 32 }}><b>Loading queries…</b></div>;
  }

  const qType = (type || '').toUpperCase() as QueryType;
  const flat: FlatQuery[] = [];
  page.apis.forEach((a) => a.queries.forEach((q) => {
    if (q.type === qType) flat.push({ ...q, apiName: a.name });
  }));

  return (
    <div className="view">
      <button className="back-btn" onClick={() => navigate(`/projects/${projectId}/pages/${pageId}`)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Back to {page.name}
      </button>

      <div className="view-header">
        <div>
          <div className="view-eyebrow">Query drill-down</div>
          <div className="view-title">
            <span className={`qtype ${qType}`} style={{ marginRight: 10, display: 'inline-block', verticalAlign: 'middle' }}>{qType}</span>
            {page.name}
          </div>
          <div className="view-sub">{flat.length} {qType.toLowerCase()} {flat.length === 1 ? 'query' : 'queries'} across {new Set(flat.map((f) => f.apiName)).size} API{new Set(flat.map((f) => f.apiName)).size === 1 ? '' : 's'}.</div>
        </div>
      </div>

      {flat.length === 0 ? (
        <div className="empty-state"><b>No {qType.toLowerCase()} queries</b>This page has no logged queries of this type.</div>
      ) : (
        <div className="panel">
          {flat.map((q) => (
            <div className="qrow" key={q.id}>
              <div className={`qtype ${q.type}`}>{q.type}</div>
              <div className="qbody">
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--mig)', marginBottom: 6 }}>{q.apiName}</div>
                <div className="qsql">{q.sql}</div>
                <div className="qmeta">
                  {q.tables.length > 0 && <span><b>Tables:</b> {q.tables.join(', ')}</span>}
                  {q.columns.length > 0 && <span><b>Columns set:</b> {q.columns.join(', ')}</span>}
                  {q.maxRows && <span><b>Max rows:</b> {q.maxRows}</span>}
                </div>
                {q.notes && <div className="qnotes">{q.notes}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
