import Cookies from 'js-cookie';
import { User } from '@/types';
import apiClient from './api';

// Base da API: aceita backend Express (/api) e Netlify Functions (/.netlify/functions)
function normalizeApiBase(url?: string) {
  if (!url) return 'http://localhost:5000/api';
  let u = url.trim();
  u = u.replace(/\/+$/, '');
  if (u.includes('/.netlify/functions')) {
    return u;
  }
  if (/\/api$/i.test(u)) {
    return u.replace(/\/api$/i, '/api');
  }
  return `${u}/api`;
}

const API_URL = normalizeApiBase(process.env.NEXT_PUBLIC_API_URL);

const TOKEN_KEY = 'auth-token';
const USER_KEY = 'user-data';

export const auth = {
  // Salvar dados de autenticação
  setAuth: (token: string, user: User) => {
    Cookies.set(TOKEN_KEY, token, { expires: 7 }); // 7 dias
    Cookies.set(USER_KEY, JSON.stringify(user), { expires: 7 });
  },

  // Obter token
  getToken: (): string | null => {
    return Cookies.get(TOKEN_KEY) || null;
  },

  // Obter dados do usuário
  getUser: (): User | null => {
    const userData = Cookies.get(USER_KEY);
    if (userData) {
      try {
        return JSON.parse(userData);
      } catch {
        return null;
      }
    }
    return null;
  },

  // Verificar se está autenticado
  isAuthenticated: (): boolean => {
    return !!auth.getToken() && !!auth.getUser();
  },

  // Fazer logout
  logout: () => {
    Cookies.remove(TOKEN_KEY);
    Cookies.remove(USER_KEY);
  },

  // Verificar se tem permissão específica
  hasRole: (requiredRoles: string[]): boolean => {
    const user = auth.getUser();
    return user ? requiredRoles.includes(user.role) : false;
  },

  // Verificar se é admin
  isAdmin: (): boolean => {
    return auth.hasRole(['ADMIN']);
  },

  // Verificar se é líder ou superior
  isLeaderOrAbove: (): boolean => {
    return auth.hasRole(['LIDER', 'SUPERVISOR', 'COORDENADOR', 'PASTOR', 'ADMIN']);
  },

  // Verificar se é supervisor ou superior
  isSupervisorOrAbove: (): boolean => {
    return auth.hasRole(['SUPERVISOR', 'COORDENADOR', 'PASTOR', 'ADMIN']);
  },

  // Atualizar dados do usuário nos cookies buscando do servidor
  refreshUser: async (): Promise<User | null> => {
    try {
      const token = auth.getToken();
      if (!token) return null;

      const response = await apiClient.get('/me');
      const data = response.data;
      if (data?.user) {
        Cookies.set(USER_KEY, JSON.stringify(data.user), { expires: 7 });
        return data.user;
      }
      return null;
    } catch (error) {
      console.error('Erro ao atualizar dados do usuário:', error);
      return null;
    }
  },
};