<script lang="ts">
  import { onMount, tick } from "svelte";
  import { isTauri } from "@tauri-apps/api/core";
  import DocumentCard from "../components/DocumentCard.svelte";
  import { listDocuments, openDocument, saveDocumentCopy, uploadDocuments, revealDocument } from "../services/documents";
  import { listDocumentFolders, createDocumentFolder, documentFolderPath } from "../services/folders";
  import ResizablePanel from "$lib/shared/components/ResizablePanel.svelte";
  import TreeActions from "$lib/shared/components/TreeActions.svelte";
  import NotificationToast from "$lib/shared/components/NotificationToast.svelte";
  import { descendantFolderIds, type TreeItem } from "$lib/shared/services/tree";
  import { moveDocumentTreeItem, deleteDocumentTreeItem } from "../services/tree";
  import DocumentFolderTree from "../components/DocumentFolderTree.svelte";
  import FolderPlus from "@lucide/svelte/icons/folder-plus";
  import type { DocumentKind, SavedDocument, DocumentFolder } from "../types";

  let documents = $state<SavedDocument[]>([]);
  let selectedDocumentId = $state("");
  let treeActions: TreeActions;
  let folders = $state<DocumentFolder[]>([]);
  let selectedFolderId = $state<string | null>(null);
  let folderDialog: HTMLDialogElement;
  let folderName = $state("");
  let folderError = $state("");
  let loading = $state(true);
  let ready = $state(false);
  let desktop = $state(false);
  let busy = $state(false);
  let error = $state("");
  let message = $state("");
  let search = $state("");
  let filtered = $derived(documents.filter((document) => search.trim()
    ? document.name.toLowerCase().includes(search.trim().toLowerCase())
    : document.folder_id === selectedFolderId));

  onMount(() => {
    desktop = isTauri();
    if (desktop) void load();
    else loading = false;
  });

  async function load() {
    loading = true;
    ready = false;
    error = "";
    try {
      [documents, folders] = await Promise.all([listDocuments(), listDocumentFolders()]);
      if (selectedFolderId !== null && !folders.some((folder) => folder.id === selectedFolderId)) selectedFolderId = null;
      if (!documents.some((document) => document.id === selectedDocumentId)) selectedDocumentId = "";
      ready = true;
    } catch {
      error = "Could not load your documents. Please try again.";
    } finally {
      loading = false;
    }
  }

  async function upload(kind: DocumentKind) {
    if (busy || !ready) return;
    busy = true;
    error = message = "";
    try {
      const result = await uploadDocuments(kind, selectedFolderId);
      search = "";
      documents = [...result.documents.reverse(), ...documents];
      if (result.documents.length) message = `${result.documents.length} ${result.documents.length === 1 ? "file" : "files"} added to your library.`;
      if (result.failures.length) error = `Could not upload: ${result.failures.join(", ")}. Please try again.`;
    } catch {
      error = "Could not upload your documents. Please try again.";
    } finally {
      busy = false;
    }
  }

  function selectFolder(id: string | null) {
    selectedFolderId = id;
    selectedDocumentId = "";
    search = "";
  }

  async function addFolder(event: SubmitEvent) {
    event.preventDefault();
    if (busy || !ready) return;
    busy = true;
    folderError = "";
    try {
      const folder = await createDocumentFolder(folderName, selectedFolderId);
      folders = [...folders, folder];
      selectFolder(folder.id);
      folderDialog.close();
    } catch (cause) { folderError = cause instanceof Error ? cause.message : "Could not create this folder."; }
    finally { busy = false; }
  }

  async function reveal(document: SavedDocument) {
    if (busy) return;
    busy = true;
    error = message = "";
    try { await revealDocument(document); }
    catch { error = `Could not show the saved copy of ${document.name}. Refresh your library and try again.`; }
    finally { busy = false; }
  }

  async function selectDocument(document: SavedDocument) {
    if (busy) return;
    selectedFolderId = document.folder_id;
    selectedDocumentId = document.id;
    search = "";
    await tick();
    window.document.getElementById(`document-${document.id}`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  async function relocate(item: TreeItem, destination: string | null) {
    if (busy || !ready) throw new Error("Please wait until the library is ready.");
    const document = documents.find((document) => document.id === item.id);
    const folder = folders.find((folder) => folder.id === item.id);
    if ((item.kind === "file" && document?.folder_id === destination) || (item.kind === "folder" && folder?.parent_id === destination)) return;
    busy = true;
    error = message = "";
    try {
      await moveDocumentTreeItem(item, destination);
      if (item.kind === "file") {
        documents = documents.map((document) => document.id === item.id ? { ...document, folder_id: destination } : document);
        selectedFolderId = destination;
        selectedDocumentId = item.id;
      } else {
        folders = folders.map((folder) => folder.id === item.id ? { ...folder, parent_id: destination } : folder);
        selectFolder(item.id);
      }
      search = "";
      message = "Item moved.";
    } finally { busy = false; }
  }

  async function move(document: SavedDocument, destination: string | null) {
    if (busy) return;
    try { await relocate({ kind: "file", id: document.id }, destination); }
    catch (cause) {
      error = cause instanceof Error ? cause.message : "Could not move your document.";
      documents = documents.map((document) => ({ ...document }));
    }
  }

  async function removeItem(item: TreeItem) {
    if (busy || !ready) throw new Error("Please wait until the library is ready.");
    busy = true;
    error = message = "";
    try {
      const removedFolders = item.kind === "folder" ? descendantFolderIds(item.id, folders) : new Set<string>();
      const result = await deleteDocumentTreeItem(item);
      const deletedIds = new Set(documents.filter((document) => item.kind === "file" ? document.id === item.id : document.folder_id !== null && removedFolders.has(document.folder_id)).map((document) => document.id));
      documents = documents.filter((document) => !deletedIds.has(document.id));
      folders = folders.filter((folder) => !removedFolders.has(folder.id));
      if (selectedFolderId !== null && removedFolders.has(selectedFolderId)) selectFolder(null);
      if (deletedIds.has(selectedDocumentId)) selectedDocumentId = "";
      message = "Item deleted.";
      if (result.cleanupFailed) error = "Removed from your library, but some saved copies remain in the app's trash folder.";
    } finally { busy = false; }
  }

  function contextOpen(item: TreeItem) {
    const document = documents.find((document) => document.id === item.id);
    if (document) void open(document);
  }
  function contextReveal(item: TreeItem) {
    const document = documents.find((document) => document.id === item.id);
    if (document) void reveal(document);
  }

  async function open(document: SavedDocument) {
    if (busy) return;
    busy = true;
    error = message = "";
    try { await openDocument(document); }
    catch { error = `Could not open ${document.name}. Check that a compatible application is installed, or try saving a copy.`; }
    finally { busy = false; }
  }

  async function saveCopy(document: SavedDocument) {
    if (busy) return;
    busy = true;
    error = message = "";
    try {
      if (await saveDocumentCopy(document)) message = `Saved a copy of ${document.name}.`;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Could not save a copy. Please try again.";
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Profile — Sorrel</title></svelte:head>

<main class="flex min-h-0 w-full flex-1 flex-col gap-4 overflow-hidden p-4 lg:p-6">
  <div class="flex shrink-0 flex-wrap items-start justify-between gap-4">
    <div><h1 class="text-3xl font-bold">Profile & documents</h1><p class="mt-2">Keep your resume and application documents within reach.</p></div>
    <div class="flex flex-wrap gap-2">
      <button class="btn btn-ghost" disabled={!desktop || loading || busy} onclick={load}>Refresh</button>
      <button class="btn btn-primary" disabled={!ready || busy} onclick={() => upload("resume")}>Upload resume</button>
      <button class="btn btn-outline" disabled={!ready || busy} onclick={() => upload("document")}>Add documents</button>
    </div>
  </div>
  {#if !desktop && !loading}<div class="alert alert-info" role="status">Open the desktop app to upload and access your documents.</div>{/if}
  <p class="shrink-0 text-sm">Added files are copied into the app's AppData library. Open file location selects a saved copy in File Explorer.</p>
  <div class="flex min-h-0 flex-1 overflow-x-auto">
    <ResizablePanel storageKey="sorrel-profile-tree-width" panelId="profile-file-panel" label="Profile files" initialWidth={224}>
      <div class="flex items-center justify-between gap-2 border-b border-base-300 p-3"><h2 class="font-semibold">Files</h2><button class="btn btn-sm btn-square btn-ghost" aria-label="New folder" title="Create a folder" disabled={!ready || busy} onclick={() => { folderName = folderError = ""; folderDialog.showModal(); }}><FolderPlus size={18} aria-hidden="true" /></button></div>
      <DocumentFolderTree {documents} {folders} {selectedDocumentId} selectedId={selectedFolderId} disabled={!ready || busy} onselect={selectFolder} onselectfile={selectDocument} oncontext={(item, event) => treeActions.open(item, event)} onmove={(item, destination) => { void relocate(item, destination).catch((cause) => error = cause instanceof Error ? cause.message : "Could not move this item."); }} />
    </ResizablePanel>
    <section class="flex min-h-0 min-w-[20rem] flex-1 flex-col gap-4 overflow-y-auto px-4" aria-label="Document library">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="font-semibold break-words">{search.trim() ? "Search results" : documentFolderPath(selectedFolderId, folders)}</h2>
        <span class="badge badge-ghost">{filtered.length} {filtered.length === 1 ? "document" : "documents"}</span>
      </div>
      <input class="input w-full" type="search" aria-label="Search documents" placeholder="Search all documents..." bind:value={search} disabled={!ready} />
      {#if busy}<p class="flex items-center gap-2 text-sm" role="status"><span class="loading loading-spinner loading-xs" aria-hidden="true"></span>Working on your documents...</p>{/if}
      {#if loading}
        <div class="flex justify-center py-20" role="status"><span class="loading loading-spinner loading-lg" aria-hidden="true"></span><span class="sr-only">Loading documents...</span></div>
      {:else if ready && filtered.length === 0 && !search.trim()}
        <div class="card card-dash bg-base-100"><div class="card-body items-center py-12 text-center"><h2 class="card-title">{documents.length === 0 ? "Everything you need, in one place" : "This folder is empty"}</h2><p>Add a resume, cover letter, portfolio, or any other document to this folder.</p><button class="btn btn-primary mt-2" disabled={busy} onclick={() => upload("resume")}>Upload a resume</button></div></div>
      {:else if ready && filtered.length === 0}
        <p role="status">No documents match your search.</p>
      {:else}
        <div class="grid gap-4 xl:grid-cols-2" aria-busy={busy}>
          {#each filtered as document (document.id)}
            <DocumentCard {document} {folders} selected={document.id === selectedDocumentId} disabled={busy} onopen={open} onsave={saveCopy} onreveal={reveal} onmove={move} />
          {/each}
        </div>
      {/if}
    </section>
  </div>
</main>

<dialog bind:this={folderDialog} class="modal" aria-labelledby="new-document-folder-title">
  <form class="modal-box" onsubmit={addFolder}>
    <h2 id="new-document-folder-title" class="card-title"><FolderPlus size={20} aria-hidden="true" />New folder</h2>
    <p class="mt-2 break-words text-sm">Create in {documentFolderPath(selectedFolderId, folders)}</p>
    <label class="input mt-4 w-full"><span class="label">Name</span><input aria-label="Folder name" bind:value={folderName} required maxlength="200" disabled={busy} /></label>
    <div class="modal-action"><button type="button" class="btn btn-ghost" disabled={busy} onclick={() => folderDialog.close()}>Cancel</button><button type="submit" class="btn btn-primary" disabled={busy || !folderName.trim()}>Create folder</button></div>
  </form>
  <div class="toast toast-bottom toast-end pointer-events-none">{#if folderError}<NotificationToast text={folderError} kind="error" duration={10000} />{/if}</div>
</dialog>

<TreeActions bind:this={treeActions} files={documents} {folders} activeFileId={selectedDocumentId} activeName={documents.find((document) => document.id === selectedDocumentId)?.name ?? ""} dirty={false} disabled={!ready || busy} rootLabel="Documents" deleteNote="This deletes the saved copies in the app. Your original uploaded files are kept." onmove={relocate} ondelete={removeItem} onopen={contextOpen} onreveal={contextReveal} />

<div class="toast toast-bottom toast-end pointer-events-none z-50" aria-label="Profile notifications">
  {#if message}<NotificationToast text={message} />{/if}
  {#if error}<NotificationToast text={error} kind="error" duration={ready ? 10000 : 0} actionLabel={!ready ? "Try again" : ""} onaction={() => { if (!loading) void load(); }} />{/if}
</div>
