<script lang="ts">
  import { onMount } from "svelte";
  import type { Snippet } from "svelte";
  let { children, storageKey = "sorrel-resume-tree-width", label = "LaTeX files", panelId = "resume-file-panel", initialWidth = 176 }: { children: Snippet; storageKey?: string; label?: string; panelId?: string; initialWidth?: number } = $props();
  let width = $state(176);
  let resizing = $state(false);
  let startX = 0;
  let startWidth = 176;
  const minimum = 160;
  const maximum = 480;

  onMount(() => {
    width = initialWidth;
    try {
      const saved = Number(localStorage.getItem(storageKey));
      if (saved >= minimum && saved <= maximum) width = saved;
    } catch { /* Resizing remains available without persistence. */ }
  });

  function resize(value: number) { width = Math.round(Math.max(minimum, Math.min(maximum, value))); }
  function remember() { try { localStorage.setItem(storageKey, String(width)); } catch { /* Optional preference. */ } }
  function start(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    startX = event.clientX;
    startWidth = width;
    resizing = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  function end() { if (resizing) { resizing = false; remember(); } }
</script>

<aside id={panelId} class="flex min-h-0 shrink-0 flex-col bg-base-200" style:width={`${width}px`} aria-label={label}>
  {@render children()}
</aside>
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (This separator is an interactive resize handle with keyboard controls.) -->
<div class="w-1 shrink-0 cursor-col-resize touch-none bg-base-300 hover:bg-primary focus-visible:bg-primary focus-visible:outline-none" class:bg-primary={resizing} role="separator" tabindex="0" aria-label="Resize file tree" aria-orientation="vertical" aria-controls={panelId} aria-valuemin={minimum} aria-valuemax={maximum} aria-valuenow={width}
  onpointerdown={start} onpointermove={(event) => { if (resizing) resize(startWidth + event.clientX - startX); }} onpointerup={end} onpointercancel={end} onlostpointercapture={end}
  onkeydown={(event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    resize(event.key === "Home" ? minimum : event.key === "End" ? maximum : width + (event.key === "ArrowRight" ? 1 : -1) * (event.shiftKey ? 40 : 16));
    remember();
  }}></div>
