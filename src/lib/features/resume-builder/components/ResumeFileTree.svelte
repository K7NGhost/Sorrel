<script lang="ts">
  import { untrack } from "svelte";
  import FileCode from "@lucide/svelte/icons/file-code";
  import Folder from "@lucide/svelte/icons/folder";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import type { ResumeDraft, ResumeFolder, ResumeTreeItem } from "../types";

  import { descendantFolderIds } from "../services/tree";

  let { files, folders, activeFileId, activeTitle, selectedFolderId, disabled, onopenfile, onselectfolder, oncontext, onmove }: {
    files: ResumeDraft[];
    folders: ResumeFolder[];
    activeFileId: string;
    activeTitle: string;
    selectedFolderId: string | null;
    disabled: boolean;
    onopenfile: (file: ResumeDraft) => void;
    onselectfolder: (id: string | null) => void;
    oncontext: (item: ResumeTreeItem, event: MouseEvent | KeyboardEvent) => void;
    onmove: (item: ResumeTreeItem, destination: string | null) => void;
  } = $props();
  let dragged = $state<ResumeTreeItem | null>(null);
  let hoverFolder = $state<string | null | undefined>(undefined);

  function dragStart(item: ResumeTreeItem, event: DragEvent) {
    if (disabled || !event.dataTransfer) { event.preventDefault(); return; }
    dragged = item;
    event.dataTransfer.setData("application/x-sorrel-resume-item", JSON.stringify(item));
    event.dataTransfer.effectAllowed = "move";
  }
  function canDrop(id: string | null) {
    return !!dragged && !disabled && (dragged.kind !== "folder" || id === null || !descendantFolderIds(dragged.id, folders).has(id));
  }
  function dragOver(id: string | null, event: DragEvent) {
    if (!canDrop(id)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    hoverFolder = id;
  }
  function drop(id: string | null, event: DragEvent) {
    event.preventDefault();
    if (dragged && canDrop(id)) { if (id !== null) expanded[id] = true; onmove(dragged, id); }
    dragged = null;
    hoverFolder = undefined;
  }
  function context(item: ResumeTreeItem, event: MouseEvent | KeyboardEvent) { event.preventDefault(); if (!disabled) oncontext(item, event); }
  function keys(item: ResumeTreeItem, event: KeyboardEvent) {
    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) context(item, event);
  }

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
        <button class="flex min-w-0 flex-1 items-center gap-2 rounded-field p-2 text-left" class:bg-base-300={selectedFolderId === folder.id} aria-label={`Folder ${folder.name}`} aria-pressed={selectedFolderId === folder.id} title={folder.name} {disabled} draggable={!disabled} class:drop-target={hoverFolder === folder.id}
          ondragstart={(event) => dragStart({ kind: "folder", id: folder.id }, event)} ondragend={() => { dragged = null; hoverFolder = undefined; }}
          ondragover={(event) => dragOver(folder.id, event)} ondragleave={() => hoverFolder = undefined} ondrop={(event) => drop(folder.id, event)}
          oncontextmenu={(event) => context({ kind: "folder", id: folder.id }, event)} onkeydown={(event) => keys({ kind: "folder", id: folder.id }, event)} onclick={() => onselectfolder(folder.id)}>
          {#if expanded[folder.id]}<FolderOpen size={16} class="shrink-0" aria-hidden="true" />{:else}<Folder size={16} class="shrink-0" aria-hidden="true" />{/if}
          <span class="truncate">{folder.name}</span>
        </button>
      </div>
      {#if expanded[folder.id]}<ul>{@render branch(folder.id)}</ul>{/if}
    </li>
  {/each}
  {#each files.filter((file) => file.folder_id === parentId).toSorted((a, b) => a.title.localeCompare(b.title)) as file (file.id)}
    <li><button class:menu-active={file.id === activeFileId} aria-current={file.id === activeFileId ? "page" : undefined} {disabled} onclick={() => onopenfile(file)} title={`${file.id === activeFileId ? activeTitle : file.title}.tex`} draggable={!disabled}
      ondragstart={(event) => dragStart({ kind: "file", id: file.id }, event)} ondragend={() => { dragged = null; hoverFolder = undefined; }}
      oncontextmenu={(event) => context({ kind: "file", id: file.id }, event)} onkeydown={(event) => keys({ kind: "file", id: file.id }, event)}>
      <FileCode size={16} class="shrink-0" aria-hidden="true" /><span class="min-w-0 truncate">{file.id === activeFileId ? activeTitle : file.title}.tex</span>
    </button></li>
  {/each}
{/snippet}

<nav class="min-h-0 flex-1 overflow-auto" aria-label="Resume files">
  <ul class="menu menu-sm w-full">
    <li><button class:drop-target={hoverFolder === null} ondragover={(event) => dragOver(null, event)} ondragleave={() => hoverFolder = undefined} ondrop={(event) => drop(null, event)} aria-label="Folder Resumes" aria-pressed={selectedFolderId === null} {disabled} onclick={() => onselectfolder(null)}><FolderOpen size={16} class="shrink-0" aria-hidden="true" /><span class="font-semibold">Resumes</span></button></li>
    {@render branch(null)}
  </ul>
</nav>

<style>
  .drop-target { outline: 2px solid var(--color-primary); outline-offset: -2px; background: color-mix(in oklch, var(--color-primary) 15%, var(--color-base-200)); }
</style>
