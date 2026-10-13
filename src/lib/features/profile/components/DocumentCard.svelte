<script lang="ts">
  import Icon from "$lib/shared/components/Icon.svelte";
  import type { SavedDocument } from "../types";
  import type { DocumentFolder } from "../types";
  import { documentFolderPath } from "../services/folders";
  import FolderOpen from "@lucide/svelte/icons/folder-open";

  let { document, folders, disabled, onopen, onsave, onreveal, onmove }: {
    document: SavedDocument;
    folders: DocumentFolder[];
    disabled: boolean;
    onopen: (document: SavedDocument) => Promise<void>;
    onsave: (document: SavedDocument) => Promise<void>;
    onreveal: (document: SavedDocument) => Promise<void>;
    onmove: (document: SavedDocument, folderId: string | null) => Promise<void>;
  } = $props();

  let size = $derived(document.size_bytes < 1024 ? `${document.size_bytes} B`
    : document.size_bytes < 1024 * 1024 ? `${(document.size_bytes / 1024).toFixed(1)} KB`
    : `${(document.size_bytes / (1024 * 1024)).toFixed(1)} MB`);
</script>

<article class="card card-border bg-base-100">
  <div class="card-body gap-4">
    <div class="flex items-start gap-3">
      <span class="btn btn-square btn-soft pointer-events-none" aria-hidden="true"><Icon name="file" /></span>
      <div class="min-w-0 flex-1">
        <h3 class="card-title break-words">{document.name}</h3>
        <p class="mt-1 text-sm">{size} · Added {new Date(document.uploaded_at).toLocaleDateString()}</p>
      </div>
      <span class:badge-primary={document.kind === "resume"} class="badge badge-outline">{document.kind === "resume" ? "Resume" : "Document"}</span>
    </div>
    <div class="card-actions">
      <button class="btn btn-primary btn-sm" {disabled} onclick={() => onopen(document)} aria-label={`Open ${document.name}`}>Open</button>
      <button class="btn btn-outline btn-sm" {disabled} onclick={() => onsave(document)} aria-label={`Save a copy of ${document.name}`}>Save a copy</button>
      <button class="btn btn-ghost btn-sm" {disabled} onclick={() => onreveal(document)} aria-label={`Open file location for ${document.name}`}><FolderOpen size={16} aria-hidden="true" />Open file location</button>
    </div>
    <label class="select select-sm w-full"><span class="label">Folder</span><select aria-label={`Move ${document.name} to folder`} value={document.folder_id ?? ""} {disabled} onchange={(event) => onmove(document, event.currentTarget.value || null)}>
      <option value="">Documents</option>
      {#each folders as folder (folder.id)}<option value={folder.id}>{documentFolderPath(folder.id, folders)}</option>{/each}
    </select></label>
  </div>
</article>
