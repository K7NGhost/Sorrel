<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { isTauri } from "@tauri-apps/api/core";
  import LatexEditor from "../components/LatexEditor.svelte";
  import PdfPreview from "../components/PdfPreview.svelte";
  import { starterResume } from "../templates/starter";
  import { listDrafts, saveDraft } from "../services/drafts";
  import type { ResumeDraft, ResumeFolder, ResumeTreeItem } from "../types";
  import { listFolders, createFolder, folderPath } from "../services/folders";
  import ResumeFileTree from "../components/ResumeFileTree.svelte";
  import ResizablePanel from "../components/ResizablePanel.svelte";
  import ResumeTreeActions from "../components/ResumeTreeActions.svelte";
  import NotificationToast from "$lib/shared/components/NotificationToast.svelte";
  import { descendantFolderIds, moveTreeItem, deleteTreeItem } from "../services/tree";
  import PanelLeft from "@lucide/svelte/icons/panel-left";
  import GitFork from "@lucide/svelte/icons/git-fork";
  import FilePlus from "@lucide/svelte/icons/file-plus";
  import FolderPlus from "@lucide/svelte/icons/folder-plus";
  import Upload from "@lucide/svelte/icons/upload";
  import { exportTex, importTex, exportPdf, savePdfToProfile } from "../services/files";
  import { compileResume } from "../services/preview";
  import { readRecovery, updateRecovery } from "../state/recovery";

  let title = $state("My resume");
  let fileId = $state("default");
  let hasFile = $state(true);
  let treeActions: ResumeTreeActions;
  let files = $state<ResumeDraft[]>([]);
  let folders = $state<ResumeFolder[]>([]);
  let selectedFolderId = $state<string | null>(null);
  let fileFolderId = $state<string | null>(null);
  let folderDialog: HTMLDialogElement;
  let folderName = $state("");
  let folderError = $state("");
  let showFiles = $state(true);
  let compilerDialog: HTMLDialogElement;
  let source = $state(starterResume);
  let savedTitle = $state("My resume");
  let savedSource = $state(starterResume);
  let updatedAt = $state<string | null>(null);
  let loading = $state(true);
  let ready = $state(false);
  let desktop = $state(false);
  let busy = $state(false);
  let error = $state("");
  let message = $state("");
  let recoveryFailed = $state(false);
  let preview = $state<Uint8Array>();
  let previewSource = $state("");
  let diagnostics = $state("");
  let previewError = $state("");
  let rendering = $state(false);
  let retry = $state(0);
  let pendingSource: { id: string; source: string } | null = null;
  let running = false;
  let destroyed = false;
  let replaceDialog: HTMLDialogElement;
  let replacement = $state<{ title: string; source: string } | null>(null);
  let dirty = $derived(hasFile && (title !== savedTitle || source !== savedSource));
  let previewPending = $derived(source !== previewSource);

  onMount(() => { desktop = isTauri(); void load(); });
  onDestroy(() => { destroyed = true; pendingSource = null; });

  async function load() {
    loading = true;
    error = "";
    try {
      [files, folders] = desktop ? await Promise.all([listDrafts(), listFolders()]) : [[], []];
      let lastFile: string | null = null;
      try { lastFile = localStorage.getItem("sorrel-resume-active-file"); } catch { /* SQLite still works without local storage. */ }
      const saved = files.find((file) => file.id === lastFile) ?? files[0];
      if (!saved && lastFile === "") clearWorkspace();
      else {
        activate(saved ?? { id: "default", folder_id: null, title: "My resume", source: starterResume, updated_at: "" });
        if (!files.length) files = [{ id: fileId, folder_id: null, title, source: savedSource, updated_at: "" }];
      }
      ready = true;
    } catch { error = "Could not load your resume draft. Please try again."; }
    finally { loading = false; }
  }

  function activate(file: ResumeDraft) {
    hasFile = true;
    fileId = file.id;
    fileFolderId = selectedFolderId = file.folder_id;
    savedTitle = file.title;
    savedSource = file.source;
    updatedAt = file.updated_at || null;
    const recovered = readRecovery(updatedAt, fileId);
    title = recovered?.title ?? savedTitle;
    source = recovered?.source ?? savedSource;
    message = recovered ? "Recovered your unsaved edits." : "";
    preview = undefined;
    previewSource = diagnostics = previewError = "";
    pendingSource = null;
    try { localStorage.setItem("sorrel-resume-active-file", fileId); } catch { /* Optional last-file preference. */ }
  }

  function clearWorkspace() {
    hasFile = false;
    fileId = title = source = savedTitle = savedSource = "";
    fileFolderId = selectedFolderId = null;
    updatedAt = null;
    preview = undefined;
    previewSource = diagnostics = previewError = "";
    pendingSource = null;
    try { localStorage.setItem("sorrel-resume-active-file", ""); } catch { /* Optional preference. */ }
  }

  async function relocate(item: ResumeTreeItem, destination: string | null) {
    if (!desktop || !ready || busy) throw new Error("Please wait until the file tree is ready.");
    const file = files.find((file) => file.id === item.id);
    const folder = folders.find((folder) => folder.id === item.id);
    if ((item.kind === "file" && file?.folder_id === destination) || (item.kind === "folder" && folder?.parent_id === destination)) return;
    busy = true;
    error = message = "";
    try {
      if (item.kind === "file" && item.id === fileId && (dirty || !updatedAt)) await saveCurrent();
      await moveTreeItem(item, destination);
      if (item.kind === "file") {
        files = files.map((file) => file.id === item.id ? { ...file, folder_id: destination } : file);
        if (item.id === fileId) fileFolderId = destination;
        selectedFolderId = destination;
      } else {
        folders = folders.map((folder) => folder.id === item.id ? { ...folder, parent_id: destination } : folder);
        selectedFolderId = item.id;
      }
      message = "Item moved.";
    } finally { busy = false; }
  }

  async function removeItem(item: ResumeTreeItem) {
    if (!desktop || !ready || busy) throw new Error("Please wait until the file tree is ready.");
    busy = true;
    error = message = "";
    try {
      const removedFolders = item.kind === "folder" ? descendantFolderIds(item.id, folders) : new Set<string>();
      const removed = files.filter((file) => item.kind === "file" ? file.id === item.id : file.folder_id !== null && removedFolders.has(file.folder_id));
      if (!(item.kind === "file" && removed[0] && !removed[0].updated_at)) await deleteTreeItem(item);
      const removesActive = removed.some((file) => file.id === fileId);
      for (const file of removed) updateRecovery(null, file.id);
      files = files.filter((file) => !removed.some((deleted) => deleted.id === file.id));
      folders = folders.filter((folder) => !removedFolders.has(folder.id));
      if (removesActive) { if (files[0]) activate(files[0]); else clearWorkspace(); }
      else if (selectedFolderId !== null && removedFolders.has(selectedFolderId)) selectedFolderId = fileFolderId;
      message = "Item deleted.";
    } finally { busy = false; }
  }

  async function saveCurrent(folderId = fileFolderId) {
    const saved = await saveDraft(title, source, fileId, folderId);
    fileFolderId = saved.folder_id;
    title = savedTitle = saved.title;
    savedSource = saved.source;
    updatedAt = saved.updated_at;
    files = [...files.filter((file) => file.id !== saved.id), saved];
    updateRecovery(null, fileId);
  }

  async function openFile(file: ResumeDraft) {
    if (busy || !ready || file.id === fileId) return;
    busy = true;
    error = "";
    try {
      if (dirty && desktop) await saveCurrent();
      activate(file);
    } catch (cause) { error = errorMessage(cause, "Save your edits before switching files."); }
    finally { busy = false; }
  }

  async function createFile(next = { title: "Untitled resume", source: starterResume }, folderId = selectedFolderId) {
    if (!desktop || !ready || busy) return;
    busy = true;
    error = message = "";
    try {
      if (hasFile && (dirty || !updatedAt)) await saveCurrent();
      const file = await saveDraft(next.title, next.source, crypto.randomUUID(), folderId);
      files = [...files, file];
      activate(file);
    } catch (cause) { error = errorMessage(cause, "Could not create your LaTeX file."); }
    finally { busy = false; }
  }

  function forkFile() {
    let name = `${title.trim() || "Untitled resume"} (copy)`;
    let number = 2;
    while (files.some((file) => file.folder_id === fileFolderId && file.title === name)) {
      name = `${title.trim() || "Untitled resume"} (copy ${number++})`;
    }
    void createFile({ title: name, source }, fileFolderId);
  }

  async function addFolder(event: SubmitEvent) {
    event.preventDefault();
    if (busy || !desktop) return;
    busy = true;
    folderError = "";
    try {
      const folder = await createFolder(folderName, selectedFolderId);
      folders = [...folders, folder];
      selectedFolderId = folder.id;
      folderDialog.close();
    } catch (cause) { folderError = errorMessage(cause, "Could not create the folder."); }
    finally { busy = false; }
  }

  async function moveFile(event: Event) {
    if (!desktop || !ready || busy) return;
    const folderId = (event.currentTarget as HTMLSelectElement).value || null;
    if (folderId === fileFolderId) return;
    busy = true;
    error = message = "";
    try {
      await saveCurrent(folderId);
      selectedFolderId = folderId;
      message = "Resume moved.";
    } catch (cause) { error = errorMessage(cause, "Could not move your resume."); }
    finally { busy = false; }
  }

  $effect(() => {
    if (!ready || !hasFile) return;
    recoveryFailed = !updateRecovery(dirty ? { title, source, baseUpdatedAt: updatedAt } : null, fileId);
  });

  $effect(() => {
    if (!ready || !desktop || !hasFile) return;
    const input = source;
    const id = fileId;
    retry;
    const timer = setTimeout(() => { pendingSource = { id, source: input }; void runCompiler(); }, 850);
    return () => clearTimeout(timer);
  });

  async function runCompiler() {
    if (running || destroyed) return;
    running = true;
    rendering = true;
    while (pendingSource !== null && !destroyed) {
      const input = pendingSource;
      pendingSource = null;
      try {
        const result = await compileResume(input.source);
        if (destroyed || source !== input.source || fileId !== input.id) continue;
        preview = result.pdf;
        previewSource = input.source;
        diagnostics = result.diagnostics;
        previewError = "";
      } catch (cause) {
        if (!destroyed && source === input.source && fileId === input.id) previewError = errorMessage(cause, "Tectonic could not compile this document.");
      }
    }
    running = false;
    if (!destroyed) rendering = false;
  }

  function errorMessage(cause: unknown, fallback: string) {
    return cause instanceof Error ? cause.message : typeof cause === "string" ? cause : fallback;
  }

  async function persist() {
    if (!desktop || !ready || !hasFile || busy) return;
    busy = true;
    error = message = "";
    try {
      await saveCurrent();
      message = "Resume draft saved.";
    } catch (cause) { error = errorMessage(cause, "Could not save your draft. Please try again."); }
    finally { busy = false; }
  }

  function replace(next: { title: string; source: string }) {
    if (dirty) { replacement = next; replaceDialog.showModal(); }
    else { title = next.title; source = next.source; }
  }

  async function importSource() {
    if (busy || !ready) return;
    busy = true;
    error = message = "";
    try {
      const imported = await importTex();
      if (imported) {
        if (hasFile && (dirty || !updatedAt)) await saveCurrent();
        const file = await saveDraft(imported.title, imported.source, crypto.randomUUID(), selectedFolderId);
        files = [...files, file];
        activate(file);
      }
    } catch (cause) { error = errorMessage(cause, "Could not import this LaTeX file."); }
    finally { busy = false; }
  }

  async function exportSource() {
    if (busy || !ready) return;
    busy = true;
    error = message = "";
    try { if (await exportTex(title, source)) message = "LaTeX source exported."; }
    catch (cause) { error = errorMessage(cause, "Could not export your LaTeX file."); }
    finally { busy = false; }
  }

  async function addToProfile() {
    if (busy || !ready || !preview || previewPending || previewError) return;
    busy = true;
    error = message = "";
    try { await savePdfToProfile(title, preview); message = "Resume PDF added to your Profile documents."; }
    catch (cause) { error = errorMessage(cause, "Could not add your resume to Profile."); }
    finally { busy = false; }
  }

  async function exportPdfFile() {
    if (busy || !preview || previewPending || previewError) return;
    busy = true;
    error = message = "";
    try { if (await exportPdf(title, preview)) message = "Resume PDF exported."; }
    catch (cause) { error = errorMessage(cause, "Could not export the PDF."); }
    finally { busy = false; }
  }
</script>

<svelte:head><title>Resume Builder — Sorrel</title></svelte:head>

<main class="flex min-h-0 w-full flex-1 flex-col overflow-hidden" aria-label="Resume workspace">
  <div class="flex shrink-0 flex-wrap items-center gap-2 border-b border-base-300 p-2">
    <button class="btn btn-sm btn-ghost" aria-label="Toggle file explorer" aria-expanded={showFiles} onclick={() => showFiles = !showFiles}><PanelLeft size={18} aria-hidden="true" /></button>
    <label class="input input-sm w-48"><span class="label">Name</span><input aria-label="Resume name" bind:value={title} disabled={!ready || !hasFile || busy} maxlength="200" /></label>
    <button class="btn btn-sm btn-primary" disabled={!desktop || !ready || !hasFile || busy} onclick={persist}>{busy ? "Working..." : "Save draft"}</button>
    <button class="btn btn-sm btn-outline" disabled={!desktop || !ready || !hasFile || busy} onclick={forkFile}><GitFork size={16} aria-hidden="true" />Fork</button>
    <label class="select select-sm w-44"><span class="sr-only">Move resume to folder</span><select aria-label="Move resume to folder" value={fileFolderId ?? ""} disabled={!desktop || !ready || !hasFile || busy} onchange={moveFile}>
      <option value="">Resumes</option>
      {#each folders as folder (folder.id)}<option value={folder.id}>{folderPath(folder.id, folders)}</option>{/each}
    </select></label>
    <button class="btn btn-sm btn-ghost" disabled={!ready || !hasFile || busy} onclick={() => replace({ title: "My resume", source: starterResume })}>Starter template</button>
    <button class="btn btn-sm btn-outline" disabled={!desktop || !ready || !hasFile || busy} onclick={exportSource}>Export .tex</button>
    <button class="btn btn-sm btn-outline" disabled={!desktop || !preview || previewPending || !!previewError || busy} onclick={addToProfile}>Add PDF to Profile</button>
    <button class="btn btn-sm btn-outline" disabled={!desktop || !preview || previewPending || !!previewError || busy} onclick={exportPdfFile}>Export PDF</button>
    {#if diagnostics || previewError}<button class="btn btn-sm btn-ghost" onclick={() => compilerDialog.showModal()}>Compiler output</button>{/if}
  </div>
  {#if !desktop && !loading}<div class="alert alert-info shrink-0 py-2" role="status">You can edit here. Open the desktop app to compile PDFs with Tectonic and save your resume.</div>{/if}
  <div class="flex min-h-0 flex-1 overflow-x-auto" data-testid="resume-panes">
    {#if showFiles}
      <ResizablePanel>
        <div class="flex shrink-0 items-center justify-between gap-1 border-b border-base-300 p-2">
          <h2 class="text-sm font-semibold">Files</h2>
          <div class="flex gap-1">
            <button class="btn btn-xs btn-square btn-ghost" aria-label="New .tex" title="New .tex in selected folder" disabled={!desktop || !ready || busy} onclick={() => createFile()}><FilePlus size={16} aria-hidden="true" /></button>
            <button class="btn btn-xs btn-square btn-ghost" aria-label="New folder" title="New folder in selected folder" disabled={!desktop || !ready || busy} onclick={() => { folderName = folderError = ""; folderDialog.showModal(); }}><FolderPlus size={16} aria-hidden="true" /></button>
          </div>
        </div>
        <ResumeFileTree {files} {folders} activeFileId={fileId} activeTitle={title} {selectedFolderId} disabled={!desktop || !ready || busy} onopenfile={openFile} onselectfolder={(id) => selectedFolderId = id} oncontext={(item, event) => treeActions.open(item, event)} onmove={(item, destination) => { void relocate(item, destination).catch((cause) => error = errorMessage(cause, "Could not move this item.")); }} />
        <button class="btn btn-sm btn-ghost m-2 shrink-0" disabled={!desktop || !ready || busy} onclick={importSource}><Upload size={16} aria-hidden="true" />Import .tex</button>
        <p class="shrink-0 px-3 pb-3 text-xs">Edits save when switching files.</p>
      </ResizablePanel>
    {/if}
    <div class="grid min-h-0 min-w-[28rem] flex-1 grid-cols-2">
      <section class="flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-base-300 bg-base-100" aria-label="Code editor pane">
        <div class="flex shrink-0 items-center justify-between gap-2 border-b border-base-300 p-2"><h2 class="font-semibold">LaTeX source</h2><span class="hidden text-xs lg:inline">Ctrl/Cmd + S</span></div>
        <div class="min-h-0 flex-1 overflow-hidden" inert={busy}>
          {#if ready && hasFile}{#key fileId}<LatexEditor bind:value={source} disabled={busy} onsave={persist} />{/key}{:else}<div class="flex h-full items-center justify-center" role="status">{ready ? "Select or create a .tex file to start editing." : "Loading your draft..."}</div>{/if}
        </div>
      </section>
      <section class="flex min-h-0 min-w-0 flex-col overflow-hidden bg-base-200" aria-label="PDF preview pane">
        <div class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-base-300 p-2">
          <h2 class="font-semibold">PDF preview</h2>
          {#if rendering}<span class="flex items-center gap-2 text-xs" role="status"><span class="loading loading-spinner loading-xs" aria-hidden="true"></span>Compiling...</span>{:else}<span class="badge badge-sm badge-ghost">{previewError ? "Last successful PDF" : !desktop ? "Desktop required" : previewPending ? "Waiting to compile..." : "Up to date"}</span>{/if}
        </div>
        <div class="min-h-0 flex-1 overflow-hidden p-2">
          {#if preview}<PdfPreview data={preview} onerror={(value) => error = value} />{:else}<div class="flex h-full items-center justify-center gap-3 p-3" role="status">{#if desktop && hasFile && !previewError}<span class="loading loading-spinner" aria-hidden="true"></span>{/if}<span>{!hasFile && ready ? "Open a resume to preview its PDF." : !desktop && !loading ? "PDF compilation is available in the desktop app." : loading ? "Loading your draft..." : previewError ? "Fix the LaTeX error to see your resume." : "Compiling with Tectonic..."}</span></div>{/if}
        </div>
      </section>
    </div>
  </div>
</main>

<dialog bind:this={compilerDialog} class="modal" aria-label="Compiler output">
  <div class="modal-box"><h2 class="card-title">Compiler output</h2><pre class="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs">{previewError || diagnostics}</pre><div class="modal-action">{#if previewError}<button class="btn" disabled={rendering} onclick={() => retry++}>Retry</button>{/if}<form method="dialog"><button class="btn">Close</button></form></div></div>
</dialog>

<div class="toast toast-bottom toast-end pointer-events-none z-50" aria-label="Resume notifications">
  {#if dirty}<NotificationToast text="Unsaved changes" kind="warning" />{/if}
  {#if message}<NotificationToast text={message} title={message === "Resume draft saved." ? "Saved draft" : ""} />{/if}
  {#if error}<NotificationToast text={error} kind="error" duration={ready ? 10000 : 0} actionLabel={!ready ? "Try again" : ""} onaction={() => { if (!loading) void load(); }} />{/if}
  {#if previewError}<NotificationToast text={previewError} kind="error" duration={10000} actionLabel="Compiler output" onaction={() => compilerDialog.showModal()} />{/if}
  {#if recoveryFailed}<NotificationToast text="Automatic edit recovery is unavailable. Save your draft before leaving this page." kind="warning" duration={10000} />{/if}
</div>

<dialog bind:this={folderDialog} class="modal" aria-labelledby="new-folder-title">
  <form class="modal-box" onsubmit={addFolder}>
    <h2 id="new-folder-title" class="card-title"><FolderPlus size={20} aria-hidden="true" />New folder</h2>
    <p class="mt-2 break-words text-sm">Create in {folderPath(selectedFolderId, folders)}</p>
    <label class="input mt-4 w-full"><span class="label">Name</span><input aria-label="Folder name" bind:value={folderName} required maxlength="200" disabled={busy} /></label>
    <div class="modal-action"><button type="button" class="btn btn-ghost" disabled={busy} onclick={() => folderDialog.close()}>Cancel</button><button type="submit" class="btn btn-primary" disabled={busy || !folderName.trim()}>Create folder</button></div>
  </form>
<div class="toast toast-bottom toast-end pointer-events-none">{#if folderError}<NotificationToast text={folderError} kind="error" duration={10000} />{/if}</div>
</dialog>

<dialog bind:this={replaceDialog} class="modal" aria-labelledby="replace-resume-title">
  <div class="modal-box">
    <h2 id="replace-resume-title" class="card-title">Replace your current edits?</h2>
    <p class="mt-3">Save your draft first if you want to keep these changes.</p>
    <div class="modal-action">
      <button class="btn btn-ghost" onclick={() => { replacement = null; replaceDialog.close(); }}>Cancel</button>
      <button class="btn btn-primary" onclick={() => { if (replacement) { title = replacement.title; source = replacement.source; } replacement = null; replaceDialog.close(); }}>Replace edits</button>
    </div>
  </div>
</dialog>

<ResumeTreeActions bind:this={treeActions} {files} {folders} activeFileId={fileId} activeTitle={title} {dirty} disabled={!desktop || !ready || busy} onmove={relocate} ondelete={removeItem} />
