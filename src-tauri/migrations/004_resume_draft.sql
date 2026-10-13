CREATE TABLE IF NOT EXISTS resume_drafts (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    source TEXT NOT NULL CHECK (length(trim(source)) > 0),
    updated_at TEXT NOT NULL
);
