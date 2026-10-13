<script lang="ts">
  import { onMount } from "svelte";
  import { SOURCES, TRIGGERS, SHADOW_ITEM_MARKER_PROPERTY_NAME, type DndEvent } from "svelte-dnd-action";
  import ApplicationColumn from "./ApplicationColumn.svelte";
  import { applicationColumns, type ApplicationStatus, type JobApplication } from "../types";

  type DragApplication = JobApplication & { isDndShadowItem?: boolean };
  type Zones = Record<ApplicationStatus, DragApplication[]>;

  let { applications, disabled, onmove, oninteraction, ondetails, oncontext }: {
    applications: JobApplication[];
    disabled: boolean;
    onmove: (id: string, status: ApplicationStatus, visibleOrder?: string[]) => Promise<boolean>;
    oninteraction: (active: boolean) => void;
    ondetails: (application: JobApplication) => void;
    oncontext: (application: JobApplication, event: MouseEvent | KeyboardEvent) => void;
  } = $props();

  let zones = $state<Zones>({ applied: [], rejected: [], accepted: [] });
  let dragging = $state(false);
  let saving = $state(false);
  let reducedMotion = $state(false);
  let duration = $derived(reducedMotion ? 0 : 240);

  function reset() {
    zones = {
      applied: applications.filter((item) => item.status === "applied"),
      rejected: applications.filter((item) => item.status === "rejected"),
      accepted: applications.filter((item) => item.status === "accepted"),
    };
  }

  $effect(() => { if (!dragging && !saving) reset(); });
  $effect(() => { oninteraction(dragging || saving); });

  onMount(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { reducedMotion = query.matches; };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  });

  function consider(status: ApplicationStatus, detail: DndEvent<DragApplication>) {
    if (saving) return;
    zones[status] = detail.items;
    if (detail.info.trigger === TRIGGERS.DRAG_STOPPED) {
      void commit(status, detail.info.id, detail.items);
    } else {
      dragging = true;
    }
  }

  function finalize(status: ApplicationStatus, detail: DndEvent<DragApplication>) {
    zones[status] = detail.items;
    // Both source and destination finalize; only the destination saves.
    if (detail.info.trigger === TRIGGERS.DROPPED_INTO_ANOTHER) return;
    if (detail.info.trigger === TRIGGERS.DROPPED_OUTSIDE_OF_ANY) {
      dragging = false;
      reset();
      return;
    }
    // Keyboard drags finalize each arrow/Tab move. Save once when the user drops.
    if (detail.info.source === SOURCES.KEYBOARD) return;
    void commit(status, detail.info.id, detail.items);
  }

  async function commit(status: ApplicationStatus, id: string, items: DragApplication[]) {
    if (saving) return;
    saving = true;
    dragging = false;
    try {
      const order = items.filter((item) => !item[SHADOW_ITEM_MARKER_PROPERTY_NAME]).map((item) => item.id);
      if (order.includes(id)) await onmove(id, status, order);
    } finally {
      saving = false;
      reset();
    }
  }

</script>

<div class="min-h-0 flex-1 overflow-x-auto pb-2">
<div class="grid h-full min-h-0 grid-cols-[repeat(3,minmax(18rem,1fr))] items-stretch gap-5" aria-busy={saving}>
  {#each applicationColumns as column}
    <ApplicationColumn {column} applications={zones[column.status]} disabled={disabled || saving} {duration} {dragging} onconsider={consider} onfinalize={finalize} ondetails={(application) => { if (!dragging && !saving && !disabled) ondetails(application); }} oncontext={(application, event) => { if (!dragging && !saving && !disabled) oncontext(application, event); }} />
  {/each}
</div>
</div>
