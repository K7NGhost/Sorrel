import { appDataDir, join } from "@tauri-apps/api/path";

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export function storedFilename(name: string, id: string): string {
  if (!uuid.test(id)) throw new Error("This document has an invalid storage path.");
  const cleaned = name.normalize("NFC").replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, "_").replace(/[. ]+$/, "").trim();
  const extension = /\.([a-z0-9]{1,20})$/i.exec(cleaned)?.[0] ?? "";
  let stem = Array.from(extension ? cleaned.slice(0, -extension.length) : cleaned).slice(0, 100).join("").replace(/[. ]+$/, "") || "Document";
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem)) stem = `Document-${stem}`;
  return `${stem}--${id}${extension}`;
}

export function isLegacyFilename(name: string): boolean {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(\.[a-z0-9]{1,20})?$/i.test(name);
}

export async function libraryDirectory(): Promise<string> {
  return join(await appDataDir(), "documents");
}
