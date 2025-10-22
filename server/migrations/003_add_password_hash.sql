-- Adiciona coluna de hash de senha para autenticação
ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_hash TEXT;