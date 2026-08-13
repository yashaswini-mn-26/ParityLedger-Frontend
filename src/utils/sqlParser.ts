import type { QueryType } from '../api/types';

export interface ParsedQuery {
  type: QueryType;
  sql: string;
  tables: string[];
  columns: string[];
  whereConditions: string;
  maxRows: string;
}

export function collapseWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function splitTopLevelComma(s: string): string[] {
  const parts: string[] = [];
  let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function extractStringLiterals(code: string): string[] {
  const literals: string[] = [];
  let working = code;

  const tripleDouble = /"""([\s\S]*?)"""/g;
  const tripleSingle = /'''([\s\S]*?)'''/g;

  let m: RegExpExecArray | null;
  while ((m = tripleDouble.exec(working))) literals.push(m[1]);
  working = working.replace(tripleDouble, ' ');
  while ((m = tripleSingle.exec(working))) literals.push(m[1]);
  working = working.replace(tripleSingle, ' ');

  const dq = /"((?:[^"\\]|\\.)*)"/g;
  const sq = /'((?:[^'\\]|\\.)*)'/g;
  while ((m = dq.exec(working))) literals.push(m[1]);
  while ((m = sq.exec(working))) literals.push(m[1]);

  return literals;
}

/** Heuristic parser — extracts SELECT/INSERT/UPDATE/DELETE string literals from
 *  pasted method code (Python/Django raw SQL, VB.NET SQL strings, etc).
 *  Not perfect — results are meant to be reviewed/edited, not trusted blindly. */
export function parseQueriesFromCode(code: string): ParsedQuery[] {
  const literals = extractStringLiterals(code);
  const results: ParsedQuery[] = [];
  const seen = new Set<string>();

  for (const raw of literals) {
    const text = collapseWs(raw);
    if (!text) continue;

    let type: QueryType | null = null;
    if (/^SELECT\b/i.test(text)) type = 'SELECT';
    else if (/^INSERT\s+INTO\b/i.test(text)) type = 'INSERT';
    else if (/^UPDATE\b[\s\S]*\bSET\b/i.test(text)) type = 'UPDATE';
    else if (/^DELETE\s+FROM\b/i.test(text)) type = 'DELETE';
    if (!type) continue;

    const key = text.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const tables: string[] = [];
    const tableRe = /\b(?:FROM|JOIN|INTO|UPDATE)\s+([A-Za-z0-9_.[\]]+)/gi;
    let tm: RegExpExecArray | null;
    while ((tm = tableRe.exec(text))) {
      const t = tm[1].replace(/[[\]]/g, '');
      if (t.toUpperCase() !== 'SET' && !tables.includes(t)) tables.push(t);
    }

    let whereConditions = '';
    const whereMatch = text.match(/WHERE\s+([\s\S]*?)(?:\s+ORDER\s+BY|\s+GROUP\s+BY|\s+HAVING|;|$)/i);
    if (whereMatch) whereConditions = collapseWs(whereMatch[1]);

    let columns: string[] = [];
    if (type === 'UPDATE') {
      const setMatch = text.match(/\bSET\s+([\s\S]*?)(?:\s+WHERE\b|$)/i);
      if (setMatch) columns = splitTopLevelComma(setMatch[1]).map((p) => p.split('=')[0].trim()).filter(Boolean);
    } else if (type === 'INSERT') {
      const colMatch = text.match(/INSERT\s+INTO\s+[A-Za-z0-9_.[\]]+\s*\(([^)]*)\)/i);
      columns = colMatch ? splitTopLevelComma(colMatch[1]).map((c) => c.replace(/[[\]]/g, '').trim()) : ['ALL'];
    } else if (type === 'SELECT') {
      const selMatch = text.match(/^SELECT\s+([\s\S]*?)\s+FROM\b/i);
      if (selMatch) {
        const cols = collapseWs(selMatch[1]);
        columns = cols === '*' ? ['ALL'] : splitTopLevelComma(cols);
      }
    }

    let maxRows = '';
    if (/\bTOP\s*\(?\s*1\s*\)?/i.test(text)) maxRows = '1';

    results.push({ type, sql: text, tables, columns, whereConditions, maxRows });
  }

  return results;
}