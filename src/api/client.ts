
import axios from 'axios';
import type {
  Project,
  TreeNode,
  PageDoc,
  PageSummary,
  FolderOption,
  UserSummary,
  Role,
  ComparisonImages,
} from './types';

const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
).replace(/\/+$/, '');

export const client = axios.create({
  baseURL: API_URL,
});

type CreateUserRole = Exclude<Role, 'demo'>;

function unwrapError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'Something went wrong'
    );
  }

  return error instanceof Error
    ? error.message
    : 'Something went wrong';
}

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('pl_token');

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem('pl_token');
      localStorage.removeItem('pl_user');

      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export const api = {
  // ---- auth ----


  async login(
    username: string,
    password: string,
    demoWorkspaceToken?: string
  ) {
    try {
      const { data } = await client.post('/auth/login', {
        username,
        password,
        ...(demoWorkspaceToken
          ? { demo_workspace_token: demoWorkspaceToken }
          : {}),
      });

      return data as {
        token: string;
        user: UserSummary;
        demo_workspace_token?: string;
      };
    } catch (error) {
      throw new Error(unwrapError(error));
    }
  },

  async me() {
    const { data } = await client.get('/auth/me');
    return data as UserSummary;
  },

  async createUser(payload: {
    username: string;
    password: string;
    name: string;
    role: CreateUserRole;
  }) {
    try {
      const { data } = await client.post('/auth/users', payload);
      return data as UserSummary;
    } catch (error) {
      throw new Error(unwrapError(error));
    }
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

  async createProject(payload: {
    name: string;
    description: string;
  }) {
    try {
      const { data } = await client.post('/projects', payload);
      return data as Project;
    } catch (error) {
      throw new Error(unwrapError(error));
    }
  },

  async getProject(id: string) {
    const { data } = await client.get(`/projects/${id}`);
    return data as Project;
  },

  async deleteProject(id: string) {
    try {
      await client.delete(`/projects/${id}`);
    } catch (error) {
      throw new Error(unwrapError(error));
    }
  },

  async getTree(projectId: string) {
    const { data } = await client.get(`/projects/${projectId}/tree`);
    return data as TreeNode[];
  },

  // ---- folders ----

  async createFolder(
    projectId: string,
    payload: {
      name: string;
      parent_id: string | null;
    }
  ) {
    try {
      const { data } = await client.post(
        `/projects/${projectId}/folders`,
        payload
      );

      return data;
    } catch (error) {
      throw new Error(unwrapError(error));
    }
  },

  async listFoldersFlat(projectId: string) {
    const { data } = await client.get(
      `/projects/${projectId}/folders`
    );

    return data as FolderOption[];
  },

  async deleteFolder(folderId: string) {
    try {
      await client.delete(`/folders/${folderId}`);
    } catch (error) {
      throw new Error(unwrapError(error));
    }
  },

  // ---- pages ----

  async listPages(projectId: string) {
    const { data } = await client.get(
      `/projects/${projectId}/pages`
    );

    return data as PageSummary[];
  },

  async getPage(pageId: string) {
    const { data } = await client.get(`/pages/${pageId}`);
    return data as PageDoc;
  },

  async createPage(
    projectId: string,
    payload: Partial<PageDoc> & {
      folder_id?: string | null;
    }
  ) {
    try {
      const { data } = await client.post(
        `/projects/${projectId}/pages`,
        payload
      );

      return data as PageDoc;
    } catch (error) {
      throw new Error(unwrapError(error));
    }
  },

  async updatePage(
    pageId: string,
    payload: Partial<PageDoc> & {
      folder_id?: string | null;
    }
  ) {
    try {
      const { data } = await client.put(
        `/pages/${pageId}`,
        payload
      );

      return data as PageDoc;
    } catch (error) {
      throw new Error(unwrapError(error));
    }
  },

  async deletePage(pageId: string) {
    try {
      await client.delete(`/pages/${pageId}`);
    } catch (error) {
      throw new Error(unwrapError(error));
    }
  },

  async reviewPage(
    pageId: string,
    payload: {
      status: string;
      verdict: string;
    }
  ) {
    try {
      const { data } = await client.post(
        `/pages/${pageId}/review`,
        payload
      );

      return data as PageDoc;
    } catch (error) {
      throw new Error(unwrapError(error));
    }
  },

  async approvePage(pageId: string) {
    try {
      const { data } = await client.post(
        `/pages/${pageId}/approve`,
        {}
      );

      return data as PageDoc;
    } catch (error) {
      throw new Error(unwrapError(error));
    }
  },

  async assignPage(
    pageId: string,
    assignedTo: string | null
  ) {
    try {
      const { data } = await client.post(
        `/pages/${pageId}/assign`,
        {
          assigned_to: assignedTo,
        }
      );

      return data as PageDoc;
    } catch (error) {
      throw new Error(unwrapError(error));
    }
  },

  async addComment(
    pageId: string,
    payload: {
      text: string;
      images?: string[];
      parent_id?: string | null;
    }
  ) {
    try {
      const { data } = await client.post(
        `/pages/${pageId}/comments`,
        payload
      );

      return data as PageDoc;
    } catch (error) {
      throw new Error(unwrapError(error));
    }
  },

  async deleteComment(
    pageId: string,
    commentId: string
  ) {
    try {
      const { data } = await client.delete(
        `/pages/${pageId}/comments/${commentId}`
      );

      return data as PageDoc;
    } catch (error) {
      throw new Error(unwrapError(error));
    }
  },

  // ---- lazy-loaded images ----

  async getCommentImages(
    pageId: string,
    commentId: string
  ) {
    try {
      const { data } = await client.get(
        `/pages/${pageId}/comments/${commentId}/images`
      );

      return (data.images || []) as string[];
    } catch (error) {
      throw new Error(unwrapError(error));
    }
  },

  async getComparisonImages(pageId: string) {
    try {
      const { data } = await client.get(
        `/pages/${pageId}/comparison-images`
      );

      return data as ComparisonImages;
    } catch (error) {
      throw new Error(unwrapError(error));
    }
  },

  // ---- search ----

  async search(
    projectId: string,
    q: string,
    status: string
  ) {
    const { data } = await client.get(
      `/projects/${projectId}/search`,
      {
        params: {
          q,
          status,
        },
      }
    );

    return data as PageSummary[];
  },

  // ---- export ----

  pagePdfUrl(pageId: string) {
    return `${API_URL}/pages/${pageId}/export/pdf`;
  },

  pageExcelUrl(pageId: string) {
    return `${API_URL}/pages/${pageId}/export/excel`;
  },

  projectExcelUrl(projectId: string) {
    return `${API_URL}/projects/${projectId}/export/excel`;
  },

  async downloadFile(url: string, filename: string) {
    const token = localStorage.getItem('pl_token');

    try {
      const response = await fetch(url, {
        headers: token
          ? {
            Authorization: `Bearer ${token}`,
          }
          : {},
      });

      if (response.status === 401) {
        localStorage.removeItem('pl_token');
        localStorage.removeItem('pl_user');

        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }

        throw new Error('Your session has expired. Please log in again.');
      }

      if (!response.ok) {
        let message = 'Export failed';

        try {
          const data = await response.json();
          message = data.error || data.message || message;
        } catch {
          // Response was not JSON.
        }

        throw new Error(message);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename;

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      // Give the browser time to start the download.
      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 1000);
    } catch (error) {
      throw new Error(unwrapError(error));
    }
  },
};
