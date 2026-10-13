import { join } from "@tauri-apps/api/path";
import { exists, mkdir, remove, rename } from "@tauri-apps/plugin-fs";
import { getDatabase } from "$lib/shared/services/database";
import { descendantFolderIds, type TreeItem } from "$lib/shared/services/tree";
import { listDocumentFolders } from "./folders";
import { documentPath, listDocuments, moveDocument } from "./documents";
import { libraryDirectory } from "./storage";

export async function moveDocumentTreeItem(item: TreeItem, destination: string | null): Promise<void> {
  const folders = await listDocumentFolders();
  if (destination !== null && !folders.some((folder) => folder.id === destination)) throw new Error("The destination folder could not be found.");
  if (item.kind === "file") {
    const document = (await listDocuments()).find((document) => document.id === item.id);
    if (!document) throw new Error("This document could not be found.");
    await moveDocument(document, destination);
    return;
  }
  const folder = folders.find((folder) => folder.id === item.id);
  if (!folder) throw new Error("This folder could not be found.");
  if (destination !== null && descendantFolderIds(item.id, folders).has(destination)) throw new Error("A folder cannot be moved inside itself or its subfolders.");
  if (folders.some((other) => other.id !== item.id && other.parent_id === destination && other.name.toLowerCase() === folder.name.toLowerCase())) throw new Error("A folder with this name already exists at the destination.");
  const db = await getDatabase();
  const result = await db.execute("UPDATE document_folders SET parent_id = $1 WHERE id = $2", [destination, item.id]);
  if (!result.rowsAffected) throw new Error("This folder could not be found.");
}

export async function deleteDocumentTreeItem(item: TreeItem): Promise<{ cleanupFailed: boolean }> {
  const [documents, folders] = await Promise.all([listDocuments(), listDocumentFolders()]);
  if (item.kind === "folder" ? !folders.some((folder) => folder.id === item.id) : !documents.some((document) => document.id === item.id)) throw new Error("This item could not be found.");
  const descendants = item.kind === "folder" ? descendantFolderIds(item.id, folders) : new Set<string>();
  const deleted = documents.filter((document) => item.kind === "file" ? document.id === item.id : document.folder_id !== null && descendants.has(document.folder_id));
  const staging = await join(await libraryDirectory(), ".trash", crypto.randomUUID());
  const staged: { original: string; temporary: string }[] = [];
  try {
    if (deleted.length) await mkdir(staging, { recursive: true });
    for (const document of deleted) {
      const original = await documentPath(document);
      if (!await exists(original)) continue;
      const temporary = await join(staging, document.stored_name);
      await rename(original, temporary);
      staged.push({ original, temporary });
    }
    const db = await getDatabase();
    const result = await db.execute(item.kind === "folder" ? "DELETE FROM document_folders WHERE id = $1" : "DELETE FROM documents WHERE id = $1", [item.id]);
    if (!result.rowsAffected) throw new Error("This item could not be found.");
  } catch (cause) {
    let restoreFailed = false;
    for (const file of staged.reverse()) {
      try { await rename(file.temporary, file.original); } catch { restoreFailed = true; }
    }
    try { if (deleted.length) await remove(staging); } catch { /* Keep any copies that could not be restored. */ }
    if (restoreFailed) throw new Error(`Could not finish deleting. Some saved copies are still in ${staging}.`);
    throw cause;
  }
  let cleanupFailed = false;
  for (const file of staged) {
    try { await remove(file.temporary); } catch { cleanupFailed = true; }
  }
  try { if (deleted.length) await remove(staging); } catch { cleanupFailed = true; }
  return { cleanupFailed };
}
