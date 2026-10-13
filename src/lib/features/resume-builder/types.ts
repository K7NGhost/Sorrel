export interface ResumeDraft {
  id: string;
  folder_id: string | null;
  title: string;
  source: string;
  updated_at: string;
}

export interface ResumeFolder {
  id: string;
  name: string;
  parent_id: string | null;
}

export const MAX_SOURCE_BYTES = 1024 * 1024;
