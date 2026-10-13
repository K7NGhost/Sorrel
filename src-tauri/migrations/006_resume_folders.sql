CREATE TABLE resume_folders (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  parent_id TEXT REFERENCES resume_folders(id)
);
CREATE UNIQUE INDEX resume_folder_names ON resume_folders (COALESCE(parent_id, ''), name COLLATE NOCASE);
ALTER TABLE resume_files ADD COLUMN folder_id TEXT REFERENCES resume_folders(id);
CREATE INDEX resume_files_folder ON resume_files (folder_id);
