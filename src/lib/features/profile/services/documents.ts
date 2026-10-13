import { basename, join, normalize } from "@tauri-apps/api/path";
import { open, save } from "@tauri-apps/plugin-dialog";
import { copyFile, mkdir, remove, stat } from "@tauri-apps/plugin-fs";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { getDatabase } from "$lib/shared/services/database";
import type { DocumentKind, SavedDocument } from "../types";
import { listDocumentFolders } from "./folders";
import { libraryDirectory, storedFilename, isLegacyFilename } from "./storage";

let migration: Promise<void> | undefined;

async function documentPath(document: SavedDocument) {
  // Stored names are generated here, never accepted as arbitrary paths.
  if (!isLegacyFilename(document.stored_name) && document.stored_name !== storedFilename(document.name, document.id)) {
    throw new Error("This document has an invalid storage path.");
  }
  return join(await libraryDirectory(), document.stored_name);
}

export async function listDocuments(): Promise<SavedDocument[]> {
  const db = await getDatabase();
  const documents = await db.select<SavedDocument[]>("SELECT * FROM documents ORDER BY uploaded_at DESC, id DESC");
  const legacy = documents.filter((document) => isLegacyFilename(document.stored_name));
  if (legacy.length) {
    migration ??= migrateStoredNames(legacy).finally(() => { migration = undefined; });
    await migration;
    return db.select<SavedDocument[]>("SELECT * FROM documents ORDER BY uploaded_at DESC, id DESC");
  }
  return documents;
}

async function migrateStoredNames(documents: SavedDocument[]) {
  const db = await getDatabase();
  for (const document of documents) {
    let destination: string | undefined;
    let committed = false;
    try {
      const original = await documentPath(document);
      const storedName = storedFilename(document.name, document.id);
      destination = await join(await libraryDirectory(), storedName);
      // Keep the original copy until its new path is committed to the database.
      await copyFile(original, destination);
      const result = await db.execute("UPDATE documents SET stored_name = $1 WHERE id = $2 AND stored_name = $3", [storedName, document.id, document.stored_name]);
      if (!result.rowsAffected) throw new Error("The stored document changed during migration.");
      committed = true;
      await remove(original);
    } catch {
      if (destination && !committed) {
        try { await remove(destination); } catch { /* A failed copy may not exist. */ }
      }
      // Missing or unavailable files remain listed and can be retried on refresh.
    }
  }
}

export async function uploadDocuments(kind: DocumentKind, folderId: string | null = null) {
  await validateFolder(folderId);
  const selected = await open({
    title: kind === "resume" ? "Choose your resume" : "Choose documents",
    multiple: true,
    directory: false,
  });
  const documents: SavedDocument[] = [];
  const failures: string[] = [];
  if (!selected?.length) return { documents, failures };
  const sources = typeof selected === "string" ? [selected] : selected;

  const directory = await libraryDirectory();
  await mkdir(directory, { recursive: true });
  const db = await getDatabase();

  for (const source of sources) {
    let name = source;
    let copiedPath: string | undefined;
    try {
      name = await basename(source);
      const id = crypto.randomUUID();
      const stored_name = storedFilename(name, id);
      const destination = await join(directory, stored_name);
      const info = await stat(source);
      if (!info.isFile) throw new Error("Choose a file rather than a folder.");
      copiedPath = destination;
      await copyFile(source, destination);
      const document: SavedDocument = {
        id, folder_id: folderId, name, stored_name, kind, size_bytes: info.size, uploaded_at: new Date().toISOString(),
      };
      await db.execute(
        "INSERT INTO documents (id, name, stored_name, kind, size_bytes, uploaded_at, folder_id) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [id, name, stored_name, kind, info.size, document.uploaded_at, folderId],
      );
      documents.push(document);
    } catch {
      failures.push(name);
      if (copiedPath) {
        try { await remove(copiedPath); } catch { /* A failed copy may not have created a file. */ }
      }
    }
  }
  return { documents, failures };
}

export async function openDocument(document: SavedDocument) {
  await openPath(await documentPath(document));
}

export async function revealDocument(document: SavedDocument) {
  const path = await documentPath(document);
  const info = await stat(path);
  if (!info.isFile) throw new Error("The saved document could not be found.");
  await revealItemInDir(path);
}

async function validateFolder(folderId: string | null) {
  if (folderId !== null && !(await listDocumentFolders()).some((folder) => folder.id === folderId)) {
    throw new Error("This folder could not be found. Refresh your documents and try again.");
  }
}

export async function moveDocument(document: SavedDocument, folderId: string | null): Promise<SavedDocument> {
  await validateFolder(folderId);
  const db = await getDatabase();
  const result = await db.execute("UPDATE documents SET folder_id = $1 WHERE id = $2", [folderId, document.id]);
  if (!result.rowsAffected) throw new Error("The document could not be found.");
  return { ...document, folder_id: folderId };
}

export async function saveDocumentCopy(document: SavedDocument): Promise<boolean> {
  const destination = await save({ title: "Save a document copy", defaultPath: document.name });
  if (!destination) return false;
  const directory = (await normalize(await libraryDirectory())).replace(/[\\/]+$/, "").toLowerCase();
  const normalizedDestination = (await normalize(destination)).toLowerCase();
  if (normalizedDestination === directory || normalizedDestination.startsWith(`${directory}\\`) || normalizedDestination.startsWith(`${directory}/`)) {
    throw new Error("Choose a location outside your document library to save a copy.");
  }
  await copyFile(await documentPath(document), destination);
  return true;
}
