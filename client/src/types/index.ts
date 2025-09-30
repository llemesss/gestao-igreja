export type UserRole = 'MEMBRO' | 'LIDER' | 'SUPERVISOR' | 'COORDENADOR' | 'PASTOR' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  cell_id?: string;
  cell_name?: string;
  isCellSecretary?: boolean;
  
  // Campos de perfil completo
  full_name?: string;
  phone?: string;
  whatsapp?: string;
  gender?: string;
  birth_city?: string;
  birth_state?: string;
  birth_date?: string;
  address?: string;
  address_number?: string;
  neighborhood?: string;
  zip_code?: string;
  address_reference?: string;
  father_name?: string;
  mother_name?: string;
  marital_status?: string;
  spouse_name?: string;
  education_level?: string;
  profession?: string;
  conversion_date?: string;
  transfer_info?: string;
  has_children?: boolean;
  oikos1?: string;
  oikos2?: string;
  
  created_at: string;
  updated_at: string;
}

export interface Cell {
  id: string;
  name: string;
  supervisor_id?: string;
  supervisor_name?: string;
  member_count: number;
  leaders: User[];
  created_at: string;
  updated_at: string;
}

export interface CellMember extends User {
  is_leader: boolean;
  prayer_count: number;
  last_prayer_date?: string;
}

export interface PrayerStats {
  total_prayers: number;
  recent_prayers: number;
  week_prayers: number;
  last_prayer_date?: string;
  first_prayer_date?: string;
  prayed_today: boolean;
}

export interface AuthResponse {
  message: string;
  user: User;
  token: string;
}

export interface ApiResponse<T = unknown> {
  message?: string;
  error?: string;
  data?: T;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}