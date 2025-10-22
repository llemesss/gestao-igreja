-- Base schema mínimo para desenvolvimento local
-- Cria tabelas essenciais que o backend espera existir

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de usuários básica
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'MEMBRO',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  cell_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Tabela de registro diário de orações
CREATE TABLE IF NOT EXISTS daily_prayer_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  prayer_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_prayer_log_user ON daily_prayer_log(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_prayer_log_date ON daily_prayer_log(prayer_date);

-- Observação: a tabela cells e cell_leaders são tratadas por ensureSchema e migração 002
-- A migração 001 adiciona status em users (já incluído aqui como DEFAULT)