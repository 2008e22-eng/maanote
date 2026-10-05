CREATE TABLE IF NOT EXISTS admins (
  email TEXT PRIMARY KEY,
  google_sub TEXT,
  role TEXT NOT NULL CHECK(role IN ('owner','admin')),
  status TEXT NOT NULL CHECK(status IN ('active','disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  added_by TEXT
);

CREATE TABLE IF NOT EXISTS common_data (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  target_email TEXT,
  detail TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at);
