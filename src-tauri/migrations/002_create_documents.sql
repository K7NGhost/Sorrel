CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    stored_name TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL CHECK (kind IN ('resume', 'document')),
    size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
    uploaded_at TEXT NOT NULL
);
