<script lang="ts">
  import { flip } from "svelte/animate";
  import { cubicOut } from "svelte/easing";
  import { dragHandleZone, SHADOW_ITEM_MARKER_PROPERTY_NAME, type DndEvent } from "svelte-dnd-action";
  import ApplicationCard from "./ApplicationCard.svelte";
  import { applicationColumns, type ApplicationStatus, type JobApplication } from "../types";

  type DragApplication = JobApplication & { isDndShadowItem?: boolean };

  let { column, applications, disabled, duration, dragging, onconsider, onfinalize, ondetails, oncontext }: {
    column: (typeof applicationColumns)[number];
    applications: DragApplication[];
    disabled: boolean;
    duration: number;
    dragging: boolean;
    onconsider: (status: ApplicationStatus, detail: DndEvent<DragApplication>) => void;
    onfinalize: (status: ApplicationStatus, detail: DndEvent<DragApplication>) => void;
    ondetails: (application: JobApplication) => void;
    oncontext: (application: JobApplication, event: MouseEvent | KeyboardEvent) => void;
  } = $props();

  let hasPlaceholder = $derived(applications.some((application) => application[SHADOW_ITEM_MARKER_PROPERTY_NAME]));
</script>

<section class="card card-border bg-base-200 min-h-0 h-full overflow-hidden board-column" class:column-active={hasPlaceholder} aria-label={`${column.label} applications`}>
  <div class="card-body min-h-0 gap-4 p-4">
    <div class="flex shrink-0 items-center justify-between gap-2">
      <h2 class="card-title">{column.label}</h2>
      <span class={`badge ${column.badge}`}>{applications.length}</span>
    </div>
    <p class="text-sm grow-0 shrink-0">{dragging ? `Drop here to move to ${column.label}.` : column.hint}</p>
    <div class="relative flex min-h-0 flex-1 flex-col">
      <div
        class="flex min-h-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto overscroll-contain rounded-box p-1"
        aria-label={`${column.label} column`}
        use:dragHandleZone={{
          items: applications,
          type: "job-applications",
          flipDurationMs: duration,
          dragDisabled: disabled,
          dropFromOthersDisabled: disabled,
          dropTargetStyle: { outline: "2px solid var(--color-primary)", outlineOffset: "4px" },
          delayTouchStart: 120,
          useCursorForDetection: true,
          dropAnimationDisabled: duration === 0,
          transformDraggedElement: (element) => element?.classList.add("application-drag-floating"),
        }}
        onconsider={(event) => onconsider(column.status, event.detail)}
        onfinalize={(event) => onfinalize(column.status, event.detail)}
      >
        {#each applications as application (application.id)}
          <div
            class="drag-item shrink-0"
            class:drag-placeholder={!!application[SHADOW_ITEM_MARKER_PROPERTY_NAME]}
            aria-label={`${application.company}${application.role ? `, ${application.role}` : ""}`}
            animate:flip={{ duration, easing: cubicOut }}
          >
            <ApplicationCard application={{ ...application, status: column.status }} disabled={disabled || !!application[SHADOW_ITEM_MARKER_PROPERTY_NAME]} {ondetails} {oncontext} />
          </div>
        {/each}
      </div>
      {#if applications.length === 0}
        <div class="card card-dash bg-base-100 pointer-events-none absolute inset-x-0 top-0">
          <div class="card-body items-center py-10 text-center">
            <p>No applications yet</p>
            <p class="text-sm">{column.status === "applied" ? "Add a company to get started." : "Move an application here when its status changes."}</p>
          </div>
        </div>
      {/if}
    </div>
  </div>
</section>

<style>
  .board-column { transition: border-color 180ms ease, background-color 180ms ease; }
  .column-active { border-color: var(--color-primary); background: color-mix(in oklch, var(--color-primary) 9%, var(--color-base-200)); }
  .drag-item { border-radius: var(--radius-box); }
  .drag-placeholder { outline: 2px dashed var(--color-primary); outline-offset: -2px; background: color-mix(in oklch, var(--color-primary) 10%, transparent); }
  .drag-placeholder :global(.card) { opacity: 0; }
  :global(.application-drag-floating .card) {
    border-color: var(--color-primary);
    box-shadow: 0 18px 42px rgb(0 0 0 / 25%), 0 4px 12px rgb(0 0 0 / 15%);
    transform: rotate(1deg) scale(1.025);
    transition: transform 180ms ease, box-shadow 180ms ease;
  }
  @media (prefers-reduced-motion: reduce) {
    .board-column, :global(.application-drag-floating .card) { transition: none; }
    :global(.application-drag-floating .card) { transform: none; }
  }
</style>
