<script lang="ts">
  import Panel from "$lib/shared/components/ResizablePanel.svelte";
  import type { Snippet } from "svelte";
  let { children }: { children: Snippet } = $props();
</script>
<Panel {children} />
