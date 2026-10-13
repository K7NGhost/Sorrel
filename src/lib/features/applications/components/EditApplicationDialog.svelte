<script lang="ts">
  import NotificationToast from "$lib/shared/components/NotificationToast.svelte";
  import type { JobApplication, NewApplication } from "../types";
  let { onsave }: { onsave: (id: string, input: NewApplication) => Promise<void> } = $props();
  let dialog: HTMLDialogElement;
  let application = $state<JobApplication>();
  let company = $state("");
  let role = $state("");
  let appliedOn = $state("");
  let notes = $state("");
  let description = $state("");
  let saving = $state(false);
  let error = $state("");

  export function open(job: JobApplication) {
    application = job;
    company = job.company;
    role = job.role;
    appliedOn = job.applied_on;
    notes = job.notes;
    description = job.job_description;
    error = "";
    dialog.showModal();
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!application || saving) return;
    saving = true;
    error = "";
    try {
      await onsave(application.id, { company, role, applied_on: appliedOn, notes, job_description: description });
      dialog.close();
    } catch (cause) { error = cause instanceof Error ? cause.message : "Could not save your changes. Please try again."; }
    finally { saving = false; }
  }
</script>

<dialog bind:this={dialog} class="modal" aria-labelledby="edit-application-title" oncancel={(event) => { if (saving) event.preventDefault(); }}>
  <form class="modal-box max-w-3xl" onsubmit={submit}>
    <h2 id="edit-application-title" class="card-title">Edit application</h2>
    <fieldset class="fieldset mt-4" disabled={saving}>
      <label class="fieldset-legend" for="edit-company">Company *</label>
      <input id="edit-company" class="input w-full" bind:value={company} required maxlength="200" />
      <label class="fieldset-legend" for="edit-role">Role</label>
      <input id="edit-role" class="input w-full" bind:value={role} maxlength="200" />
      <label class="fieldset-legend" for="edit-applied-on">Date applied *</label>
      <input id="edit-applied-on" class="input w-full" type="date" bind:value={appliedOn} required />
      <label class="fieldset-legend" for="edit-notes">Notes</label>
      <textarea id="edit-notes" class="textarea w-full" bind:value={notes} rows="3" maxlength="5000"></textarea>
      <label class="fieldset-legend" for="edit-description">Job description</label>
      <textarea id="edit-description" class="textarea w-full" bind:value={description} rows="6" maxlength="50000" placeholder="Paste the job description here"></textarea>
    </fieldset>
    <div class="modal-action"><button type="button" class="btn btn-ghost" disabled={saving} onclick={() => dialog.close()}>Cancel</button><button type="submit" class="btn btn-primary" disabled={saving || !company.trim()}>{saving ? "Saving..." : "Save changes"}</button></div>
  </form>
  <div class="toast toast-bottom toast-end pointer-events-none">{#if error}<NotificationToast text={error} kind="error" duration={10000} />{/if}</div>
</dialog>
