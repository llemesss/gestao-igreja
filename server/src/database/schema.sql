-- Schema SQLite para Sistema de Gestão de Igreja

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('MEMBRO', 'LIDER', 'SUPERVISOR', 'COORDENADOR', 'PASTOR', 'ADMIN')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  cell_id TEXT,
  
  -- Campos de perfil completo
  full_name TEXT,
  phone TEXT,
  whatsapp TEXT,
  gender TEXT CHECK (gender IN ('MALE', 'FEMALE')),
  birth_city TEXT,
  birth_state TEXT,
  birth_date DATE,
  age_group TEXT,
  address TEXT,
  address_number TEXT,
  neighborhood TEXT,
  zip_code TEXT,
  address_reference TEXT,
  father_name TEXT,
  mother_name TEXT,
  marital_status TEXT CHECK (marital_status IN ('SINGLE', 'MARRIED', 'OTHER')),
  spouse_name TEXT,
  education_level TEXT CHECK (education_level IN ('BASIC', 'FUNDAMENTAL', 'HIGH_SCHOOL', 'UNIVERSITY', 'OTHER')),
  education_course TEXT,
  profession TEXT,
  conversion_date DATE,
  previous_church TEXT,
  transfer_info TEXT,
  has_children BOOLEAN DEFAULT 0,
  oikos1 TEXT,
  oikos2 TEXT,
  
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (cell_id) REFERENCES cells(id)
);

-- Tabela de células
CREATE TABLE IF NOT EXISTS cells (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  supervisor_id TEXT,
  secretary_id TEXT,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (supervisor_id) REFERENCES users(id),
  FOREIGN KEY (secretary_id) REFERENCES users(id)
);

-- Tabela de líderes de células
CREATE TABLE IF NOT EXISTS cell_leaders (
  cell_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at DATETIME DEFAULT (datetime('now')),
  PRIMARY KEY (cell_id, user_id),
  FOREIGN KEY (cell_id) REFERENCES cells(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de logs de oração
CREATE TABLE IF NOT EXISTS prayer_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  log_date DATE NOT NULL,
  created_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, log_date)
);

-- Tabela de logs de oração diária (nova tabela simplificada)
CREATE TABLE IF NOT EXISTS daily_prayer_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  prayer_date DATE NOT NULL,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, prayer_date)
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_cell_id ON users(cell_id);
CREATE INDEX IF NOT EXISTS idx_prayer_logs_user_id ON prayer_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_prayer_logs_date ON prayer_logs(log_date);
CREATE INDEX IF NOT EXISTS idx_cell_leaders_user_id ON cell_leaders(user_id);

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER IF NOT EXISTS update_users_updated_at 
  AFTER UPDATE ON users
  FOR EACH ROW
  BEGIN
    UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_cells_updated_at 
  AFTER UPDATE ON cells
  FOR EACH ROW
  BEGIN
    UPDATE cells SET updated_at = datetime('now') WHERE id = NEW.id;
  END;