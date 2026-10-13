<script lang="ts">
  import NotificationToast from "$lib/shared/components/NotificationToast.svelte";
  import FolderInput from "@lucide/svelte/icons/folder-input";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import type { ResumeDraft, ResumeFolder, ResumeTreeItem } from "../types";
  import { folderPath } from "../services/folders";
  import { descendantFolderIds } from "../services/tree";

  let { files, folders, activeFileId, activeTitle, dirty, disabled, onmove, ondelete }: {
    files: ResumeDraft[]; folders: ResumeFolder[]; activeFileId: string; activeTitle: string;
    dirty: boolean; disabled: boolean;
    onmove: (item: ResumeTreeItem, destination: string | null) => Promise<void>;
    ondelete: (item: ResumeTreeItem) => Promise<void>;
  } = $props();
  let menu: HTMLDivElement;
  let moveDialog: HTMLDialogElement;
  let deleteDialog: HTMLDialogElement;
  let target = $state<ResumeTreeItem>();
  let x = $state(0);
  let y = $state(0);
  let destination = $state("");
  let processing = $state(false);
  let error = $state("");
  let name = $derived(target?.kind === "folder" ? folders.find((folder) => folder.id === target?.id)?.name ?? "Folder" : `${target?.id === activeFileId ? activeTitle : files.find((file) => file.id === target?.id)?.title ?? "Resume"}.tex`);
  let subtree = $derived(target?.kind === "folder" ? descendantFolderIds(target.id, folders) : new Set<string>());
  let removedFiles = $derived(target?.kind === "folder" ? files.filter((file) => file.folder_id !== null && subtree.has(file.folder_id)) : files.filter((file) => file.id === target?.id));

  export function open(item: ResumeTreeItem, event: MouseEvent | KeyboardEvent) {
    event.preventDefault();
    if (disabled || processing) return;
    target = item;
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    x = Math.max(8, Math.min(event instanceof MouseEvent ? event.clientX : bounds.left, innerWidth - 232));
    y = Math.max(8, Math.min(event instanceof MouseEvent ? event.clientY : bounds.bottom, innerHeight - 100));
    menu.showPopover();
    menu.querySelector<HTMLButtonElement>("button")?.focus();
  }

  function requestMove() {
    menu.hidePopover();
    error = "";
    destination = (target?.kind === "folder" ? folders.find((folder) => folder.id === target?.id)?.parent_id : files.find((file) => file.id === target?.id)?.folder_id) ?? "";
    moveDialog.showModal();
  }
  function requestDelete() { menu.hidePopover(); error = ""; deleteDialog.showModal(); }

  async function perform(action: "move" | "delete", event: SubmitEvent) {
    event.preventDefault();
    if (!target || processing) return;
    processing = true;
    error = "";
    try {
      if (action === "move") { await onmove(target, destination || null); moveDialog.close(); }
      else { await ondelete(target); deleteDialog.close(); }
    } catch (cause) { error = cause instanceof Error ? cause.message : `Could not ${action} this item.`; }
    finally { processing = false; }
  }

  function menuKeys(event: KeyboardEvent) {
    const items = Array.from(menu.querySelectorAll<HTMLButtonElement>("[role=menuitem]"));
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    }
    if (event.key === "Tab") menu.hidePopover();
  }
</script>

<div bind:this={menu} popover="auto" role="menu" aria-label="File tree actions" tabindex="-1" onkeydown={menuKeys} class="fixed m-0 w-56 rounded-box border border-base-300 bg-base-100 p-1 text-base-content shadow-lg" style:left={`${x}px`} style:top={`${y}px`}>
  <button class="btn btn-sm btn-ghost w-full justify-start" role="menuitem" onclick={requestMove}><FolderInput size={16} aria-hidden="true" />Move...</button>
  <button class="btn btn-sm btn-ghost w-full justify-start text-error" role="menuitem" onclick={requestDelete}><Trash2 size={16} aria-hidden="true" />Delete...</button>
</div>

<dialog bind:this={moveDialog} class="modal" aria-labelledby="move-tree-title" oncancel={(event) => { if (processing) event.preventDefault(); }}>
  <form class="modal-box" onsubmit={(event) => perform("move", event)}>
    <h2 id="move-tree-title" class="card-title">Move {name}</h2>
    <label class="select mt-4 w-full"><span class="label">To</span><select aria-label="Destination folder" bind:value={destination} disabled={processing}>
      <option value="">Resumes</option>
      {#each folders.filter((folder) => !subtree.has(folder.id)) as folder (folder.id)}<option value={folder.id}>{folderPath(folder.id, folders)}</option>{/each}
    </select></label>
    <div class="modal-action"><button type="button" class="btn btn-ghost" disabled={processing} onclick={() => moveDialog.close()}>Cancel</button><button class="btn btn-primary" type="submit" disabled={processing}>Move</button></div>
  </form>
  <div class="toast toast-bottom toast-end pointer-events-none">{#if error}<NotificationToast text={error} kind="error" duration={10000} />{/if}</div>
</dialog>

<dialog bind:this={deleteDialog} class="modal" aria-labelledby="delete-tree-title" oncancel={(event) => { if (processing) event.preventDefault(); }}>
  <form class="modal-box" onsubmit={(event) => perform("delete", event)}>
    <h2 id="delete-tree-title" class="card-title">Delete {name}?</h2>
    <p class="mt-3">{target?.kind === "folder" ? `This removes the folder, ${Math.max(0, subtree.size - 1)} subfolders, and ${removedFiles.length} saved files.` : "This removes the saved LaTeX file."} This cannot be undone.</p>
    {#if dirty && removedFiles.some((file) => file.id === activeFileId)}<p class="mt-3 text-warning">Your unsaved edits to the open file will also be deleted.</p>{/if}
    <div class="modal-action"><button type="button" class="btn btn-ghost" disabled={processing} onclick={() => deleteDialog.close()}>Cancel</button><button class="btn btn-error" type="submit" disabled={processing}>Delete</button></div>
  </form>
  <div class="toast toast-bottom toast-end pointer-events-none">{#if error}<NotificationToast text={error} kind="error" duration={10000} />{/if}</div>
</dialog>
