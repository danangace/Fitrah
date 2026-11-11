-- Latest usage limits per account, as reported by the agent during chats (no credentials read).
ALTER TABLE accounts ADD COLUMN usage_json TEXT;
ALTER TABLE accounts ADD COLUMN usage_updated_at TEXT;
