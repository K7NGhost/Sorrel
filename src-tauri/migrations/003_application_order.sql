ALTER TABLE applications ADD COLUMN sort_order REAL NOT NULL DEFAULT 0;

WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC, id DESC) - 1 AS position
    FROM applications
)
UPDATE applications
SET sort_order = (SELECT position FROM ranked WHERE ranked.id = applications.id);
