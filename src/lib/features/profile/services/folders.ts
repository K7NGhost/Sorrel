import { getDatabase } from "$lib/shared/services/database";
import type { DocumentFolder } from "../types";

export async function listDocumentFolders(): Promise<DocumentFolder[]> {
  const db = await getDatabase();
  return db.select<DocumentFolder[]>("SELECT id, name, parent_id FROM document_folders ORDER BY name COLLATE NOCASE, id");
}

export async function createDocumentFolder(name: string, parentId: string | null): Promise<DocumentFolder> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 200 || /[\\/]/.test(trimmed)) throw new Error("Enter a folder name of 1–200 characters without slashes.");
  const folders = await listDocumentFolders();
  if (parentId !== null && !folders.some((folder) => folder.id === parentId)) throw new Error("The parent folder could not be found.");
  if (folders.some((folder) => folder.parent_id === parentId && folder.name.toLowerCase() === trimmed.toLowerCase())) throw new Error("A folder with this name already exists here.");
  const folder = { id: crypto.randomUUID(), name: trimmed, parent_id: parentId };
  const db = await getDatabase();
  await db.execute("INSERT INTO document_folders (id, name, parent_id) VALUES ($1, $2, $3)", [folder.id, folder.name, folder.parent_id]);
  return folder;
}

export function documentFolderPath(id: string | null, folders: DocumentFolder[]): string {
  const names: string[] = [];
  const visited = new Set<string>();
  while (id !== null && !visited.has(id)) {
    visited.add(id);
    const folder = folders.find((entry) => entry.id === id);
    if (!folder) break;
    names.unshift(folder.name);
    id = folder.parent_id;
  }
  return ["Documents", ...names].join(" / ");
}
