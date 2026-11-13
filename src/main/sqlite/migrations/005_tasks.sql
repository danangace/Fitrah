-- Task board: our own tickets (manual, or copied from an outside system by a later step).
-- "Ready" is never stored; it is computed from the ticket and its workflow (shared/readiness.ts).
CREATE TABLE tasks (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  kind          TEXT NOT NULL DEFAULT 'task' CHECK (kind IN ('task', 'defect')),
  board_column  TEXT NOT NULL DEFAULT 'backlog' CHECK (board_column IN ('backlog', 'in_progress', 'review', 'done')),
  position      INTEGER NOT NULL DEFAULT 0,
  priority      TEXT NOT NULL DEFAULT '',
  repo_id       TEXT REFERENCES repos (id) ON DELETE SET NULL,
  workflow_id   TEXT REFERENCES workflows (id) ON DELETE SET NULL,
  values_json   TEXT NOT NULL DEFAULT '{}',
  source        TEXT NOT NULL DEFAULT 'manual',
  external_id   TEXT,
  external_url  TEXT,
  workspace_id  TEXT REFERENCES workspaces (id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- An outside ticket can be copied to the board only once.
CREATE UNIQUE INDEX tasks_external ON tasks (source, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX tasks_workspace ON tasks (workspace_id);
