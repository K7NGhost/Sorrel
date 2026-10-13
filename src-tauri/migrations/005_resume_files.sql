CREATE TABLE resume_files (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  source TEXT NOT NULL CHECK (length(trim(source)) > 0),
  updated_at TEXT NOT NULL
);

INSERT INTO resume_files (id, title, source, updated_at)
SELECT 'default', title, source, updated_at FROM resume_drafts;
DROP TABLE resume_drafts;
