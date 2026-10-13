import { MAX_SOURCE_BYTES } from "../types";

const key = "sorrel-resume-recovery";

export interface RecoveryDraft {
  title: string;
  source: string;
  baseUpdatedAt: string | null;
}

export function readRecovery(baseUpdatedAt: string | null, id = "default"): RecoveryDraft | null {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(id === "default" ? key : `${key}:${id}`) ?? "null");
    if (!data || typeof data !== "object") return null;
    const draft = data as Partial<RecoveryDraft>;
    if (draft.baseUpdatedAt !== baseUpdatedAt || typeof draft.title !== "string" || typeof draft.source !== "string"
      || !draft.source.trim() || new TextEncoder().encode(draft.source).length > MAX_SOURCE_BYTES) return null;
    return draft as RecoveryDraft;
  } catch { return null; }
}

export function updateRecovery(draft: RecoveryDraft | null, id = "default"): boolean {
  try {
    const storageKey = id === "default" ? key : `${key}:${id}`;
    if (draft) localStorage.setItem(storageKey, JSON.stringify(draft));
    else localStorage.removeItem(storageKey);
    return true;
  } catch { return false; }
}
