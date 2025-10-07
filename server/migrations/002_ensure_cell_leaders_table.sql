-- Migration: ensure cell_leaders exists to represent leaders assigned to cells

CREATE TABLE IF NOT EXISTS cell_leaders (
  cell_id UUID NOT NULL,
  user_id UUID NOT NULL,
  PRIMARY KEY (cell_id, user_id)
);

-- Optional FKs (comment out if schemas differ)
-- ALTER TABLE cell_leaders
--   ADD CONSTRAINT fk_cell_leaders_cell
--   FOREIGN KEY (cell_id) REFERENCES cells(id) ON DELETE CASCADE;

-- ALTER TABLE cell_leaders
--   ADD CONSTRAINT fk_cell_leaders_user
--   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_cell_leaders_cell ON cell_leaders(cell_id);
CREATE INDEX IF NOT EXISTS idx_cell_leaders_user ON cell_leaders(user_id);