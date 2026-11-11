-- Fitrah V1 schema. Fitrah keeps run state only; the docs root (vault) stays the source of truth.
-- Agent columns allow 'codex' from day one (Codex-ready seam, Design §7.3).

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL -- JSON
);

CREATE TABLE repos (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  path           TEXT NOT NULL UNIQUE,
  setup_script   TEXT NOT NULL DEFAULT '',
  archive_script TEXT NOT NULL DEFAULT '',
  feature_base   TEXT NOT NULL,
  shared_dirs    TEXT NOT NULL DEFAULT '[]', -- JSON array
  created_at     TEXT NOT NULL
);

-- Folder paths only. Fitrah never stores tokens or credentials.
CREATE TABLE accounts (
  id               TEXT PRIMARY KEY,
  agent            TEXT NOT NULL CHECK (agent IN ('claude', 'codex')),
  label            TEXT NOT NULL,
  kind             TEXT NOT NULL CHECK (kind IN ('attached', 'managed')),
  config_dir       TEXT NOT NULL UNIQUE,
  email            TEXT,
  login_expires_at TEXT,
  login_status     TEXT NOT NULL DEFAULT 'unknown',
  warning          TEXT,
  is_default       INTEGER NOT NULL DEFAULT 0,
  last_checked_at  TEXT,
  created_at       TEXT NOT NULL
);

CREATE TABLE workspaces (
  id            TEXT PRIMARY KEY,
  repo_id       TEXT NOT NULL REFERENCES repos (id),
  kind          TEXT NOT NULL CHECK (kind IN ('feature', 'defect')),
  name          TEXT NOT NULL,
  iteration     TEXT,
  module        TEXT,
  prd_url       TEXT,
  figma_url     TEXT,
  branch        TEXT NOT NULL,
  base          TEXT NOT NULL,
  worktree_path TEXT NOT NULL UNIQUE,
  stage         TEXT NOT NULL DEFAULT 'intake',
  setup_status  TEXT NOT NULL DEFAULT 'pending',
  created_at    TEXT NOT NULL,
  archived_at   TEXT
);

CREATE TABLE chats (
  id              TEXT PRIMARY KEY,
  workspace_id    TEXT NOT NULL REFERENCES workspaces (id),
  agent           TEXT NOT NULL CHECK (agent IN ('claude', 'codex')),
  account_id      TEXT REFERENCES accounts (id),
  model           TEXT NOT NULL,
  session_id      TEXT,
  permission_mode TEXT NOT NULL DEFAULT 'default',
  status          TEXT NOT NULL DEFAULT 'idle',
  title           TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  last_active_at  TEXT
);

CREATE TABLE approvals (
  id           TEXT PRIMARY KEY,
  chat_id      TEXT NOT NULL REFERENCES chats (id),
  tool         TEXT NOT NULL,
  input_json   TEXT NOT NULL,
  decision     TEXT CHECK (decision IN ('allow', 'deny')),
  requested_at TEXT NOT NULL,
  decided_at   TEXT
);

CREATE INDEX chats_workspace ON chats (workspace_id);
CREATE INDEX workspaces_repo ON workspaces (repo_id);
