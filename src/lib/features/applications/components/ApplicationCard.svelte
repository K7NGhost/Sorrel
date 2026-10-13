<script lang="ts">
  import type { JobApplication } from "../types";
  import { dragHandle } from "svelte-dnd-action";
  import GripVertical from "@lucide/svelte/icons/grip-vertical";

  let { application, disabled, ondetails, oncontext }: {
    application: JobApplication;
    disabled: boolean;
    ondetails: (application: JobApplication) => void;
    oncontext: (application: JobApplication, event: MouseEvent | KeyboardEvent) => void;
  } = $props();

  function context(event: MouseEvent | KeyboardEvent) {
    event.preventDefault();
    if (!disabled) oncontext(application, event);
  }
</script>

<article class="card card-border bg-base-100 shadow-sm" oncontextmenu={context}>
  <div class="card-body p-4">
    <div class="flex items-start gap-3">
      <div class="min-w-0 flex-1">
        <h3 class="card-title break-words" aria-label={application.company}><button class="text-left" {disabled} aria-label={`View details for ${application.company}`} title="View advanced information" onclick={() => ondetails(application)} onkeydown={(event) => { if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) context(event); }}>{application.company}</button></h3>
        {#if application.role}<p class="mt-1 break-words">{application.role}</p>{/if}
      </div>
      <div use:dragHandle role="button" tabindex={disabled ? -1 : 0} class="btn btn-ghost btn-square btn-sm drag-handle" aria-disabled={disabled} aria-label={`Drag ${application.company}${application.role ? `, ${application.role}` : ""}`} title="Drag to move - Space or Enter to pick up">
        <GripVertical size={20} aria-hidden="true" />
      </div>
    </div>
    <p class="text-sm opacity-70">Applied <time datetime={application.applied_on}>{new Date(`${application.applied_on}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time></p>
  </div>
</article>

<style>
  .drag-handle { touch-action: none; }
  .drag-handle[aria-disabled="false"] { cursor: grab; }
  .drag-handle[aria-disabled="false"]:active { cursor: grabbing; }
  .drag-handle[aria-disabled="true"] { pointer-events: none; }
</style>
