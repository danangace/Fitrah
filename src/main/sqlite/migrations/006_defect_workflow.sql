-- v1.2: the Defect workflow (fields from telegram-bot/rules/intake-checklist.md) and the Bug pool doc path.
INSERT OR IGNORE INTO workflows (id, name, description, fields_json, instructions, created_at, updated_at) VALUES (
  'defect',
  'Defect',
  'Investigate a defect and write one report: root cause and fix recommendation.',
  '[{"key": "defect", "label": "Defect", "type": "text", "required": true, "help": "Short kebab-case name; it becomes the folder, e.g. link-redirect-after-login"}, {"key": "environment", "label": "Environment", "type": "choice", "required": true, "options": ["dev", "staging", "production"]}, {"key": "app", "label": "App", "type": "text", "required": true, "help": "core, client, app, expert, account or be:<service>"}, {"key": "url_page", "label": "URL page", "type": "link", "required": true, "help": "The full URL opened in the browser"}, {"key": "steps", "label": "Steps to reproduce", "type": "longtext", "required": true}, {"key": "expected", "label": "Expected", "type": "longtext", "required": true}, {"key": "actual", "label": "Actual", "type": "longtext", "required": true}, {"key": "severity", "label": "Severity", "type": "choice", "required": true, "options": ["critical", "major", "minor"]}, {"key": "handling", "label": "Handling expectation", "type": "choice", "required": true, "options": ["hotfix", "next-iteration", "others"], "help": "How fast QA or the business needs it; not the same as severity"}, {"key": "iteration", "label": "Iteration", "type": "text", "required": true, "help": "e.g. i-15"}, {"key": "references", "label": "Other references", "type": "links", "required": false, "help": "Extra PRDs, designs, prototypes; one link per line"}]',
  'Investigate the defect {Defect} ({Iteration}) on {Environment}, app {App}, page {URL page}.

Steps to reproduce:
{Steps to reproduce}

Expected: {Expected}
Actual: {Actual}
Severity: {Severity}. Handling expectation: {Handling expectation}.
Other references: {Other references}

Find the root cause and write ONE report with the root cause and a fix recommendation at the Bug pool path above. Put screenshots and other files in an _assets/ folder next to it. Ask me before writing if something is unclear.',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);

-- Existing settings keep their own doc paths; add the Bug pool one unless it is already there.
UPDATE settings
SET value = json_set(value, '$.docPaths[#]', json('{"label":"Bug pool","template":"frontend/bugs/pool/{iteration}/{defect}/{defect}.md"}'))
WHERE key = 'app'
  AND json_type(value, '$.docPaths') = 'array'
  AND NOT EXISTS (SELECT 1 FROM json_each(json_extract(value, '$.docPaths')) WHERE json_extract(value, '$.label') = 'Bug pool');
