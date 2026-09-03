/**
 * codeExtractor.ts
 * ------------------------------------------------------------------
 * Fully offline extraction engine. Everything here is plain-text
 * regex parsing that runs in the browser — nothing is sent to a
 * server, an API, or an LLM. Mirrors (and extends) the logic in the
 * standalone extract_vb_sql.py script, adding a Django/ORM-aware
 * parser for the migrated side and a heuristic diff between the two.
 * ------------------------------------------------------------------
 */

export type QueryType = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';

export interface ExtractedQuery {
  type: QueryType;
  sql: string;
  tables: string[];
  columns: string[];
  whereConditions: string;
  maxRows: string;
  source: 'vb' | 'django';
}

export interface QueryDiff {
  id: string;
  type: QueryType;
  vbSql: string;
  migratedSql: string;
  tables: string[];
  columns: string[];
  whereConditions: string;
  maxRows: string;
  notes: string;
  matched: boolean;
}

export interface ExtractionResult {
  pageName: string;
  apiName: string;
  workflow: string[];
  djangoWorkflow: string[];
  queryDiffs: QueryDiff[];
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function collapseWs(s: string): string {
  return s.replace(/[ \t]+/g, ' ').trim();
}

/** Split on `sep` but not inside parentheses — e.g. SET a=1, b=fn(x,y) */
function splitTopLevel(text: string, sep: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let buf = '';
  for (const ch of text) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === sep && depth === 0) {
      parts.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf) parts.push(buf);
  return parts;
}

function normalizeTableName(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Loose "do these two table identifiers plausibly refer to the same table" check */
function tablesOverlap(a: string[], b: string[]): boolean {
  const na = a.map(normalizeTableName);
  const nb = b.map(normalizeTableName);
  return na.some((x) => nb.some((y) => x.includes(y) || y.includes(x)));
}

// ---------------------------------------------------------------------------
// VB.NET side (aspx + aspx.vb pasted together)
// ---------------------------------------------------------------------------

const VB_SQL_KEYWORDS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'WITH'];
const VB_STRING = String.raw`"(?:[^"\n]|"")*"`;
const VB_CHAIN_RE = new RegExp(`${VB_STRING}(?:\\s*&\\s*${VB_STRING})*`, 'g');
const VB_PART_RE = new RegExp(VB_STRING, 'g');

function stripVbLineComment(line: string): string {
  let inString = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inString && line.slice(i, i + 2) === '""') { i++; continue; }
      inString = !inString;
    } else if (ch === "'" && !inString) {
      return line.slice(0, i);
    }
  }
  return line;
}

function mergeVbContinuations(text: string): string {
  const lines = text.split('\n');
  const merged: string[] = [];
  let buf = '';
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (line.endsWith(' _') || line === '_') {
      buf += line.slice(0, -1).replace(/\s+$/, '') + ' ';
    } else {
      merged.push(buf + raw);
      buf = '';
    }
  }
  if (buf) merged.push(buf);
  return merged.join('\n');
}

function preprocessVb(raw: string): string {
  const noComments = raw.split('\n').map(stripVbLineComment).join('\n');
  return mergeVbContinuations(noComments);
}

function unescapeVbString(literal: string): string {
  return literal.slice(1, -1).replace(/""/g, '"');
}

function looksLikeSql(joined: string): boolean {
  const head = joined.trim().toUpperCase();
  if (VB_SQL_KEYWORDS.some((kw) => head.startsWith(kw))) return true;
  return /( FROM | SET | VALUES |INSERT INTO)/.test(head);
}

function extractWhereConditions(sql: string): string {
  const m = sql.match(/\bWHERE\b(.*?)(?:\bGROUP BY\b|\bORDER BY\b|$)/i);
  return m ? collapseWs(m[1]) : '';
}

function extractSetColumns(sql: string): string[] {
  const m = sql.match(/\bSET\b(.*?)(?:\bWHERE\b|$)/is);
  if (!m) return [];
  const cols = new Set<string>();
  for (const clause of splitTopLevel(m[1], ',')) {
    const col = clause.split('=')[0]?.trim();
    if (col && /^[A-Za-z_][A-Za-z0-9_]*$/.test(col)) cols.add(col);
  }
  return [...cols];
}

function extractInsertColumns(sql: string): string[] {
  const m = sql.match(/\bINSERT\s+INTO\s+[A-Za-z_][A-Za-z0-9_.]*\s*\(([^)]*)\)/i);
  if (!m) return [];
  return m[1].split(',').map((c) => c.trim()).filter(Boolean);
}

function extractTables(sql: string): string[] {
  const tables = new Set<string>();
  const patterns = [
    /\bFROM\s+([A-Za-z_][A-Za-z0-9_.]*)/gi,
    /\bUPDATE\s+([A-Za-z_][A-Za-z0-9_.]*)/gi,
    /\bINSERT\s+INTO\s+([A-Za-z_][A-Za-z0-9_.]*)/gi,
    /\bJOIN\s+([A-Za-z_][A-Za-z0-9_.]*)/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql))) tables.add(m[1]);
  }
  return [...tables];
}

export function parseVbQueries(rawCode: string): ExtractedQuery[] {
  const cleaned = preprocessVb(rawCode);
  const results: ExtractedQuery[] = [];
  const seen = new Set<string>();

  let m: RegExpExecArray | null;
  VB_CHAIN_RE.lastIndex = 0;
  while ((m = VB_CHAIN_RE.exec(cleaned))) {
    const parts = [...m[0].matchAll(VB_PART_RE)].map((p) => unescapeVbString(p[0]));
    const joined = collapseWs(parts.join(''));
    if (joined.length < 6 || !looksLikeSql(joined)) continue;

    const upper = joined.toUpperCase();
    const type: string = VB_SQL_KEYWORDS.find((kw) => upper.startsWith(kw)) || 'SELECT';
    const key = joined.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({
      type: (type === 'WITH' ? 'SELECT' : type) as QueryType,
      sql: joined,
      tables: extractTables(joined),
      columns: type === 'UPDATE' ? extractSetColumns(joined) : type === 'INSERT' ? extractInsertColumns(joined) : [],
      whereConditions: extractWhereConditions(joined),
      maxRows: '',
      source: 'vb',
    });
  }
  return results;
}

const VB_CONTROL_PATTERNS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^\s*(Public|Private|Protected|Friend)?\s*(Shared\s+)?(Sub|Function)\s+(\w+)/i, (m) => `Entry point: ${m[4]}`],
  [/^\s*If\s+(.+?)\s+Then\s*$/i, (m) => `Checks whether ${condense(m[1])}`],
  [/^\s*ElseIf\s+(.+?)\s+Then\s*$/i, (m) => `Otherwise, if ${condense(m[1])}`],
  [/^\s*Else\s*$/i, () => 'Otherwise (else branch)'],
  [/^\s*For\s+Each\s+(\w+)\s+In\s+(.+)/i, (m) => `Loops over ${condense(m[2])} (as ${m[1]})`],
  [/^\s*For\s+(\w+)\s*=\s*(.+?)\s+To\s+(.+)/i, (m) => `Loops ${m[1]} from ${condense(m[2])} to ${condense(m[3])}`],
  [/^\s*Select\s+Case\s+(.+)/i, (m) => `Branches on ${condense(m[1])}`],
  [/^\s*Case\s+(.+)/i, (m) => `  Case: ${condense(m[1])}`],
  [/^\s*Try\s*$/i, () => 'Begins a try block'],
  [/^\s*Catch\s*(.*)/i, (m) => `Handles exception${m[1]?.trim() ? ': ' + condense(m[1]) : ''}`],
  [/\.Open\s*\(\s*\)/i, () => 'Opens a database connection'],
  [/\.ExecuteReader\s*\(/i, () => 'Executes a SELECT and reads the result set'],
  [/\.ExecuteNonQuery\s*\(/i, () => 'Executes an INSERT/UPDATE/DELETE against the database'],
  [/\.ExecuteScalar\s*\(/i, () => 'Executes a query and reads a single scalar value'],
  [/^\s*Return\s+(.*)/i, (m) => `Returns ${m[1]?.trim() ? condense(m[1]) : 'from the method'}`],
  [/Response\.Write\s*\(/i, () => 'Writes a response back to the caller'],
];

function condense(expr: string, limit = 90): string {
  const c = expr.replace(/\s+/g, ' ').trim().replace(/:$/, '');
  return c.length <= limit ? c : c.slice(0, limit - 1) + '…';
}

export function extractVbWorkflow(rawCode: string): string[] {
  const cleaned = preprocessVb(rawCode);
  const steps: string[] = [];
  for (const line of cleaned.split('\n')) {
    if (!line.trim()) continue;
    for (const [pattern, fmt] of VB_CONTROL_PATTERNS) {
      const m = line.match(pattern);
      if (m) { steps.push(fmt(m)); break; }
    }
  }
  return steps.filter((s, i) => i === 0 || s !== steps[i - 1]);
}

export function extractVbPageName(rawCode: string): string {
  const classMatch = rawCode.match(/\bPublic\s+Class\s+(\w+)/i);
  if (classMatch) return classMatch[1];
  const pageDirective = rawCode.match(/<%@\s*Page[^%]*\bClass\s*=\s*"([\w.]+)"/i);
  if (pageDirective) {
    const parts = pageDirective[1].split('.');
    return parts[parts.length - 1];
  }
  return '';
}

// ---------------------------------------------------------------------------
// Django + React side (migrated code, pasted together)
// ---------------------------------------------------------------------------

const PY_TRIPLE_RE = /f?"""[\s\S]*?"""|f?'''[\s\S]*?'''/g;
const PY_SIMPLE_STRING = String.raw`"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'`;
const PY_EXEC_CALL_RE = new RegExp(
  String.raw`\.(?:raw|execute)\(\s*(f?"""[\s\S]*?"""|f?'''[\s\S]*?'''|f?${PY_SIMPLE_STRING})`,
  'g',
);

function unwrapPyString(literal: string): string {
  let s = literal.trim();
  if (s.startsWith('f')) s = s.slice(1);
  if (s.startsWith('"""') || s.startsWith("'''")) return s.slice(3, -3);
  return s.slice(1, -1);
}

function normalizePySql(text: string): string {
  // collapse %s / {var} / {} placeholders to a generic marker for readability
  return collapseWs(text.replace(/\{[^{}]*\}/g, '?'));
}

/** Raw SQL pulled from cursor.execute(...) / Model.objects.raw(...) calls */
function parseDjangoRawSql(code: string): ExtractedQuery[] {
  const results: ExtractedQuery[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  PY_EXEC_CALL_RE.lastIndex = 0;
  while ((m = PY_EXEC_CALL_RE.exec(code))) {
    const sql = normalizePySql(unwrapPyString(m[1]));
    if (sql.length < 6 || !looksLikeSql(sql)) continue;
    const upper = sql.toUpperCase();
    const type: string = VB_SQL_KEYWORDS.find((kw) => upper.startsWith(kw)) || 'SELECT';
    const key = upper;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      type: (type === 'WITH' ? 'SELECT' : type) as QueryType,
      sql,
      tables: extractTables(sql),
      columns: type === 'UPDATE' ? extractSetColumns(sql) : type === 'INSERT' ? extractInsertColumns(sql) : [],
      whereConditions: extractWhereConditions(sql),
      maxRows: '',
      source: 'django',
    });
  }
  return results;
}

interface OrmMatch {
  model: string;
  kwargsFilter: string;
  kwargsWrite: string;
  kind: 'update' | 'create' | 'delete' | 'select' | 'get';
  span: [number, number];
}

function kwargsToConditions(kwargs: string): string {
  return splitTopLevel(kwargs, ',').map((c) => collapseWs(c)).filter(Boolean).join(', ');
}
function kwargsToColumns(kwargs: string): string[] {
  return splitTopLevel(kwargs, ',')
    .map((c) => c.split('=')[0]?.trim())
    .filter((c): c is string => !!c && /^[A-Za-z_][A-Za-z0-9_]*$/.test(c));
}

/**
 * Given `code` and the index of an opening '(', returns the text between it
 * and its matching ')' (handling nested parens and string literals so
 * commas/parens inside e.g. F('Std') don't break the scan), plus the index
 * right after the closing ')'.
 */
function matchBalancedParens(code: string, openIdx: number): { inner: string; endIdx: number } | null {
  if (code[openIdx] !== '(') return null;
  let depth = 0;
  let quote: string | null = null;
  for (let i = openIdx; i < code.length; i++) {
    const ch = code[i];
    if (quote) {
      if (ch === '\\') { i++; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return { inner: code.slice(openIdx + 1, i), endIdx: i + 1 };
    }
  }
  return null; // unbalanced — give up on this call
}

function skipWs(code: string, idx: number): number {
  let i = idx;
  while (i < code.length && /\s/.test(code[i])) i++;
  return i;
}

/** Django ORM calls: Model.objects.filter(...).update(...) / .create(...) / .delete() / .get(...) / .all() */
function parseDjangoOrm(code: string): ExtractedQuery[] {
  const matches: OrmMatch[] = [];
  const entryRe = /(\w+)\.objects\.(filter|get|create|all)\(/g;

  let m: RegExpExecArray | null;
  entryRe.lastIndex = 0;
  while ((m = entryRe.exec(code))) {
    const model = m[1];
    const method = m[2] as 'filter' | 'get' | 'create' | 'all';
    const openIdx = m.index + m[0].length - 1;
    const balanced = matchBalancedParens(code, openIdx);
    if (!balanced) continue;
    const { inner: args, endIdx } = balanced;
    entryRe.lastIndex = endIdx; // resume scanning after this call

    if (method === 'create') {
      matches.push({ model, kwargsFilter: '', kwargsWrite: args, kind: 'create', span: [m.index, endIdx] });
      continue;
    }
    if (method === 'get') {
      matches.push({ model, kwargsFilter: args, kwargsWrite: '', kind: 'get', span: [m.index, endIdx] });
      continue;
    }
    if (method === 'all') {
      matches.push({ model, kwargsFilter: '', kwargsWrite: '', kind: 'select', span: [m.index, endIdx] });
      continue;
    }

    // method === 'filter' — check for a chained .update(...) / .delete() right after it
    const afterFilter = skipWs(code, endIdx);
    const chainedUpdate = code.slice(afterFilter).match(/^\.update\(/);
    const chainedDelete = code.slice(afterFilter).match(/^\.delete\(\s*\)/);

    if (chainedUpdate) {
      const updOpenIdx = afterFilter + chainedUpdate[0].length - 1;
      const updBalanced = matchBalancedParens(code, updOpenIdx);
      if (updBalanced) {
        matches.push({ model, kwargsFilter: args, kwargsWrite: updBalanced.inner, kind: 'update', span: [m.index, updBalanced.endIdx] });
        entryRe.lastIndex = updBalanced.endIdx;
        continue;
      }
    }
    if (chainedDelete) {
      const deleteEnd = afterFilter + chainedDelete[0].length;
      matches.push({ model, kwargsFilter: args, kwargsWrite: '', kind: 'delete', span: [m.index, deleteEnd] });
      entryRe.lastIndex = deleteEnd;
      continue;
    }

    matches.push({ model, kwargsFilter: args, kwargsWrite: '', kind: 'select', span: [m.index, endIdx] });
  }

  return matches.map((mm) => {
    const type: QueryType = mm.kind === 'update' ? 'UPDATE' : mm.kind === 'create' ? 'INSERT' : mm.kind === 'delete' ? 'DELETE' : 'SELECT';
    const sqlPreview =
      type === 'UPDATE' ? `UPDATE ${mm.model} SET ${kwargsToConditions(mm.kwargsWrite)} WHERE ${kwargsToConditions(mm.kwargsFilter)}`
        : type === 'INSERT' ? `INSERT INTO ${mm.model} (${kwargsToColumns(mm.kwargsWrite).join(', ')})`
        : type === 'DELETE' ? `DELETE FROM ${mm.model} WHERE ${kwargsToConditions(mm.kwargsFilter)}`
        : `SELECT * FROM ${mm.model}${mm.kwargsFilter ? ' WHERE ' + kwargsToConditions(mm.kwargsFilter) : ''}`;

    return {
      type,
      sql: collapseWs(sqlPreview),
      tables: [mm.model],
      columns: type === 'UPDATE' ? kwargsToColumns(mm.kwargsWrite) : type === 'INSERT' ? kwargsToColumns(mm.kwargsWrite) : [],
      whereConditions: kwargsToConditions(mm.kwargsFilter),
      maxRows: '',
      source: 'django' as const,
    };
  });
}

export function parseDjangoQueries(code: string): ExtractedQuery[] {
  return [...parseDjangoRawSql(code), ...parseDjangoOrm(code)];
}

export function extractApiName(migratedCode: string): string {
  const pathMatch = migratedCode.match(/path\(\s*['"]([^'"]+)['"]/);
  if (pathMatch) return pathMatch[1];
  const apiViewFn = migratedCode.match(/@api_view\([^)]*\)\s*\n\s*def\s+(\w+)/);
  if (apiViewFn) return `api/${toSnake(apiViewFn[1])}/`;
  const defFn = migratedCode.match(/def\s+(\w+)\s*\(\s*request/);
  if (defFn) return `api/${toSnake(defFn[1])}/`;
  const classView = migratedCode.match(/class\s+(\w+)\(\s*\w*View\w*\s*\)/);
  if (classView) return `api/${toSnake(classView[1].replace(/View$/, ''))}/`;
  return '';
}

function toSnake(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

const PY_CONTROL_PATTERNS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^\s*def\s+(\w+)\s*\(/, (m) => `Entry point: ${m[1]}`],
  [/^\s*class\s+(\w+)/, (m) => `Class: ${m[1]}`],
  [/^\s*if\s+(.+):\s*$/, (m) => `Checks whether ${condense(m[1])}`],
  [/^\s*elif\s+(.+):\s*$/, (m) => `Otherwise, if ${condense(m[1])}`],
  [/^\s*else\s*:\s*$/, () => 'Otherwise (else branch)'],
  [/^\s*for\s+(\w+)\s+in\s+(.+):\s*$/, (m) => `Loops over ${condense(m[2])} (as ${m[1]})`],
  [/^\s*try\s*:\s*$/, () => 'Begins a try block'],
  [/^\s*except\s*(.*):\s*$/, (m) => `Handles exception${m[1]?.trim() ? ': ' + condense(m[1]) : ''}`],
  [/\.save\s*\(/, () => 'Saves the model instance'],
  [/\.delete\s*\(/, () => 'Deletes matching row(s)'],
  [/\.update\s*\(/, () => 'Updates matching row(s)'],
  [/\.create\s*\(/, () => 'Creates a new row'],
  [/\.filter\s*\(/, () => 'Queries rows matching a filter'],
  [/^\s*return\s+(.*)/, (m) => `Returns ${m[1]?.trim() ? condense(m[1]) : 'from the function'}`],
];

export function extractDjangoWorkflow(code: string): string[] {
  const steps: string[] = [];
  for (const line of code.split('\n')) {
    if (!line.trim()) continue;
    for (const [pattern, fmt] of PY_CONTROL_PATTERNS) {
      const m = line.match(pattern);
      if (m) { steps.push(fmt(m)); break; }
    }
  }
  return steps.filter((s, i) => i === 0 || s !== steps[i - 1]);
}

// ---------------------------------------------------------------------------
// VB vs. migrated diff
// ---------------------------------------------------------------------------

function diffConditionSets(vbConds: string, djConds: string): { missing: string[]; extra: string[] } {
  const fieldName = (c: string) => (c.split(/[=<>!]/)[0] || '').trim().toLowerCase();
  const vbFields = splitTopLevel(vbConds.replace(/\bAND\b|\bOR\b/gi, ','), ',').map(fieldName).filter(Boolean);
  const djFields = splitTopLevel(djConds.replace(/\bAND\b|\bOR\b/gi, ','), ',').map(fieldName).filter(Boolean);
  const djSet = new Set(djFields);
  const vbSet = new Set(vbFields);
  return {
    missing: vbFields.filter((f) => !djSet.has(f)),
    extra: djFields.filter((f) => !vbSet.has(f)),
  };
}

function diffColumnSets(vbCols: string[], djCols: string[]): { missing: string[]; extra: string[] } {
  const norm = (c: string) => c.toLowerCase();
  const djSet = new Set(djCols.map(norm));
  const vbSet = new Set(vbCols.map(norm));
  return {
    missing: vbCols.filter((c) => !djSet.has(norm(c))),
    extra: djCols.filter((c) => !vbSet.has(norm(c))),
  };
}

export function diffQueryPairs(vbQueries: ExtractedQuery[], djQueries: ExtractedQuery[]): QueryDiff[] {
  const usedVb = new Set<number>();
  const usedDj = new Set<number>();
  const pairs: QueryDiff[] = [];

  djQueries.forEach((dj, di) => {
    let bestVi = -1;
    for (let vi = 0; vi < vbQueries.length; vi++) {
      if (usedVb.has(vi)) continue;
      const vb = vbQueries[vi];
      if (vb.type !== dj.type) continue;
      if (tablesOverlap(vb.tables, dj.tables)) { bestVi = vi; break; }
      if (bestVi === -1) bestVi = vi; // same-type fallback if nothing else matches
    }
    if (bestVi !== -1) {
      usedVb.add(bestVi);
      usedDj.add(di);
      const vb = vbQueries[bestVi];
      const notes: string[] = [];
      if (!tablesOverlap(vb.tables, dj.tables)) {
        notes.push(`⚠ Table mismatch: VB touches [${vb.tables.join(', ') || '—'}], migrated touches [${dj.tables.join(', ') || '—'}]`);
      }
      const colDiff = diffColumnSets(vb.columns, dj.columns);
      if (colDiff.missing.length) notes.push(`🔴 Missing column(s) in migrated: ${colDiff.missing.join(', ')}`);
      if (colDiff.extra.length) notes.push(`🟡 Extra column(s) in migrated: ${colDiff.extra.join(', ')}`);
      const condDiff = diffConditionSets(vb.whereConditions, dj.whereConditions);
      if (condDiff.missing.length) notes.push(`🔴 Missing WHERE condition(s) in migrated: ${condDiff.missing.join(', ')}`);
      if (condDiff.extra.length) notes.push(`🟡 Extra WHERE condition(s) in migrated: ${condDiff.extra.join(', ')}`);
      if (notes.length === 0) notes.push('✅ Tables, columns, and WHERE conditions line up');

      pairs.push({
        id: uid(),
        type: dj.type,
        vbSql: vb.sql,
        migratedSql: dj.sql,
        tables: [...new Set([...vb.tables, ...dj.tables])],
        columns: [...new Set([...vb.columns, ...dj.columns])],
        whereConditions: vb.whereConditions || dj.whereConditions,
        maxRows: '',
        notes: notes.join('\n'),
        matched: true,
      });
    }
  });

  vbQueries.forEach((vb, vi) => {
    if (usedVb.has(vi)) return;
    pairs.push({
      id: uid(),
      type: vb.type,
      vbSql: vb.sql,
      migratedSql: '',
      tables: vb.tables,
      columns: vb.columns,
      whereConditions: vb.whereConditions,
      maxRows: '',
      notes: '🔴 No matching migrated query found — check whether this logic was migrated at all.',
      matched: false,
    });
  });

  djQueries.forEach((dj, di) => {
    if (usedDj.has(di)) return;
    pairs.push({
      id: uid(),
      type: dj.type,
      vbSql: '',
      migratedSql: dj.sql,
      tables: dj.tables,
      columns: dj.columns,
      whereConditions: dj.whereConditions,
      maxRows: '',
      notes: 'ℹ Extra query in migrated code with no VB equivalent — new logic, or a VB query this tool missed.',
      matched: false,
    });
  });

  return pairs;
}

// ---------------------------------------------------------------------------
// Top-level entry point
// ---------------------------------------------------------------------------

export function extractAll(vbCode: string, migratedCode: string): ExtractionResult {
  const vbQueries = parseVbQueries(vbCode);
  const djQueries = parseDjangoQueries(migratedCode);

  return {
    pageName: extractVbPageName(vbCode),
    apiName: extractApiName(migratedCode),
    workflow: extractVbWorkflow(vbCode),
    djangoWorkflow: extractDjangoWorkflow(migratedCode),
    queryDiffs: diffQueryPairs(vbQueries, djQueries),
  };
}