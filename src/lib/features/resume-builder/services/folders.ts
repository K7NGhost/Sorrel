import { getDatabase } from "$lib/shared/services/database";
import type { ResumeFolder } from "../types";

export async function listFolders(): Promise<ResumeFolder[]> {
  const db = await getDatabase();
  return db.select<ResumeFolder[]>("SELECT id, name, parent_id FROM resume_folders ORDER BY name COLLATE NOCASE, id");
}

export async function createFolder(name: string, parentId: string | null): Promise<ResumeFolder> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 200 || /[\\/]/.test(trimmed)) throw new Error("Enter a folder name of 1–200 characters without slashes.");
  const folders = await listFolders();
  if (parentId !== null && !folders.some((folder) => folder.id === parentId)) throw new Error("The parent folder could not be found.");
  if (folders.some((folder) => folder.parent_id === parentId && folder.name.toLowerCase() === trimmed.toLowerCase())) throw new Error("A folder with this name already exists here.");
  const folder = { id: crypto.randomUUID(), name: trimmed, parent_id: parentId };
  const db = await getDatabase();
  await db.execute("INSERT INTO resume_folders (id, name, parent_id) VALUES ($1, $2, $3)", [folder.id, folder.name, folder.parent_id]);
  return folder;
}

export function folderPath(id: string | null, folders: ResumeFolder[]): string {
  const names: string[] = [];
  const visited = new Set<string>();
  while (id !== null && !visited.has(id)) {
    visited.add(id);
    const folder = folders.find((entry) => entry.id === id);
    if (!folder) break;
    names.unshift(folder.name);
    id = folder.parent_id;
  }
  return ["Resumes", ...names].join(" / ");
}
