export type Role = 'admin' | 'user' | 'developer';

export interface UserSummary {
  id: string;
  username: string;
  name: string;
  role: Role;
  created_at?: string;
}

export interface Review {
  id: string;
  status: PageStatus;
  verdict: string;
  reviewed_by: string;
  reviewed_by_name: string;
  reviewed_by_role: Role;   // NEW — admin | user | developer
  reviewed_date: string;
}

export interface Approval {
  id: string;
  approved_by: string;
  approved_by_name: string;
  approved_date: string;
}
export interface Project {
  id: string;
  name: string;
  description: string;
  created_by: string;
  created_at: string;
  page_count?: number;
  folder_count?: number;
}

export interface TreeNode {
  id: string;
  type: 'folder' | 'page';
  name: string;
  status?: PageStatus;
  children?: TreeNode[];
}

export type PageStatus = 'verified' | 'mismatch' | 'pending';
export type QueryType = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';

export interface QueryItem {
  id: string;
  type: QueryType;
  sql: string;
  vbSql: string;
  tables: string[];
  columns: string[];
  whereConditions: string;
  maxRows: string;
  notes: string;
}

export interface ApiBlock {
  id: string;
  name: string;
  queries: QueryItem[];
}

export interface Comparison {
  vbNotes: string;
  migNotes: string;
  vbImage: string;
  migImage: string;
}

export interface Comment {
  id: string;
  parent_id: string | null;  // NEW — null = top-level, else replying to that comment id
  author_id: string;
  author_name: string;
  author_role: Role;
  text: string;
  image: string;
  created_at: string;
}
export interface PageDoc {
  id: string;
  project_id: string;
  folder_id: string | null;
  name: string;
  path: string;
  status: PageStatus;
  verdict: string;
  reviewed_by: string | null;
  reviewed_by_name: string;
  reviewed_by_role: Role;   // NEW — admin | user | developer
  reviewed_date: string | null;
  approved_by: string | null;
  approved_by_name: string;
  approved_date: string | null;
  assigned_to: string | null;
  assigned_to_name: string;
  workflow: string[];
  comparison: Comparison;
  apis: ApiBlock[];
  comments: Comment[];
  created_at: string;
  updated_at: string;
  approvals: Approval[];
  reviews: Review[]; 
}

export interface PageSummary {
  id: string;
  project_id: string;
  folder_id: string | null;
  name: string;
  path: string;
  status: PageStatus;
  verdict: string;
  reviewed_by_name: string;
  approved_by_name: string;
  assigned_to_name: string;
  api_count: number;
  query_count: number;
  table_count: number;
}

export interface FolderOption {
  id: string;
  label: string;
}
