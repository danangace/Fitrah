-- Composer pickers: effort per chat + named permission modes (ask · accept-edits · full).
ALTER TABLE chats ADD COLUMN effort TEXT;
UPDATE chats SET permission_mode = 'accept-edits' WHERE permission_mode = 'default';
