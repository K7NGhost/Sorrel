<script lang="ts">
  import { fade } from "svelte/transition";
  import X from "@lucide/svelte/icons/x";

  let { text, kind = "success", title = "", duration = 6000, actionLabel = "", onaction }: {
    text: string;
    kind?: "success" | "error" | "warning";
    title?: string;
    duration?: number;
    actionLabel?: string;
    onaction?: () => void;
  } = $props();
  let visible = $state(true);
  let hovered = $state(false);
  let focused = $state(false);
  const styles = { success: "alert-success", error: "alert-error", warning: "alert-warning" };

  $effect(() => {
    text;
    kind;
    visible = true;
  });
  $effect(() => {
    text;
    kind;
    if (!visible || hovered || focused || duration <= 0) return;
    const timer = setTimeout(() => visible = false, duration);
    return () => clearTimeout(timer);
  });
</script>

{#if visible}
  <div class={`alert ${styles[kind]} pointer-events-auto w-80 max-w-[calc(100vw-2rem)] shadow-lg`} role={kind === "error" ? "alert" : "status"} transition:fade={{ duration: 120 }}
    onpointerenter={() => hovered = true} onpointerleave={() => hovered = false} onfocusin={() => focused = true} onfocusout={() => focused = false}>
    <div class="min-w-0">
      {#if title}<p class="font-semibold">{title}</p>{/if}
      <p class="max-h-40 overflow-auto whitespace-pre-wrap break-words text-sm">{text}</p>
      {#if actionLabel && onaction}<button class="btn btn-xs mt-2" onclick={onaction}>{actionLabel}</button>{/if}
    </div>
    <button class="btn btn-xs btn-square btn-ghost self-start" aria-label="Dismiss notification" onclick={() => visible = false}><X size={14} aria-hidden="true" /></button>
  </div>
{/if}
