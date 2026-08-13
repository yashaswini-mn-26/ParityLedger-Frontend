import axios from 'axios';
import type {
  Project, TreeNode, PageDoc, PageSummary, FolderOption, UserSummary, Role,
} from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const client = axios.create({ baseURL: API_URL });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('pl_token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem('pl_token');
      localStorage.removeItem('pl_user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  },
);

function unwrapError(e: any): string {
  return e?.response?.data?.error || e?.message || 'Something went wrong';
}

export const api = {
  // ---- auth ----
  async login(username: string, password: string) {
    try {
      const { data } = await client.post('/auth/login', { username, password });
      return data as { token: string; user: UserSummary };
    } catch (e) { throw new Error(unwrapError(e)); }
  },
  async me() {
    const { data } = await client.get('/auth/me');
    return data as UserSummary;
  },
  async createUser(payload: { username: string; password: string; name: string; role: Role }) {
    try {
      const { data } = await client.post('/auth/users', payload);
      return data as UserSummary;
    } catch (e) { throw new Error(unwrapError(e)); }
  },
  async listUsers() {
    const { data } = await client.get('/auth/users');
    return data as UserSummary[];
  },
  async listDevelopers() {
    const { data } = await client.get('/auth/developers');
    return data as UserSummary[];
  },

  // ---- projects ----
  async listProjects() {
    const { data } = await client.get('/projects');
    return data as Project[];
  },
  async createProject(payload: { name: string; description: string }) {
    try {
      const { data } = await client.post('/projects', payload);
      return data as Project;
    } catch (e) { throw new Error(unwrapError(e)); }
  },
  async getProject(id: string) {
    const { data } = await client.get(`/projects/${id}`);
    return data as Project;
  },
  async deleteProject(id: string) {
    await client.delete(`/projects/${id}`);
  },
  async getTree(projectId: string) {
    const { data } = await client.get(`/projects/${projectId}/tree`);
    return data as TreeNode[];
  },

  // ---- folders ----
  async createFolder(projectId: string, payload: { name: string; parent_id: string | null }) {
    try {
      const { data } = await client.post(`/projects/${projectId}/folders`, payload);
      return data;
    } catch (e) { throw new Error(unwrapError(e)); }
  },
  async listFoldersFlat(projectId: string) {
    const { data } = await client.get(`/projects/${projectId}/folders`);
    return data as FolderOption[];
  },
  async deleteFolder(folderId: string) {
    await client.delete(`/folders/${folderId}`);
  },

  // ---- pages ----
  async listPages(projectId: string) {
    const { data } = await client.get(`/projects/${projectId}/pages`);
    return data as PageSummary[];
  },
  async getPage(pageId: string) {
    const { data } = await client.get(`/pages/${pageId}`);
    return data as PageDoc;
  },
  async createPage(projectId: string, payload: Partial<PageDoc> & { folder_id?: string | null }) {
    try {
      const { data } = await client.post(`/projects/${projectId}/pages`, payload);
      return data as PageDoc;
    } catch (e) { throw new Error(unwrapError(e)); }
  },
  async updatePage(pageId: string, payload: Partial<PageDoc> & { folder_id?: string | null }) {
    try {
      const { data } = await client.put(`/pages/${pageId}`, payload);
      return data as PageDoc;
    } catch (e) { throw new Error(unwrapError(e)); }
  },
  async deletePage(pageId: string) {
    await client.delete(`/pages/${pageId}`);
  },
  async reviewPage(pageId: string, payload: { status: string; verdict: string }) {
    try {
      const { data } = await client.post(`/pages/${pageId}/review`, payload);
      return data as PageDoc;
    } catch (e) { throw new Error(unwrapError(e)); }
  },
  async approvePage(pageId: string) {
    try {
      const { data } = await client.post(`/pages/${pageId}/approve`, {});
      return data as PageDoc;
    } catch (e) { throw new Error(unwrapError(e)); }
  },
  async assignPage(pageId: string, assignedTo: string | null) {
    try {
      const { data } = await client.post(`/pages/${pageId}/assign`, { assigned_to: assignedTo });
      return data as PageDoc;
    } catch (e) { throw new Error(unwrapError(e)); }
  },
async addComment(pageId: string, payload: { text: string; image?: string; parent_id?: string | null }) {
  try {
    const { data } = await client.post(`/pages/${pageId}/comments`, payload);
    return data as PageDoc;
  } catch (e) { throw new Error(unwrapError(e)); }
},
  async deleteComment(pageId: string, commentId: string) {
    const { data } = await client.delete(`/pages/${pageId}/comments/${commentId}`);
    return data as PageDoc;
  },

  // ---- search ----
  async search(projectId: string, q: string, status: string) {
    const { data } = await client.get(`/projects/${projectId}/search`, { params: { q, status } });
    return data as PageSummary[];
  },

  // ---- export ----
  pagePdfUrl(pageId: string) { return `${API_URL}/pages/${pageId}/export/pdf`; },
  pageExcelUrl(pageId: string) { return `${API_URL}/pages/${pageId}/export/excel`; },
  projectExcelUrl(projectId: string) { return `${API_URL}/projects/${projectId}/export/excel`; },

  async downloadFile(url: string, filename: string) {
    const token = localStorage.getItem('pl_token');
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl; a.download = filename; a.click();
    URL.revokeObjectURL(objUrl);
  },
};
