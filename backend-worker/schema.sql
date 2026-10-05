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

CREATE TABLE IF NOT EXISTS drive_users (
  google_sub TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  refresh_token_enc TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS drive_oauth_states (
  state_hash TEXT PRIMARY KEY,
  return_url TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS drive_login_tickets (
  ticket_hash TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS drive_sessions (
  session_hash TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_used_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_drive_sessions_sub ON drive_sessions(google_sub);
CREATE INDEX IF NOT EXISTS idx_drive_oauth_states_exp ON drive_oauth_states(expires_at);
CREATE INDEX IF NOT EXISTS idx_drive_tickets_exp ON drive_login_tickets(expires_at);
