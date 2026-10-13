CREATE TABLE document_folders (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  parent_id TEXT REFERENCES document_folders(id)
);
CREATE UNIQUE INDEX document_folder_names ON document_folders (COALESCE(parent_id, ''), name COLLATE NOCASE);
ALTER TABLE documents ADD COLUMN folder_id TEXT REFERENCES document_folders(id);
CREATE INDEX documents_folder ON documents (folder_id);
