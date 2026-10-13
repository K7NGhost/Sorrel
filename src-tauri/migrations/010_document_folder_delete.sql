CREATE TRIGGER delete_document_folder_contents BEFORE DELETE ON document_folders
BEGIN
  DELETE FROM documents WHERE folder_id IN (
    WITH RECURSIVE descendants(id) AS (
      SELECT OLD.id
      UNION
      SELECT folder.id FROM document_folders AS folder JOIN descendants ON folder.parent_id = descendants.id
    )
    SELECT id FROM descendants
  );
  DELETE FROM document_folders WHERE id IN (
    WITH RECURSIVE descendants(id) AS (
      SELECT id FROM document_folders WHERE parent_id = OLD.id
      UNION
      SELECT folder.id FROM document_folders AS folder JOIN descendants ON folder.parent_id = descendants.id
    )
    SELECT id FROM descendants
  );
END;
