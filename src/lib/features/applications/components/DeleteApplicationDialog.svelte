<script lang="ts">
  import NotificationToast from "$lib/shared/components/NotificationToast.svelte";
  import type { JobApplication } from "../types";
  let { ondelete }: { ondelete: (id: string) => Promise<void> } = $props();
  let dialog: HTMLDialogElement;
  let application = $state<JobApplication>();
  let deleting = $state(false);
  let error = $state("");
  export function open(job: JobApplication) { application = job; error = ""; dialog.showModal(); }
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!application || deleting) return;
    deleting = true;
    error = "";
    try { await ondelete(application.id); dialog.close(); }
    catch (cause) { error = cause instanceof Error ? cause.message : "Could not delete this application. Please try again."; }
    finally { deleting = false; }
  }
</script>

<dialog bind:this={dialog} class="modal" aria-labelledby="delete-application-title" oncancel={(event) => { if (deleting) event.preventDefault(); }}>
  <form class="modal-box" onsubmit={submit}>
    <h2 id="delete-application-title" class="card-title">Delete application?</h2>
    {#if application}<p class="mt-3 break-words">Delete {application.company}{application.role ? ` — ${application.role}` : ""} and its saved notes and job description? This cannot be undone.</p>{/if}
    <div class="modal-action"><button type="button" class="btn btn-ghost" disabled={deleting} onclick={() => dialog.close()}>Cancel</button><button type="submit" class="btn btn-error" disabled={deleting}>{deleting ? "Deleting..." : "Delete"}</button></div>
  </form>
  <div class="toast toast-bottom toast-end pointer-events-none">{#if error}<NotificationToast text={error} kind="error" duration={10000} />{/if}</div>
</dialog>
