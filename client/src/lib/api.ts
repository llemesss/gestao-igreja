import axios from 'axios';
import { toast } from '@/components/ui/toast';
import Cookies from 'js-cookie';
import { AuthResponse, LoginCredentials, RegisterData } from '@/types';
import { auth } from './auth';

// Base da API: aceita backend Express (/api) e Netlify Functions (/.netlify/functions)
function normalizeApiBase(url?: string) {
  const DEFAULT_DEV = 'http://localhost:5000/api';
  const DEFAULT_PROD = 'https://gestao-igreja-beckend.onrender.com/api';
  const isBrowser = typeof window !== 'undefined';
  const isProdEnv = isBrowser ? window.location.hostname.endsWith('onrender.com') : (process.env.NODE_ENV === 'production');

  // Fallback padrão
  if (!url) return isProdEnv ? DEFAULT_PROD : DEFAULT_DEV;

  let u = url.trim().replace(/\/+$/, '');

  // Netlify Functions: manter como está
  if (u.includes('/.netlify/functions')) {
    return u;
  }

  // Tentar parsear como URL para tratar path incorreto (ex.: "/dashboard")
  try {
    const parsed = new URL(u);

    // Se apontar para o frontend com caminho "/dashboard", corrigir para origem + /api
    if (parsed.pathname && /\/dashboard/i.test(parsed.pathname)) {
      return `${parsed.origin}/api`;
    }

    // Se estiver apontando para o host do frontend, usar fallback do backend em produção
    if (/gestao-igreja-frontend\.onrender\.com$/i.test(parsed.hostname)) {
      return DEFAULT_PROD;
    }

    // Garantir sufixo /api
    if (/\/api$/i.test(parsed.pathname)) {
      return `${parsed.origin}${parsed.pathname}`;
    }
    return `${parsed.origin}/api`;
  } catch {
    // String simples: garantir sufixo /api
    if (/\/api$/i.test(u)) return u;
    return `${u}/api`;
  }
}

const API_URL = normalizeApiBase(process.env.NEXT_PUBLIC_API_URL);

// Criar instância do axios
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token automaticamente
apiClient.interceptors.request.use((config) => {
  const token = Cookies.get('auth-token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para tratar erros de autenticação
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expirado ou inválido
      Cookies.remove('auth-token');
      Cookies.remove('user-data');
      window.location.href = '/login';
    }
    // Exibir toast amigável para outros erros
    const message = error.response?.data?.error || error.response?.data?.message || 'Ocorreu um erro ao comunicar com a API.';
    toast.error(message);
    return Promise.reject(error);
  }
);

// Funções de autenticação
const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/login', credentials);
    return response.data;
  },

  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/register', data);
    return response.data;
  },
};

// Funções para usuários
const usersApi = {
  getAll: async (filters?: { role?: string; cell_id?: string; search?: string }) => {
    const response = await apiClient.get('/users', { params: filters });
    const data = response.data;
    // Normalizar para sempre retornar um array
    return Array.isArray(data?.users) ? data.users : (Array.isArray(data) ? data : []);
  },

  getById: async (id: string) => {
    const response = await apiClient.get(`/users/${id}`);
    return response.data;
  },

  update: async (id: string, data: Partial<{ name: string; email: string; role: string; cell_id: string; cell_ids: string[] }>) => {
    const response = await apiClient.put(`/users/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`/users/${id}`);
    return response.data;
  },

  assignToCell: async (userId: string, data: { cell_id: string; role_in_cell?: string } | string) => {
    const payload = typeof data === 'string' ? { cell_id: data } : data;
    const response = await apiClient.put(`/users/${userId}`, payload);
    return response.data;
  },

  removeFromCell: async (userId: string) => {
    const response = await apiClient.put(`/users/${userId}`, { cell_id: null });
    return response.data;
  },

  getCellAssignments: async (userId: string) => {
    const response = await apiClient.get(`/users/${userId}/cell-assignments`);
    return response.data;
  },
};

// Funções para células
const cellsApi = {
  getCells: async () => {
    const response = await apiClient.get('/cells');
    return response.data;
  },

  getMyCells: async () => {
    const response = await apiClient.get('/users/my-cells');
    return response.data;
  },

  getAll: async () => {
    const response = await apiClient.get('/cells');
    return response.data;
  },

  getDetail: async (cellId: string) => {
    const response = await apiClient.get(`/cells/${cellId}`);
    return response.data;
  },

  update: async (cellId: string, data: Partial<{ name: string; supervisor_id: string | null }>) => {
    const response = await apiClient.put(`/cells/${cellId}`, data);
    return response.data;
  },

  create: async (name: string) => {
    const response = await apiClient.post('/cells', { name });
    return response.data;
  },

  delete: async (cellId: string) => {
    const response = await apiClient.delete(`/cells/${cellId}`);
    return response.data;
  },

  addMember: async (cellId: string, data: { user_id: string; role_in_cell?: string } | string) => {
    const payload = typeof data === 'string' ? { user_id: data } : data;
    const response = await apiClient.post(`/cells/${cellId}/members`, payload);
    return response.data;
  },
  
  assignLeader: async (cellId: string, userId: string) => {
    const response = await apiClient.post(`/cells/${cellId}/leaders`, { user_id: userId });
    return response.data;
  },

  removeLeader: async (cellId: string, userId: string) => {
    const response = await apiClient.delete(`/cells/${cellId}/leaders/${userId}`);
    return response.data;
  },

  assignSupervisor: async (cellId: string, supervisorId: string | null) => {
    const response = await apiClient.put(`/cells/${cellId}/supervisor`, { supervisor_id: supervisorId });
    return response.data;
  },

  list: async () => {
    const response = await apiClient.get('/cells/list');
    return response.data;
  },

  getMyCellMembers: async () => {
    const response = await apiClient.get('/cells/my-cell/members');
    return response.data;
  },

  getMembers: async (cellId: string) => {
    const response = await apiClient.get(`/cells/${cellId}/members`);
    return response.data;
  },

  removeMember: async (cellId: string, userId: string) => {
    const response = await apiClient.delete(`/cells/${cellId}/members/${userId}`);
    return response.data;
  },
};

// Funções para orações
const prayersApi = {
  register: async () => {
    const response = await apiClient.post('/prayers/register');
    return response.data;
  },

  getStats: async () => {
    const response = await apiClient.get('/prayers/stats');
    return response.data;
  },

  getMyStats: async (days?: number) => {
    const response = await apiClient.get('/prayers/my-stats', { params: { days } });
    return response.data;
  },

  getUserStats: async (userId: string, days?: number) => {
    const response = await apiClient.get(`/prayers/stats/${userId}`, { params: { days } });
    return response.data;
  },

  registerPrayer: async () => {
    const response = await apiClient.post('/prayers/register');
    return response.data;
  }
};

// Funções para perfil do usuário
const profileApi = {
  getProfile: async () => {
    const response = await apiClient.get('/me');
    return response.data;
  },

  updateProfile: async (data: { name?: string; email?: string; phone?: string; address?: string }) => {
    const response = await apiClient.put('/me', data);
    return response.data;
  },
};

// Exportar a instância do Axios diretamente como api
export const api = apiClient;

// Objeto API unificado com métodos organizados
export const apiMethods = {
  auth: authApi,
  users: usersApi,
  cells: cellsApi,
  prayers: prayersApi,
  profile: profileApi,
};

export { authApi, usersApi, cellsApi, prayersApi, profileApi };

export default apiClient;