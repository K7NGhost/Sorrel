<script lang="ts">
  import { untrack } from "svelte";
  import FileCode from "@lucide/svelte/icons/file-code";
  import Folder from "@lucide/svelte/icons/folder";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import type { ResumeDraft, ResumeFolder } from "../types";

  let { files, folders, activeFileId, activeTitle, selectedFolderId, disabled, onopenfile, onselectfolder }: {
    files: ResumeDraft[];
    folders: ResumeFolder[];
    activeFileId: string;
    activeTitle: string;
    selectedFolderId: string | null;
    disabled: boolean;
    onopenfile: (file: ResumeDraft) => void;
    onselectfolder: (id: string | null) => void;
  } = $props();
  let expanded = $state<Record<string, boolean>>({});

  $effect(() => {
    let id = selectedFolderId;
    const ancestors: Record<string, boolean> = {};
    while (id !== null && !ancestors[id]) {
      ancestors[id] = true;
      id = folders.find((folder) => folder.id === id)?.parent_id ?? null;
    }
    untrack(() => { expanded = { ...expanded, ...ancestors }; });
  });
</script>

{#snippet branch(parentId: string | null)}
  {#each folders.filter((folder) => folder.parent_id === parentId).toSorted((a, b) => a.name.localeCompare(b.name)) as folder (folder.id)}
    <li>
      <div class="flex gap-0 p-0">
        <button class="btn btn-xs btn-square btn-ghost shrink-0" aria-label={`${expanded[folder.id] ? "Collapse" : "Expand"} ${folder.name}`} aria-expanded={!!expanded[folder.id]} {disabled} onclick={() => expanded[folder.id] = !expanded[folder.id]}>
          {#if expanded[folder.id]}<ChevronDown size={14} aria-hidden="true" />{:else}<ChevronRight size={14} aria-hidden="true" />{/if}
        </button>
        <button class="flex min-w-0 flex-1 items-center gap-2 rounded-field p-2 text-left" class:bg-base-300={selectedFolderId === folder.id} aria-label={`Folder ${folder.name}`} aria-pressed={selectedFolderId === folder.id} title={folder.name} {disabled} onclick={() => onselectfolder(folder.id)}>
          {#if expanded[folder.id]}<FolderOpen size={16} class="shrink-0" aria-hidden="true" />{:else}<Folder size={16} class="shrink-0" aria-hidden="true" />{/if}
          <span class="truncate">{folder.name}</span>
        </button>
      </div>
      {#if expanded[folder.id]}<ul>{@render branch(folder.id)}</ul>{/if}
    </li>
  {/each}
  {#each files.filter((file) => file.folder_id === parentId).toSorted((a, b) => a.title.localeCompare(b.title)) as file (file.id)}
    <li><button class:menu-active={file.id === activeFileId} aria-current={file.id === activeFileId ? "page" : undefined} {disabled} onclick={() => onopenfile(file)} title={`${file.id === activeFileId ? activeTitle : file.title}.tex`}>
      <FileCode size={16} class="shrink-0" aria-hidden="true" /><span class="min-w-0 truncate">{file.id === activeFileId ? activeTitle : file.title}.tex</span>
    </button></li>
  {/each}
{/snippet}

<nav class="min-h-0 flex-1 overflow-auto" aria-label="Resume files">
  <ul class="menu menu-sm w-full">
    <li><button aria-label="Folder Resumes" aria-pressed={selectedFolderId === null} {disabled} onclick={() => onselectfolder(null)}><FolderOpen size={16} class="shrink-0" aria-hidden="true" /><span class="font-semibold">Resumes</span></button></li>
    {@render branch(null)}
  </ul>
</nav>
