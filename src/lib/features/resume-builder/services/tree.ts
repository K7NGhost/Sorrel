import { getDatabase } from "$lib/shared/services/database";
import { listFolders } from "./folders";
import type { ResumeFolder, ResumeTreeItem } from "../types";

export function descendantFolderIds(id: string, folders: ResumeFolder[]): Set<string> {
  const descendants = new Set([id]);
  const pending = [id];
  while (pending.length) {
    const parentId = pending.pop();
    for (const folder of folders) {
      if (folder.parent_id === parentId && !descendants.has(folder.id)) {
        descendants.add(folder.id);
        pending.push(folder.id);
      }
    }
  }
  return descendants;
}

export async function moveTreeItem(item: ResumeTreeItem, destination: string | null): Promise<void> {
  const folders = await listFolders();
  if (destination !== null && !folders.some((folder) => folder.id === destination)) throw new Error("The destination folder could not be found.");
  const db = await getDatabase();
  if (item.kind === "folder") {
    const folder = folders.find((folder) => folder.id === item.id);
    if (!folder) throw new Error("This folder could not be found.");
    if (destination !== null && descendantFolderIds(item.id, folders).has(destination)) throw new Error("A folder cannot be moved inside itself or its subfolders.");
    if (folders.some((other) => other.id !== item.id && other.parent_id === destination && other.name.toLowerCase() === folder.name.toLowerCase())) throw new Error("A folder with this name already exists at the destination.");
    const result = await db.execute("UPDATE resume_folders SET parent_id = $1 WHERE id = $2", [destination, item.id]);
    if (!result.rowsAffected) throw new Error("This folder could not be found.");
  } else {
    const result = await db.execute("UPDATE resume_files SET folder_id = $1 WHERE id = $2", [destination, item.id]);
    if (!result.rowsAffected) throw new Error("This file could not be found.");
  }
}

export async function deleteTreeItem(item: ResumeTreeItem): Promise<void> {
  const db = await getDatabase();
  const result = await db.execute(item.kind === "folder" ? "DELETE FROM resume_folders WHERE id = $1" : "DELETE FROM resume_files WHERE id = $1", [item.id]);
  if (!result.rowsAffected) throw new Error("This item could not be found.");
}
