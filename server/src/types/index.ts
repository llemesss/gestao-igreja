import { Request } from 'express';

export type UserRole = 'MEMBRO' | 'LIDER' | 'SUPERVISOR' | 'COORDENADOR' | 'PASTOR' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  cell_id?: string;
  
  // Campos de perfil completo
  full_name?: string;
  phone?: string;
  whatsapp?: string;
  gender?: string;
  birth_city?: string;
  birth_state?: string;
  birth_date?: Date;
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
  conversion_date?: Date;
  transfer_info?: string;
  has_children?: boolean;
  oikos1?: string;
  oikos2?: string;
  
  created_at: Date;
  updated_at: Date;
}

export interface Cell {
  id: string;
  name: string;
  supervisor_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CellLeader {
  cell_id: string;
  user_id: string;
  created_at: Date;
}

export interface PrayerLog {
  id: string;
  user_id: string;
  log_date: Date;
  created_at: Date;
}

export interface JWTPayload {
  userId: string;
  role: UserRole;
}

export interface AuthRequest extends Request {
  user?: JWTPayload;
}