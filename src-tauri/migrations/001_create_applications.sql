CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY NOT NULL,
    company TEXT NOT NULL CHECK (length(trim(company)) > 0),
    role TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'applied'
        CHECK (status IN ('applied', 'rejected', 'accepted')),
    applied_on TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
