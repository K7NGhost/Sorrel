<script lang="ts">
  import type { JobApplication } from "../types";
  import { applicationColumns } from "../types";

  let { onsave }: { onsave: (id: string, notes: string, description: string) => Promise<JobApplication> } = $props();
  let dialog: HTMLDialogElement;
  let application = $state<JobApplication>();
  let notes = $state("");
  let description = $state("");
  let saving = $state(false);
  let error = $state("");
  let changed = $derived(!!application && (notes !== application.notes || description !== application.job_description));

  export function open(job: JobApplication) {
    application = job;
    notes = job.notes;
    description = job.job_description;
    error = "";
    dialog.showModal();
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!application || saving || !changed) return;
    saving = true;
    error = "";
    try {
      application = await onsave(application.id, notes, description);
      notes = application.notes;
      description = application.job_description;
      dialog.close();
    } catch (cause) { error = cause instanceof Error ? cause.message : "Could not save these details. Please try again."; }
    finally { saving = false; }
  }
</script>

<dialog bind:this={dialog} class="modal" aria-labelledby="application-details-title" oncancel={(event) => { if (saving) event.preventDefault(); }}>
  <form class="modal-box w-11/12 max-w-3xl" onsubmit={submit}>
    <h2 id="application-details-title" class="card-title">Advanced information</h2>
    {#if application}
      <h3 class="mt-3 text-xl font-semibold break-words">{application.company}</h3>
      {#if application.role}<p class="break-words">{application.role}</p>{/if}
      <dl class="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div><dt class="font-semibold">Status</dt><dd class="mt-1"><span class={`badge ${applicationColumns.find((column) => column.status === application?.status)?.badge}`}>{applicationColumns.find((column) => column.status === application?.status)?.label}</span></dd></div>
        <div><dt class="font-semibold">Date applied</dt><dd class="mt-1"><time datetime={application.applied_on}>{new Date(`${application.applied_on}T12:00:00`).toLocaleDateString()}</time></dd></div>
        <div><dt class="font-semibold">Created</dt><dd class="mt-1">{new Date(application.created_at).toLocaleString()}</dd></div>
        <div><dt class="font-semibold">Last updated</dt><dd class="mt-1">{new Date(application.updated_at).toLocaleString()}</dd></div>
      </dl>
      <fieldset class="fieldset mt-4" disabled={saving}>
        <label class="fieldset-legend" for="application-detail-notes">Notes</label>
        <textarea id="application-detail-notes" class="textarea w-full" bind:value={notes} rows="3" maxlength="5000" placeholder="Anything you want to remember"></textarea>
        <label class="fieldset-legend" for="application-job-description">Job description</label>
        <textarea id="application-job-description" class="textarea w-full" bind:value={description} rows="10" maxlength="50000" placeholder="Paste the job description here"></textarea>
      </fieldset>
      {#if error}<div class="alert alert-error mt-3" role="alert">{error}</div>{/if}
      <div class="modal-action"><button type="button" class="btn btn-ghost" disabled={saving} onclick={() => dialog.close()}>Close</button><button type="submit" class="btn btn-primary" disabled={saving || !changed}>{saving ? "Saving..." : "Save changes"}</button></div>
    {/if}
  </form>
</dialog>
