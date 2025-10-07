-- Migration: add status column to users
-- Purpose: Several queries filter by status = 'ACTIVE'. Ensure column exists.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);