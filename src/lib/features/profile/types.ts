export type DocumentKind = "resume" | "document";

export interface SavedDocument {
  id: string;
  folder_id: string | null;
  name: string;
  stored_name: string;
  kind: DocumentKind;
  size_bytes: number;
  uploaded_at: string;
}

export interface DocumentFolder {
  id: string;
  name: string;
  parent_id: string | null;
}
