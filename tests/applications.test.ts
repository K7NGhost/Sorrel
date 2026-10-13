/// <reference types="bun" />

import { afterAll, expect, mock, test } from "bun:test";
import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { copyFile, mkdir, readFile, rename, rm, rmdir, stat, writeFile } from "node:fs/promises";
import { basename, join, normalize } from "node:path";

const path = join(import.meta.dir, `applications-${crypto.randomUUID()}.db`);
let sqlite = new Database(path);
sqlite.exec(readFileSync(join(import.meta.dir, "../src-tauri/migrations/001_create_applications.sql"), "utf8"));
sqlite.exec(readFileSync(join(import.meta.dir, "../src-tauri/migrations/002_create_documents.sql"), "utf8"));
sqlite.exec(readFileSync(join(import.meta.dir, "../src-tauri/migrations/003_application_order.sql"), "utf8"));
sqlite.exec(readFileSync(join(import.meta.dir, "../src-tauri/migrations/004_resume_draft.sql"), "utf8"));
sqlite.exec(readFileSync(join(import.meta.dir, "../src-tauri/migrations/005_resume_files.sql"), "utf8"));
sqlite.exec(readFileSync(join(import.meta.dir, "../src-tauri/migrations/006_resume_folders.sql"), "utf8"));
sqlite.exec(readFileSync(join(import.meta.dir, "../src-tauri/migrations/007_document_folders.sql"), "utf8"));
sqlite.exec(readFileSync(join(import.meta.dir, "../src-tauri/migrations/008_job_description.sql"), "utf8"));
sqlite.exec(readFileSync(join(import.meta.dir, "../src-tauri/migrations/009_resume_folder_delete.sql"), "utf8"));
sqlite.exec(readFileSync(join(import.meta.dir, "../src-tauri/migrations/010_document_folder_delete.sql"), "utf8"));
const fixtureDirectory = mkdtempSync(join(import.meta.dir, "documents-"));
const appData = join(fixtureDirectory, "app-data");
let selectedFiles: string | string[] | null = null;
let saveDestination: string | null = null;
let openedPath = "";
let revealedPath = "";
let rejectDocumentInsert = false;
let rejectDocumentNameUpdate = false;
let rejectDocumentDelete = false;

// Exercise the production queries against SQLite; only the native transport is replaced.
mock.module("$lib/shared/services/database", () => ({
  getDatabase: async () => ({
    select: async (sql: string) => sqlite.query(sql).all(),
    execute: async (sql: string, values: (string | number | null)[]) => {
      if (rejectDocumentInsert && sql.startsWith("INSERT INTO documents")) throw new Error("Simulated write failure");
      if (rejectDocumentNameUpdate && sql.startsWith("UPDATE documents SET stored_name")) throw new Error("Simulated name update failure");
      if (rejectDocumentDelete && (sql.startsWith("DELETE FROM documents") || sql.startsWith("DELETE FROM document_folders"))) throw new Error("Simulated document deletion failure");
      const result = sqlite.query(sql).run(...values);
      return { rowsAffected: result.changes, lastInsertId: result.lastInsertRowid };
    },
  }),
}));

mock.module("@tauri-apps/api/path", () => ({
  appDataDir: async () => appData,
  basename: async (path: string) => basename(path),
  join: async (...paths: string[]) => join(...paths),
  normalize: async (path: string) => normalize(path),
}));
mock.module("@tauri-apps/plugin-dialog", () => ({
  open: async () => selectedFiles,
  save: async () => saveDestination,
}));
mock.module("@tauri-apps/plugin-fs", () => ({
  copyFile,
  mkdir,
  remove: async (path: string) => (await stat(path)).isDirectory() ? rmdir(path) : rm(path),
  rename,
  exists: async (path: string) => existsSync(path),
  readTextFile: (path: string) => readFile(path, "utf8"),
  writeTextFile: (path: string, contents: string) => writeFile(path, contents, "utf8"),
  writeFile: (path: string, contents: Uint8Array) => writeFile(path, contents),
  stat: async (path: string) => {
    const info = await stat(path);
    return { size: info.size, isFile: info.isFile() };
  },
}));
mock.module("@tauri-apps/plugin-opener", () => ({
  openPath: async (path: string) => { openedPath = path; },
  revealItemInDir: async (path: string) => { revealedPath = path; },
}));

const { createApplication, listApplications, moveApplication, updateApplicationDetails } = await import("../src/lib/features/applications/services/applications");
const { listDocuments, openDocument, saveDocumentCopy, uploadDocuments, revealDocument, moveDocument } = await import("../src/lib/features/profile/services/documents");
const { createDocumentFolder, listDocumentFolders } = await import("../src/lib/features/profile/services/folders");
const { moveDocumentTreeItem, deleteDocumentTreeItem } = await import("../src/lib/features/profile/services/tree");
const { summarizeApplications } = await import("../src/lib/features/stats/services/stats");
const { planPlacement } = await import("../src/lib/features/applications/state/placement");
const { loadDraft, saveDraft, listDrafts } = await import("../src/lib/features/resume-builder/services/drafts");
const { createFolder, listFolders } = await import("../src/lib/features/resume-builder/services/folders");
const { moveTreeItem, deleteTreeItem } = await import("../src/lib/features/resume-builder/services/tree");
const { exportTex, importTex, saveToProfile, exportPdf, savePdfToProfile } = await import("../src/lib/features/resume-builder/services/files");

afterAll(() => {
  sqlite.close();
  unlinkSync(path);
  rmSync(fixtureDirectory, { recursive: true, force: true });
});

test("resume copies survive removing originals and filenames cannot collide", async () => {
  const firstDirectory = join(fixtureDirectory, "first");
  const secondDirectory = join(fixtureDirectory, "second");
  mkdirSync(firstDirectory);
  mkdirSync(secondDirectory);
  const firstSource = join(firstDirectory, "resume.pdf");
  const secondSource = join(secondDirectory, "resume.pdf");
  writeFileSync(firstSource, "first resume content");
  writeFileSync(secondSource, "second resume content");
  selectedFiles = [firstSource, secondSource];
  const uploaded = await uploadDocuments("resume");
  expect(uploaded.failures).toEqual([]);
  expect(uploaded.documents).toHaveLength(2);
  expect(uploaded.documents[0].stored_name).not.toBe(uploaded.documents[1].stored_name);
  expect(uploaded.documents.every((document) => document.stored_name.startsWith("resume--") && document.stored_name.endsWith(".pdf"))).toBe(true);
  expect(readFileSync(firstSource, "utf8")).toBe("first resume content");
  unlinkSync(firstSource);
  unlinkSync(secondSource);
  sqlite.close();
  sqlite = new Database(path);
  expect(await listDocuments()).toHaveLength(2);
  const document = uploaded.documents[0];
  await openDocument(document);
  expect(readFileSync(openedPath, "utf8")).toBe("first resume content");
  await revealDocument(document);
  expect(revealedPath).toBe(openedPath);
  expect(revealedPath.startsWith(join(appData, "documents"))).toBe(true);
  saveDestination = join(fixtureDirectory, "downloaded-resume.pdf");
  expect(await saveDocumentCopy(document)).toBe(true);
  expect(readFileSync(saveDestination, "utf8")).toBe("first resume content");
  saveDestination = openedPath;
  await expect(saveDocumentCopy(document)).rejects.toThrow("outside");
  saveDestination = null;
  expect(await saveDocumentCopy(document)).toBe(false);
});

test("canceled uploads, partial batches, and database failures preserve the library", async () => {
  selectedFiles = null;
  expect(await uploadDocuments("document")).toEqual({ documents: [], failures: [] });
  const source = join(fixtureDirectory, "cover-letter.txt");
  writeFileSync(source, "A cover letter");
  selectedFiles = [source, join(fixtureDirectory, "missing.txt")];
  const result = await uploadDocuments("document");
  expect(result.documents).toHaveLength(1);
  expect(result.failures).toEqual(["missing.txt"]);
  const storedBefore = readdirSync(join(appData, "documents")).sort();
  const documentsBefore = await listDocuments();
  rejectDocumentInsert = true;
  selectedFiles = [source];
  try {
    const failed = await uploadDocuments("document");
    expect(failed.documents).toHaveLength(0);
    expect(failed.failures).toEqual(["cover-letter.txt"]);
    expect(readdirSync(join(appData, "documents")).sort()).toEqual(storedBefore);
    expect(await listDocuments()).toEqual(documentsBefore);
    expect(readFileSync(source, "utf8")).toBe("A cover letter");
  } finally {
    rejectDocumentInsert = false;
  }
});

test("Profile folders and copies persist, and file location reveals the AppData copy", async () => {
  const parent = await createDocumentFolder("Career", null);
  const folder = await createDocumentFolder("Resumes", parent.id);
  await expect(createDocumentFolder(" career ", null)).rejects.toThrow("already exists");
  await expect(createDocumentFolder("Bad/name", null)).rejects.toThrow("slashes");
  const source = join(fixtureDirectory, "folder-resume.pdf");
  writeFileSync(source, "Folder resume copy");
  selectedFiles = source;
  const result = await uploadDocuments("resume", folder.id);
  expect(result.documents).toHaveLength(1);
  const document = result.documents[0];
  expect(document.folder_id).toBe(folder.id);
  unlinkSync(source);
  sqlite.close();
  sqlite = new Database(path);
  expect((await listDocumentFolders()).find((item) => item.id === folder.id)?.parent_id).toBe(parent.id);
  expect((await listDocuments()).find((item) => item.id === document.id)?.folder_id).toBe(folder.id);
  await revealDocument(document);
  expect(readFileSync(revealedPath, "utf8")).toBe("Folder resume copy");
  expect(revealedPath).toBe(join(appData, "documents", document.stored_name));
  const moved = await moveDocument(document, null);
  expect(moved.folder_id).toBeNull();
  await openDocument(moved);
  expect(openedPath).toBe(revealedPath);
  await expect(moveDocument(document, "missing")).rejects.toThrow("folder");
  await expect(revealDocument({ ...document, stored_name: "../outside.pdf" })).rejects.toThrow("storage path");
});

test("Profile folder migration preserves existing documents in the root", () => {
  const legacy = new Database(":memory:");
  try {
    legacy.exec(readFileSync(join(import.meta.dir, "../src-tauri/migrations/002_create_documents.sql"), "utf8"));
    legacy.query("INSERT INTO documents VALUES (?, ?, ?, ?, ?, ?)").run("existing", "Resume.pdf", "saved.pdf", "resume", 12, "2026-10-12");
    legacy.exec(readFileSync(join(import.meta.dir, "../src-tauri/migrations/007_document_folders.sql"), "utf8"));
    expect(legacy.query("SELECT name, stored_name, folder_id FROM documents").get()).toEqual({ name: "Resume.pdf", stored_name: "saved.pdf", folder_id: null });
  } finally { legacy.close(); }
});

test("existing UUID copies get readable filenames without losing files on migration failure", async () => {
  const id = crypto.randomUUID();
  const oldName = `${id}.pdf`;
  const readableName = `Jordan CV--${id}.pdf`;
  const directory = join(appData, "documents");
  writeFileSync(join(directory, oldName), "Existing resume bytes");
  sqlite.query("INSERT INTO documents (id, name, stored_name, kind, size_bytes, uploaded_at) VALUES (?, ?, ?, ?, ?, ?)").run(id, "Jordan CV.pdf", oldName, "resume", 21, "2026-10-12");
  rejectDocumentNameUpdate = true;
  try {
    expect((await listDocuments()).find((document) => document.id === id)?.stored_name).toBe(oldName);
    expect(readFileSync(join(directory, oldName), "utf8")).toBe("Existing resume bytes");
    expect(readdirSync(directory)).not.toContain(readableName);
  } finally { rejectDocumentNameUpdate = false; }
  const document = (await listDocuments()).find((document) => document.id === id)!;
  expect(document.stored_name).toBe(readableName);
  expect(readdirSync(directory)).not.toContain(oldName);
  await revealDocument(document);
  expect(revealedPath).toBe(join(directory, readableName));
  expect(readFileSync(revealedPath, "utf8")).toBe("Existing resume bytes");
  sqlite.close();
  sqlite = new Database(path);
  expect((await listDocuments()).find((item) => item.id === id)?.stored_name).toBe(readableName);
});

test("stored filenames retain recognizable names and extensions while rejecting path separators", async () => {
  const { storedFilename } = await import("../src/lib/features/profile/services/storage");
  const id = crypto.randomUUID();
  expect(storedFilename("Engineering CV.pdf", id)).toBe(`Engineering CV--${id}.pdf`);
  expect(storedFilename("CON.pdf", id)).toBe(`Document-CON--${id}.pdf`);
  expect(storedFilename("../../Career:resume?.pdf", id)).not.toMatch(/[\\/:?]/);
  expect(() => storedFilename("Resume.pdf", "../outside")).toThrow("storage path");
});

test("stats handle no decisions and month boundaries across a year", () => {
  const now = new Date(2026, 0, 15);
  const empty = summarizeApplications([], now);
  expect(empty.acceptanceRate).toBeNull();
  expect(empty.months.map((month) => month.key)).toEqual(["2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01"]);
  const stats = summarizeApplications([
    { company: "Acme", status: "accepted", applied_on: "2025-12-31" },
    { company: " acme ", status: "rejected", applied_on: "2026-01-01" },
    { company: "Other", status: "applied", applied_on: "2025-08-01" },
    { company: "Earlier", status: "applied", applied_on: "2025-07-31" },
  ], now);
  expect(stats.total).toBe(4);
  expect(stats.companies).toBe(3);
  expect(stats.counts).toEqual({ applied: 2, accepted: 1, rejected: 1 });
  expect(stats.acceptanceRate).toBe(50);
  expect(stats.months.map((month) => month.count)).toEqual([1, 0, 0, 0, 1, 1]);
});

test("applications start in Applied, move between all columns, and survive reopening", async () => {
  const company = "O'Reilly'; DROP TABLE applications; --";
  const first = await createApplication({ company, role: " Engineer ", notes: "Follow up next week", applied_on: "2026-10-12" });
  const second = await createApplication({ company, role: "Designer", notes: "", applied_on: "2026-10-12" });
  expect(first.status).toBe("applied");
  expect(first.role).toBe("Engineer");
  expect(first.id).not.toBe(second.id);
  expect((await listApplications()).length).toBe(2);

  await moveApplication(first.id, "rejected");
  expect((await listApplications()).find((item) => item.id === first.id)?.status).toBe("rejected");
  await moveApplication(first.id, "accepted");
  sqlite.close();
  sqlite = new Database(path);
  const saved = (await listApplications()).find((item) => item.id === first.id);
  expect(saved?.company).toBe(company);
  expect(saved?.status).toBe("accepted");
  expect(saved?.notes).toBe("Follow up next week");
  await moveApplication(first.id, "applied");
  expect((await listApplications()).find((item) => item.id === first.id)?.status).toBe("applied");
});

test("invalid input and missing applications fail without changing saved records", async () => {
  const before = await listApplications();
  await expect(createApplication({ company: "  ", role: "", notes: "", applied_on: "2026-10-12" })).rejects.toThrow("company");
  await expect(createApplication({ company: "Acme", role: "", notes: "", applied_on: "invalid" })).rejects.toThrow("date");
  await expect(createApplication({ company: "Acme", role: "", notes: "", applied_on: "2026-02-30" })).rejects.toThrow("date");
  await expect(moveApplication("missing", "accepted")).rejects.toThrow("not be found");
  expect(() => sqlite.query("UPDATE applications SET status = 'unknown'").run()).toThrow();
  expect(await listApplications()).toEqual(before);
});

test("drag placement preserves filtered-out cards and does not mutate the snapshot", () => {
  const card = (id: string, status: "applied" | "rejected", sort_order: number) => ({
    id, company: id, role: "", notes: "", job_description: "", status, sort_order,
    applied_on: "2026-10-12", created_at: "2026-10-12T12:00:00Z", updated_at: "2026-10-12T12:00:00Z",
  });
  const original = [card("moved", "applied", 0), card("hidden-a", "rejected", 0), card("visible-b", "rejected", 1), card("hidden-c", "rejected", 2), card("visible-d", "rejected", 3)];
  const placement = planPlacement(original, "moved", "rejected", ["visible-d", "moved", "visible-b"]);
  expect(placement.orderedIds).toEqual(["hidden-a", "visible-d", "moved", "hidden-c", "visible-b"]);
  expect(new Set(placement.applications.map((item) => item.id)).size).toBe(original.length);
  expect(original.find((item) => item.id === "moved")?.status).toBe("applied");
  expect(() => planPlacement(original, "moved", "rejected", ["unknown", "moved"])).toThrow("invalid");
});

test("column changes and reordered positions persist together, with atomic failure", async () => {
  const first = await createApplication({ company: "First", role: "", notes: "", applied_on: "2026-10-12" });
  const second = await createApplication({ company: "Second", role: "", notes: "", applied_on: "2026-10-12" });
  const moved = await createApplication({ company: "Moved", role: "", notes: "", applied_on: "2026-10-12" });
  await moveApplication(first.id, "accepted");
  await moveApplication(second.id, "accepted");
  await moveApplication(moved.id, "accepted", [second.id, moved.id, first.id]);
  sqlite.close();
  sqlite = new Database(path);
  expect((await listApplications()).filter((item) => item.status === "accepted").map((item) => item.id)).toEqual([second.id, moved.id, first.id]);
  await moveApplication(first.id, "accepted", [first.id, second.id, moved.id]);
  expect((await listApplications()).filter((item) => item.status === "accepted").map((item) => item.id)).toEqual([first.id, second.id, moved.id]);
  const before = await listApplications();
  await expect(moveApplication(moved.id, "rejected", [moved.id, "missing"])).rejects.toThrow("board changed");
  await expect(moveApplication(moved.id, "rejected", [moved.id, first.id])).rejects.toThrow("board changed");
  await expect(moveApplication(moved.id, "accepted", [moved.id, moved.id])).rejects.toThrow("invalid");
  expect(await listApplications()).toEqual(before);
});

test("order migration preserves existing applications and their previous display order", () => {
  const legacy = new Database(":memory:");
  try {
    legacy.exec(readFileSync(join(import.meta.dir, "../src-tauri/migrations/001_create_applications.sql"), "utf8"));
    const insert = legacy.query("INSERT INTO applications (id, company, status, applied_on, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)");
    insert.run("older", "Old company", "rejected", "2026-01-01", "2026-01-01T12:00:00Z", "2026-01-01T12:00:00Z");
    insert.run("newer", "New company", "accepted", "2026-02-01", "2026-02-01T12:00:00Z", "2026-02-01T12:00:00Z");
    legacy.exec(readFileSync(join(import.meta.dir, "../src-tauri/migrations/003_application_order.sql"), "utf8"));
    expect(legacy.query("SELECT id, status FROM applications ORDER BY sort_order").all()).toEqual([{ id: "newer", status: "accepted" }, { id: "older", status: "rejected" }]);
  } finally { legacy.close(); }
});

test("LaTeX drafts preserve exact source, update one draft, and survive reopening", async () => {
  expect(await loadDraft()).toBeNull();
  const source = String.raw`\documentclass{article}\begin{document}O'Reilly & 30\%\end{document}`;
  await saveDraft("  My resume  ", source);
  sqlite.close();
  sqlite = new Database(path);
  expect((await loadDraft())?.source).toBe(source);
  expect((await loadDraft())?.title).toBe("My resume");
  await saveDraft("Updated resume", `${source}\n% Updated`);
  expect(sqlite.query("SELECT COUNT(*) AS count FROM resume_files").get()).toEqual({ count: 1 });
  const saved = await loadDraft();
  await expect(saveDraft(" ", source)).rejects.toThrow("name");
  await expect(saveDraft("Resume", " ")).rejects.toThrow("LaTeX");
  await expect(saveDraft("Resume", "a".repeat(1024 * 1024 + 1))).rejects.toThrow("1 MB");
  expect(await loadDraft()).toEqual(saved);
  await saveDraft("Second resume", `${source}\n% Separate file`, "second");
  expect(await listDrafts()).toHaveLength(2);
  expect((await loadDraft("second"))?.source).toContain("Separate file");
  expect(await loadDraft()).toEqual(saved);
});

test("multi-file migration preserves an existing resume draft", () => {
  const legacy = new Database(":memory:");
  try {
    legacy.exec(readFileSync(join(import.meta.dir, "../src-tauri/migrations/004_resume_draft.sql"), "utf8"));
    legacy.query("INSERT INTO resume_drafts VALUES (1, ?, ?, ?)").run("Existing resume", "Original source", "2026-10-12");
    legacy.exec(readFileSync(join(import.meta.dir, "../src-tauri/migrations/005_resume_files.sql"), "utf8"));
    expect(legacy.query("SELECT * FROM resume_files").get()).toEqual({ id: "default", title: "Existing resume", source: "Original source", updated_at: "2026-10-12" });
    legacy.exec(readFileSync(join(import.meta.dir, "../src-tauri/migrations/006_resume_folders.sql"), "utf8"));
    expect(legacy.query("SELECT folder_id, source FROM resume_files").get()).toEqual({ folder_id: null, source: "Original source" });
  } finally { legacy.close(); }
});

test("folders persist hierarchy and file placement without changing source", async () => {
  const root = await createFolder("Applications", null);
  const child = await createFolder("Engineering", root.id);
  await expect(createFolder(" applications ", null)).rejects.toThrow("already exists");
  await expect(createFolder("Bad/name", null)).rejects.toThrow("slashes");
  await expect(createFolder("Missing parent", "missing")).rejects.toThrow("parent");
  const original = await loadDraft();
  await saveDraft(original!.title, original!.source, original!.id, child.id);
  sqlite.close();
  sqlite = new Database(path);
  expect((await listFolders()).find((folder) => folder.id === child.id)?.parent_id).toBe(root.id);
  expect((await loadDraft())?.folder_id).toBe(child.id);
  expect((await loadDraft())?.source).toBe(original!.source);
  await saveDraft(original!.title, original!.source, original!.id, null);
  expect((await loadDraft())?.folder_id).toBeNull();
});

test("LaTeX import/export and Profile copies retain source and clean up failed writes", async () => {
  const source = "\\begin{document}Resume café\\end{document}";
  const importedPath = join(fixtureDirectory, "my-resume.tex");
  writeFileSync(importedPath, source);
  selectedFiles = importedPath;
  expect(await importTex()).toEqual({ title: "my-resume", source });
  selectedFiles = null;
  expect(await importTex()).toBeNull();
  saveDestination = null;
  expect(await exportTex("Resume", source)).toBe(false);
  saveDestination = join(fixtureDirectory, "export.tex");
  expect(await exportTex("Resume", source)).toBe(true);
  expect(readFileSync(saveDestination, "utf8")).toBe(source);
  await saveToProfile("My LaTeX resume", source);
  const document = (await listDocuments()).find((item) => item.name === "My LaTeX resume.tex")!;
  expect(document.stored_name).toStartWith("My LaTeX resume--");
  expect(document.kind).toBe("resume");
  expect(document.size_bytes).toBe(new TextEncoder().encode(source).length);
  expect(readFileSync(join(appData, "documents", document.stored_name), "utf8")).toBe(source);
  const stored = readdirSync(join(appData, "documents")).sort();
  rejectDocumentInsert = true;
  try {
    await expect(saveToProfile("Failed resume", source)).rejects.toThrow("write failure");
    expect(readdirSync(join(appData, "documents")).sort()).toEqual(stored);
  } finally { rejectDocumentInsert = false; }
});

test("compiled PDF exports and Profile copies keep the exact PDF bytes", async () => {
  const pdf = new TextEncoder().encode("%PDF-1.7\ncompiled resume bytes\n%%EOF");
  saveDestination = null;
  expect(await exportPdf("PDF resume", pdf)).toBe(false);
  saveDestination = join(fixtureDirectory, "resume-export.pdf");
  expect(await exportPdf("PDF resume", pdf)).toBe(true);
  expect(new Uint8Array(readFileSync(saveDestination))).toEqual(pdf);
  await savePdfToProfile("PDF resume", pdf);
  const document = (await listDocuments()).find((item) => item.name === "PDF resume.pdf")!;
  expect(document.stored_name).toStartWith("PDF resume--");
  expect(document.kind).toBe("resume");
  expect(document.size_bytes).toBe(pdf.byteLength);
  expect(new Uint8Array(readFileSync(join(appData, "documents", document.stored_name)))).toEqual(pdf);
  const stored = readdirSync(join(appData, "documents")).sort();
  rejectDocumentInsert = true;
  try {
    await expect(savePdfToProfile("Failed PDF", pdf)).rejects.toThrow("write failure");
    expect(readdirSync(join(appData, "documents")).sort()).toEqual(stored);
  } finally { rejectDocumentInsert = false; }
});


test("job descriptions preserve pasted text, update details only, and survive reopening", async () => {
  const description = "Build Svelte apps.\nRequirements: SQL & TypeScript.\nPay: $100,000";
  const application = await createApplication({ company: "Description Company", role: "Engineer", notes: "First notes", applied_on: "2026-10-12", job_description: description });
  expect(application.job_description).toBe(description);
  await moveApplication(application.id, "accepted");
  const details = await updateApplicationDetails(application.id, " Updated notes ", `${description}\nRemote available.`);
  sqlite.close();
  sqlite = new Database(path);
  const saved = (await listApplications()).find((item) => item.id === application.id)!;
  expect(saved.job_description).toBe(`${description}\nRemote available.`);
  expect(saved.notes).toBe("Updated notes");
  expect(saved.status).toBe("accepted");
  expect(saved.company).toBe(application.company);
  expect(saved.applied_on).toBe(application.applied_on);
  expect(saved.updated_at).toBe(details.updated_at);
  await expect(updateApplicationDetails("missing", "", "Description")).rejects.toThrow("could not be found");
  await expect(updateApplicationDetails(application.id, "", "x".repeat(50001))).rejects.toThrow("50,000");
  expect((await listApplications()).find((item) => item.id === application.id)?.job_description).toBe(saved.job_description);
});

test("job description migration preserves existing application details", () => {
  const legacy = new Database(":memory:");
  try {
    legacy.exec(readFileSync(join(import.meta.dir, "../src-tauri/migrations/001_create_applications.sql"), "utf8"));
    legacy.query("INSERT INTO applications (id, company, notes, applied_on, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run("existing", "Existing company", "Existing notes", "2026-10-12", "2026-10-12", "2026-10-12");
    legacy.exec(readFileSync(join(import.meta.dir, "../src-tauri/migrations/008_job_description.sql"), "utf8"));
    expect(legacy.query("SELECT company, notes, job_description FROM applications").get()).toEqual({ company: "Existing company", notes: "Existing notes", job_description: "" });
  } finally { legacy.close(); }
});


test("resume tree moves reject cycles and folder deletion is atomic", async () => {
  sqlite.exec("PRAGMA foreign_keys = ON");
  const parent = await createFolder("Tree source", null);
  const destination = await createFolder("Tree destination", null);
  const child = await createFolder("Child", parent.id);
  const nested = await createFolder("Nested", child.id);
  const file = await saveDraft("Tree resume", "Original source", crypto.randomUUID(), nested.id);
  const outside = await saveDraft("Outside resume", "Unrelated source", crypto.randomUUID(), null);
  await moveTreeItem({ kind: "folder", id: child.id }, destination.id);
  expect((await listFolders()).find((folder) => folder.id === child.id)?.parent_id).toBe(destination.id);
  await expect(moveTreeItem({ kind: "folder", id: destination.id }, nested.id)).rejects.toThrow("subfolders");
  const duplicate = await createFolder("Child", parent.id);
  await expect(moveTreeItem({ kind: "folder", id: duplicate.id }, destination.id)).rejects.toThrow("already exists");
  await moveTreeItem({ kind: "file", id: outside.id }, child.id);
  expect((await loadDraft(outside.id))?.folder_id).toBe(child.id);
  await moveTreeItem({ kind: "file", id: outside.id }, null);
  sqlite.exec("CREATE TEMP TRIGGER fail_tree_delete BEFORE DELETE ON resume_files BEGIN SELECT RAISE(ABORT, 'Simulated delete failure'); END");
  try { await expect(deleteTreeItem({ kind: "folder", id: destination.id })).rejects.toThrow("Simulated delete failure"); }
  finally { sqlite.exec("DROP TRIGGER fail_tree_delete"); }
  expect((await loadDraft(file.id))?.source).toBe("Original source");
  expect((await listFolders()).some((folder) => folder.id === nested.id)).toBe(true);
  await deleteTreeItem({ kind: "folder", id: destination.id });
  expect(await loadDraft(file.id)).toBeNull();
  expect((await listFolders()).some((folder) => [destination.id, child.id, nested.id].includes(folder.id))).toBe(false);
  expect((await loadDraft(outside.id))?.source).toBe("Unrelated source");
  await deleteTreeItem({ kind: "file", id: outside.id });
  expect(await loadDraft(outside.id)).toBeNull();
});


test("Profile tree moves preserve stored copies and failed deletes restore them", async () => {
  const parent = await createDocumentFolder("Profile tree source", null);
  const destination = await createDocumentFolder("Profile tree destination", null);
  const child = await createDocumentFolder("Tree child", parent.id);
  const nested = await createDocumentFolder("Nested", child.id);
  const source = join(fixtureDirectory, "profile-tree.pdf");
  writeFileSync(source, "Original document bytes");
  selectedFiles = [source];
  const document = (await uploadDocuments("document", nested.id)).documents[0];
  const copy = join(appData, "documents", document.stored_name);
  await moveDocumentTreeItem({ kind: "folder", id: child.id }, destination.id);
  expect((await listDocumentFolders()).find((folder) => folder.id === child.id)?.parent_id).toBe(destination.id);
  await expect(moveDocumentTreeItem({ kind: "folder", id: destination.id }, nested.id)).rejects.toThrow("subfolders");
  await moveDocumentTreeItem({ kind: "file", id: document.id }, child.id);
  expect((await listDocuments()).find((file) => file.id === document.id)?.folder_id).toBe(child.id);
  expect(readFileSync(copy, "utf8")).toBe("Original document bytes");
  rejectDocumentDelete = true;
  try { await expect(deleteDocumentTreeItem({ kind: "folder", id: destination.id })).rejects.toThrow("Simulated document deletion failure"); }
  finally { rejectDocumentDelete = false; }
  expect(readFileSync(copy, "utf8")).toBe("Original document bytes");
  expect((await listDocuments()).some((file) => file.id === document.id)).toBe(true);
  expect((await listDocumentFolders()).some((folder) => folder.id === nested.id)).toBe(true);
  expect((await deleteDocumentTreeItem({ kind: "folder", id: destination.id })).cleanupFailed).toBe(false);
  expect((await listDocuments()).some((file) => file.id === document.id)).toBe(false);
  expect((await listDocumentFolders()).some((folder) => [destination.id, child.id, nested.id].includes(folder.id))).toBe(false);
  expect(existsSync(copy)).toBe(false);
  expect(readFileSync(source, "utf8")).toBe("Original document bytes");
});
