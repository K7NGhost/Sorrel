import { getDatabase } from "$lib/shared/services/database";
import { MAX_SOURCE_BYTES, type ResumeDraft } from "../types";

export function validateSource(source: string) {
  if (!source.trim()) throw new Error("Add some LaTeX before saving your resume.");
  if (new TextEncoder().encode(source).length > MAX_SOURCE_BYTES) throw new Error("Keep your LaTeX file under 1 MB.");
}

export async function listDrafts(): Promise<ResumeDraft[]> {
  const db = await getDatabase();
  return db.select<ResumeDraft[]>("SELECT id, folder_id, title, source, updated_at FROM resume_files ORDER BY updated_at DESC, id");
}

export async function loadDraft(id = "default"): Promise<ResumeDraft | null> {
  return (await listDrafts()).find((draft) => draft.id === id) ?? null;
}

export async function saveDraft(title: string, source: string, id = "default", folderId: string | null = null): Promise<ResumeDraft> {
  validateSource(source);
  const name = title.trim();
  if (!name) throw new Error("Give your resume a name.");
  const draft = { id, folder_id: folderId, title: name, source, updated_at: new Date().toISOString() };
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO resume_files (id, title, source, updated_at, folder_id) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT(id) DO UPDATE SET title = excluded.title, source = excluded.source, updated_at = excluded.updated_at, folder_id = excluded.folder_id`,
    [draft.id, draft.title, draft.source, draft.updated_at, draft.folder_id],
  );
  return draft;
}
