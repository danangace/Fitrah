-- v0.2: project-first + user-defined workflows (D-14…D-17).

-- Projects (table `repos`) get their own branch prefix; existing ones keep the old feature prefix.
ALTER TABLE repos ADD COLUMN branch_prefix TEXT NOT NULL DEFAULT '';
UPDATE repos SET branch_prefix = COALESCE(
  (SELECT json_extract(value, '$.branchPrefix.feature') FROM settings WHERE key = 'app'),
  'feat/tribe-2/'
);

CREATE TABLE workflows (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  description  TEXT NOT NULL DEFAULT '',
  fields_json  TEXT NOT NULL, -- JSON array of WorkflowField
  instructions TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

-- Editable starter (OQ-V3).
INSERT INTO workflows (id, name, description, fields_json, instructions, created_at, updated_at) VALUES (
  'planning',
  'Planning',
  'Turn a PRD + Figma into an implementation plan.',
  '[{"key":"prd","label":"PRD","type":"link","required":true},{"key":"figma","label":"Figma","type":"link","required":true},{"key":"iteration","label":"Iteration","type":"text","required":true,"help":"e.g. i-16"},{"key":"module","label":"Module","type":"text","required":true},{"key":"target_docs","label":"Target docs","type":"docsFolder","required":false,"help":"Vault folder where the plan is written"},{"key":"base","label":"Base branch","type":"branch","required":false,"help":"Empty = the project base"}]',
  'Write the implementation plan for {Module} ({Iteration}) from the PRD ({PRD}) and the Figma design ({Figma}) into {Target docs}, following the implementation-plan workflow. Ask me before writing if something is unclear.',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);

-- Workspaces: an optional workflow + the values the user filled in.
-- `kind`, `iteration`, `module`, `prd_url`, `figma_url` stay as unused legacy columns.
ALTER TABLE workspaces ADD COLUMN workflow_id TEXT REFERENCES workflows (id);
ALTER TABLE workspaces ADD COLUMN values_json TEXT NOT NULL DEFAULT '{}';

-- Keep the task info of existing workspaces: they become Planning workspaces.
UPDATE workspaces
SET workflow_id = 'planning',
    values_json = json_object(
      'prd', COALESCE(prd_url, ''),
      'figma', COALESCE(figma_url, ''),
      'iteration', COALESCE(iteration, ''),
      'module', COALESCE(module, ''),
      'target_docs', '',
      'base', base
    )
WHERE prd_url IS NOT NULL OR figma_url IS NOT NULL OR iteration IS NOT NULL OR module IS NOT NULL;
