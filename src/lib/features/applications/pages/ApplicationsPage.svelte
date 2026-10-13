<script lang="ts">
  import { onMount } from "svelte";
  import { isTauri } from "@tauri-apps/api/core";
  import AddApplicationDialog from "../components/AddApplicationDialog.svelte";
  import ApplicationBoard from "../components/ApplicationBoard.svelte";
  import ApplicationDetailsDialog from "../components/ApplicationDetailsDialog.svelte";
  import ApplicationContextMenu from "../components/ApplicationContextMenu.svelte";
  import EditApplicationDialog from "../components/EditApplicationDialog.svelte";
  import DeleteApplicationDialog from "../components/DeleteApplicationDialog.svelte";
  import NotificationToast from "$lib/shared/components/NotificationToast.svelte";
  import { planPlacement } from "../state/placement";
  import { createApplication, listApplications, moveApplication, updateApplicationDetails, updateApplication, deleteApplication } from "../services/applications";
  import { applicationColumns, type ApplicationStatus, type JobApplication, type NewApplication } from "../types";

  let applications = $state<JobApplication[]>([]);
  let loading = $state(true);
  let ready = $state(false);
  let desktop = $state(false);
  let busy = $state(false);
  let interacting = $state(false);
  let error = $state("");
  let announcement = $state("");
  let search = $state("");
  let addDialog: AddApplicationDialog;
  let detailsDialog: ApplicationDetailsDialog;
  let contextMenu: ApplicationContextMenu;
  let editDialog: EditApplicationDialog;
  let deleteDialog: DeleteApplicationDialog;
  let message = $state("");
  let filtered = $derived(applications.filter((application) =>
    `${application.company} ${application.role}`.toLowerCase().includes(search.trim().toLowerCase())));

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
      applications = await listApplications();
      ready = true;
    } catch {
      error = "Could not load your applications. Please try again.";
    } finally {
      loading = false;
    }
  }

  async function add(input: NewApplication) {
    if (busy || !ready) throw new Error("Please wait until the board is ready.");
    busy = true;
    try {
      const application = await createApplication(input);
      applications = [application, ...applications];
      announcement = `${application.company} added to Applied.`;
    } finally {
      busy = false;
    }
  }

  async function move(id: string, status: ApplicationStatus, visibleOrder?: string[]): Promise<boolean> {
    if (busy || !ready) return false;
    const application = applications.find((item) => item.id === id);
    if (!application) return false;
    const snapshot = applications;
    busy = true;
    error = "";
    try {
      const placement = planPlacement(applications, id, status, visibleOrder);
      const oldOrder = applications.filter((item) => item.status === status).map((item) => item.id);
      if (application.status === status && oldOrder.join(",") === placement.orderedIds.join(",")) return true;
      applications = placement.applications;
      const updated_at = await moveApplication(id, status, placement.orderedIds);
      applications = applications.map((item) => item.id === id ? { ...item, status, updated_at } : item);
      announcement = application.status === status ? `${application.company} reordered in ${status}.` : `${application.company} moved to ${applicationColumns.find((column) => column.status === status)?.label}.`;
      return true;
    } catch {
      applications = snapshot;
      error = "Could not save the move. Your application has returned to its previous position. Please try again.";
      return false;
    } finally {
      busy = false;
    }
  }

  function showDetails(application: JobApplication) {
    const current = applications.find((item) => item.id === application.id);
    if (current && !busy && !interacting) detailsDialog.open(current);
  }

  function showEdit(application: JobApplication) {
    const current = applications.find((item) => item.id === application.id);
    if (current && !busy && !interacting) editDialog.open(current);
  }

  function showDelete(application: JobApplication) {
    const current = applications.find((item) => item.id === application.id);
    if (current && !busy && !interacting) deleteDialog.open(current);
  }

  async function edit(id: string, input: NewApplication) {
    if (busy || !ready || interacting) throw new Error("Please wait until the board is ready.");
    if (!applications.some((item) => item.id === id)) throw new Error("This application could not be found.");
    busy = true;
    message = "";
    try {
      const updated = await updateApplication(id, input);
      applications = applications.map((item) => item.id === id ? { ...item, ...updated } : item);
      message = "Application updated.";
    } finally { busy = false; }
  }

  async function remove(id: string) {
    if (busy || !ready || interacting) throw new Error("Please wait until the board is ready.");
    busy = true;
    message = "";
    try {
      await deleteApplication(id);
      applications = applications.filter((item) => item.id !== id);
      message = "Application deleted.";
    } finally { busy = false; }
  }

  function showContext(application: JobApplication, event: MouseEvent | KeyboardEvent) {
    event.preventDefault();
    if (busy || interacting) return;
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = event instanceof MouseEvent ? event.clientX : bounds.left;
    const y = event instanceof MouseEvent ? event.clientY : bounds.bottom;
    contextMenu.open(application, x, y);
  }

  async function saveDetails(id: string, notes: string, description: string): Promise<JobApplication> {
    if (busy || !ready) throw new Error("Please wait until the board is ready.");
    const current = applications.find((item) => item.id === id);
    if (!current) throw new Error("This application could not be found.");
    busy = true;
    try {
      const details = await updateApplicationDetails(id, notes, description);
      const updated = { ...current, ...details };
      applications = applications.map((item) => item.id === id ? updated : item);
      announcement = `${updated.company} details saved.`;
      return updated;
    } finally { busy = false; }
  }
</script>

<svelte:head><title>Sorrel — Job applications</title></svelte:head>

  <main class="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-6 overflow-hidden p-6 lg:p-10 [@media(max-height:600px)]:gap-3 [@media(max-height:600px)]:p-4">
    <div class="flex shrink-0 flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold">Your applications</h1>
        <p class="mt-2 [@media(max-height:600px)]:hidden">A little clarity for your next career move. <span class="badge badge-ghost">{applications.length} applications</span></p>
      </div>
      <button class="btn btn-primary" disabled={!ready || busy || interacting} onclick={() => addDialog.open()}>+ Add application</button>
    </div>

    {#if !desktop && !loading}
      <div class="alert alert-info shrink-0" role="status"><span>Open Sorrel as a desktop app to load and save your applications.</span></div>
    {/if}
    {#if error}
      <div class="alert alert-error shrink-0" role="alert">
        <span>{error}</span>
        {#if !ready}<button class="btn btn-sm" disabled={loading} onclick={load}>Try again</button>{/if}
      </div>
    {/if}

    <div class="flex shrink-0 flex-wrap items-center justify-between gap-3">
      <input class="input w-full sm:w-80" type="search" aria-label="Search company or role" placeholder="Search company or role…" bind:value={search} disabled={!ready || busy || interacting} />
      <p class="text-sm [@media(max-height:600px)]:hidden">Drag the grip to move or reorder. Space/Enter picks up; arrows and Tab move.</p>
    </div>

    {#if loading}
      <div class="flex justify-center py-20" role="status"><span class="loading loading-spinner loading-lg" aria-hidden="true"></span><span class="sr-only">Loading applications…</span></div>
    {:else}
      {#if ready && search.trim() && filtered.length === 0}<p role="status">No applications match “{search}”.</p>{/if}
      <ApplicationBoard applications={filtered} disabled={!ready || busy} onmove={move} oninteraction={(active) => interacting = active} ondetails={showDetails} oncontext={showContext} />
    {/if}
    <p class="sr-only" aria-live="polite">{announcement}</p>
  </main>

<AddApplicationDialog bind:this={addDialog} onsave={add} />
<ApplicationDetailsDialog bind:this={detailsDialog} onsave={saveDetails} />
<ApplicationContextMenu bind:this={contextMenu} ondetails={showDetails} onedit={showEdit} ondelete={showDelete} />
<EditApplicationDialog bind:this={editDialog} onsave={edit} />
<DeleteApplicationDialog bind:this={deleteDialog} ondelete={remove} />
<div class="toast toast-bottom toast-end pointer-events-none z-50">{#if message}<NotificationToast text={message} />{/if}</div>
