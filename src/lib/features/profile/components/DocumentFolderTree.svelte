<script lang="ts">
  import { untrack } from "svelte";
  import Folder from "@lucide/svelte/icons/folder";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import type { DocumentFolder } from "../types";

  let { folders, selectedId, disabled, onselect }: {
    folders: DocumentFolder[];
    selectedId: string | null;
    disabled: boolean;
    onselect: (id: string | null) => void;
  } = $props();
  let expanded = $state<Record<string, boolean>>({});
  $effect(() => {
    let id = selectedId;
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
        <button class="flex min-w-0 flex-1 items-center gap-2 rounded-field p-2 text-left" class:bg-base-300={selectedId === folder.id} aria-label={`Folder ${folder.name}`} aria-pressed={selectedId === folder.id} title={folder.name} {disabled} onclick={() => onselect(folder.id)}>
          {#if expanded[folder.id]}<FolderOpen size={16} class="shrink-0" aria-hidden="true" />{:else}<Folder size={16} class="shrink-0" aria-hidden="true" />{/if}
          <span class="truncate">{folder.name}</span>
        </button>
      </div>
      {#if expanded[folder.id]}<ul>{@render branch(folder.id)}</ul>{/if}
    </li>
  {/each}
{/snippet}

<nav aria-label="Document folders">
  <ul class="menu menu-sm w-full">
    <li><button class:menu-active={selectedId === null} aria-label="Folder Documents" aria-pressed={selectedId === null} {disabled} onclick={() => onselect(null)}><FolderOpen size={16} aria-hidden="true" />Documents</button></li>
    {@render branch(null)}
  </ul>
</nav>
