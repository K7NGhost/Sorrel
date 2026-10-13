<script lang="ts">
  import type { NewApplication } from "../types";

  let { onsave }: { onsave: (input: NewApplication) => Promise<void> } = $props();
  let dialog: HTMLDialogElement;
  let company = $state("");
  let role = $state("");
  let notes = $state("");
  let description = $state("");
  let appliedOn = $state("");
  let saving = $state(false);
  let error = $state("");

  export function open() {
    company = "";
    role = "";
    notes = "";
    description = "";
    const today = new Date();
    appliedOn = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    error = "";
    dialog.showModal();
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (saving) return;
    saving = true;
    error = "";
    try {
      await onsave({ company, role, notes, applied_on: appliedOn, job_description: description });
      dialog.close();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Could not save the application. Please try again.";
    } finally {
      saving = false;
    }
  }
</script>

<dialog bind:this={dialog} class="modal" aria-labelledby="add-application-title" oncancel={(event) => { if (saving) event.preventDefault(); }}>
  <div class="modal-box">
    <h2 id="add-application-title" class="card-title">Add an application</h2>
    <p class="mt-2 text-sm">Every new application starts in Applied.</p>
    <form onsubmit={submit} class="mt-4 flex flex-col gap-4">
      <fieldset class="fieldset" disabled={saving}>
        <label class="fieldset-legend" for="company">Company *</label>
        <input id="company" class="input w-full" bind:value={company} placeholder="Company name" required maxlength="200" />
        <label class="fieldset-legend" for="role">Role</label>
        <input id="role" class="input w-full" bind:value={role} placeholder="e.g. Frontend developer" maxlength="200" />
        <label class="fieldset-legend" for="applied-on">Date applied *</label>
        <input id="applied-on" class="input w-full" type="date" bind:value={appliedOn} required />
        <label class="fieldset-legend" for="notes">Notes</label>
        <textarea id="notes" class="textarea w-full" bind:value={notes} placeholder="Anything you want to remember" rows="3" maxlength="5000"></textarea>
        <label class="fieldset-legend" for="new-job-description">Job description</label>
        <textarea id="new-job-description" class="textarea w-full" bind:value={description} placeholder="Paste the job description here" rows="6" maxlength="50000"></textarea>
      </fieldset>
      {#if error}<div class="alert alert-error" role="alert"><span>{error}</span></div>{/if}
      <div class="modal-action mt-0">
        <button type="button" class="btn btn-ghost" disabled={saving} onclick={() => dialog.close()}>Cancel</button>
        <button type="submit" class="btn btn-primary" disabled={saving || !company.trim()}>
          {#if saving}<span class="loading loading-spinner loading-xs"></span>{/if}
          {saving ? "Saving…" : "Add application"}
        </button>
      </div>
    </form>
  </div>
</dialog>
