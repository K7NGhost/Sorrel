import { validateSource } from "./drafts";
import { invoke } from "@tauri-apps/api/core";

export interface CompiledResume {
  pdf: Uint8Array;
  diagnostics: string;
}

export async function compileResume(source: string): Promise<CompiledResume> {
  validateSource(source);
  const result = await invoke<{ pdf: number[]; diagnostics: string }>("compile_resume", { source });
  const pdf = new Uint8Array(result.pdf);
  if (new TextDecoder().decode(pdf.slice(0, 5)) !== "%PDF-") throw new Error("Tectonic did not return a valid PDF.");
  return { pdf, diagnostics: result.diagnostics };
}
