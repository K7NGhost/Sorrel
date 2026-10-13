import { appDataDir, basename, join } from "@tauri-apps/api/path";
import { open, save } from "@tauri-apps/plugin-dialog";
import { mkdir, readTextFile, remove, stat, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { getDatabase } from "$lib/shared/services/database";
import { MAX_SOURCE_BYTES } from "../types";
import { validateSource } from "./drafts";
import { storedFilename } from "$lib/features/profile/services/storage";

function filename(title: string) {
  const name = title.replace(/[^a-zA-Z0-9 _-]/g, "").trim().slice(0, 80) || "resume";
  return `${/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name) ? `resume-${name}` : name}.tex`;
}

export async function exportPdf(title: string, pdf: Uint8Array) {
  const path = await save({ title: "Export resume PDF", defaultPath: filename(title).replace(/\.tex$/, ".pdf"), filters: [{ name: "PDF document", extensions: ["pdf"] }] });
  if (!path) return false;
  await writeFile(path, pdf);
  return true;
}

export async function savePdfToProfile(title: string, pdf: Uint8Array) {
  const db = await getDatabase();
  const directory = await join(await appDataDir(), "documents");
  await mkdir(directory, { recursive: true });
  const id = crypto.randomUUID();
  const storedName = storedFilename(filename(title).replace(/\.tex$/, ".pdf"), id);
  const destination = await join(directory, storedName);
  try {
    await writeFile(destination, pdf);
    await db.execute(
      "INSERT INTO documents (id, name, stored_name, kind, size_bytes, uploaded_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [id, filename(title).replace(/\.tex$/, ".pdf"), storedName, "resume", pdf.byteLength, new Date().toISOString()],
    );
  } catch (error) {
    try { await remove(destination); } catch { /* The failed write may not have created a file. */ }
    throw error;
  }
}

export async function importTex() {
  const path = await open({ title: "Import a LaTeX resume", multiple: false, directory: false, filters: [{ name: "LaTeX source", extensions: ["tex", "latex"] }] });
  if (!path) return null;
  const info = await stat(path);
  if (info.size > MAX_SOURCE_BYTES) throw new Error("Choose a LaTeX file under 1 MB.");
  const source = await readTextFile(path);
  validateSource(source);
  return { title: (await basename(path)).replace(/\.(tex|latex)$/i, ""), source };
}

export async function exportTex(title: string, source: string) {
  validateSource(source);
  const path = await save({ title: "Export LaTeX source", defaultPath: filename(title), filters: [{ name: "LaTeX source", extensions: ["tex"] }] });
  if (!path) return false;
  await writeTextFile(path, source);
  return true;
}

export async function saveToProfile(title: string, source: string) {
  validateSource(source);
  const db = await getDatabase();
  const directory = await join(await appDataDir(), "documents");
  await mkdir(directory, { recursive: true });
  const id = crypto.randomUUID();
  const storedName = storedFilename(filename(title), id);
  const destination = await join(directory, storedName);
  try {
    await writeTextFile(destination, source);
    await db.execute(
      "INSERT INTO documents (id, name, stored_name, kind, size_bytes, uploaded_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [id, filename(title), storedName, "resume", new TextEncoder().encode(source).length, new Date().toISOString()],
    );
  } catch (error) {
    try { await remove(destination); } catch { /* The failed write may not have created a file. */ }
    throw error;
  }
}
