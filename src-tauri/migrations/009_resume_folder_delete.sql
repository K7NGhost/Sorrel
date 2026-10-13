CREATE TRIGGER delete_resume_folder_contents BEFORE DELETE ON resume_folders
BEGIN
  DELETE FROM resume_files WHERE folder_id IN (
    WITH RECURSIVE descendants(id) AS (
      SELECT OLD.id
      UNION
      SELECT folder.id FROM resume_folders AS folder JOIN descendants ON folder.parent_id = descendants.id
    )
    SELECT id FROM descendants
  );
  DELETE FROM resume_folders WHERE id IN (
    WITH RECURSIVE descendants(id) AS (
      SELECT id FROM resume_folders WHERE parent_id = OLD.id
      UNION
      SELECT folder.id FROM resume_folders AS folder JOIN descendants ON folder.parent_id = descendants.id
    )
    SELECT id FROM descendants
  );
END;
