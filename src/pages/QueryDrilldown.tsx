
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { PageDoc, QueryItem, QueryType } from '../api/types';

interface FlatQuery extends QueryItem {
  apiName: string;
}

const VALID_QUERY_TYPES: QueryType[] = [
  'SELECT',
  'INSERT',
  'UPDATE',
  'DELETE',
];

export default function QueryDrilldown() {
  const { projectId, pageId, type } = useParams<{
    projectId: string;
    pageId: string;
    type: string;
  }>();

  const [page, setPage] = useState<PageDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  const qType = (type || '').toUpperCase() as QueryType;
  const validType = VALID_QUERY_TYPES.includes(qType);

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      if (!pageId || !projectId) {
        setError('Invalid project or page');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      setPage(null);

      try {
        const result = await api.getPage(pageId);

        if (!cancelled) {
          setPage(result);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Could not load page queries'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPage();

    return () => {
      cancelled = true;
    };
  }, [projectId, pageId]);

  if (loading) {
    return (
      <div className="empty-state" style={{ margin: 32 }}>
        <b>Loading queries…</b>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="empty-state" style={{ margin: 32 }}>
        <b>Could not load queries</b>
        {error || 'Page not found'}
        <button
          className="btn"
          onClick={() => navigate(`/projects/${projectId || ''}`)}
        >
          Back to project
        </button>
      </div>
    );
  }

  if (!validType) {
    return (
      <div className="empty-state" style={{ margin: 32 }}>
        <b>Invalid query type</b>
        The requested query type is not supported.
        <button
          className="btn"
          onClick={() =>
            navigate(`/projects/${projectId}/pages/${pageId}`)
          }
        >
          Back to page
        </button>
      </div>
    );
  }

  const flat: FlatQuery[] = [];

  page.apis.forEach((apiItem) => {
    apiItem.queries.forEach((query) => {
      if (query.type === qType) {
        flat.push({
          ...query,
          apiName: apiItem.name,
        });
      }
    });
  });

  const apiCount = new Set(flat.map((query) => query.apiName)).size;

  return (
    <div className="view">
      <button
        className="back-btn"
        onClick={() =>
          navigate(`/projects/${projectId}/pages/${pageId}`)
        }
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M15 6l-6 6 6 6"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Back to {page.name}
      </button>

      <div className="view-header">
        <div>
          <div className="view-eyebrow">Query drill-down</div>

          <div className="view-title">
            <span
              className={`qtype ${qType}`}
              style={{
                marginRight: 10,
                display: 'inline-block',
                verticalAlign: 'middle',
              }}
            >
              {qType}
            </span>

            {page.name}
          </div>

          <div className="view-sub">
            {flat.length} {qType.toLowerCase()}{' '}
            {flat.length === 1 ? 'query' : 'queries'} across {apiCount}{' '}
            API{apiCount === 1 ? '' : 's'}.
          </div>
        </div>
      </div>

      {flat.length === 0 ? (
        <div className="empty-state">
          <b>No {qType.toLowerCase()} queries</b>
          This page has no logged queries of this type.
        </div>
      ) : (
        <div className="panel">
          {flat.map((query) => (
            <div className="qrow" key={query.id}>
              <div className={`qtype ${query.type}`}>
                {query.type}
              </div>

              <div className="qbody">
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11.5,
                    color: 'var(--mig)',
                    marginBottom: 6,
                  }}
                >
                  {query.apiName}
                </div>

                <div className="qsql">{query.sql}</div>

                <div className="qmeta">
                  {query.tables.length > 0 && (
                    <span>
                      <b>Tables:</b> {query.tables.join(', ')}
                    </span>
                  )}

                  {query.columns.length > 0 && (
                    <span>
                      <b>Columns set:</b> {query.columns.join(', ')}
                    </span>
                  )}

                  {query.maxRows && (
                    <span>
                      <b>Max rows:</b> {query.maxRows}
                    </span>
                  )}
                </div>

                {query.notes && (
                  <div className="qnotes">{query.notes}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
