<script lang="ts">
  import PanelLeft from "@lucide/svelte/icons/panel-left";
  import Columns3 from "@lucide/svelte/icons/columns-3";
  import ChartColumn from "@lucide/svelte/icons/chart-column";
  import UserRound from "@lucide/svelte/icons/user-round";
  import FileText from "@lucide/svelte/icons/file-text";

  let { name }: { name: "sidebar" | "board" | "chart" | "user" | "file" } = $props();
  const icons = { sidebar: PanelLeft, board: Columns3, chart: ChartColumn, user: UserRound, file: FileText };
  let Component = $derived(icons[name]);
</script>

<Component size={20} class="inline-block shrink-0" aria-hidden="true" />
