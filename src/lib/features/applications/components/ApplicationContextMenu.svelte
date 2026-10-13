<script lang="ts">
  import Info from "@lucide/svelte/icons/info";
  import type { JobApplication } from "../types";
  let { ondetails }: { ondetails: (application: JobApplication) => void } = $props();
  let menu: HTMLDivElement;
  let item: HTMLButtonElement;
  let application = $state<JobApplication>();
  let x = $state(0);
  let y = $state(0);

  export function open(job: JobApplication, clientX: number, clientY: number) {
    application = job;
    x = Math.max(8, Math.min(clientX, window.innerWidth - 232));
    y = Math.max(8, Math.min(clientY, window.innerHeight - 64));
    menu.showPopover();
    item.focus();
  }

  function showDetails() {
    menu.hidePopover();
    if (application) ondetails(application);
  }
</script>

<div bind:this={menu} popover="auto" class="fixed m-0 w-56 rounded-box border border-base-300 bg-base-100 p-1 text-base-content shadow-lg" style:left={`${x}px`} style:top={`${y}px`} role="menu" aria-label="Job actions" tabindex="-1" onkeydown={(event) => {
  if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) { event.preventDefault(); item.focus(); }
  if (event.key === "Tab") menu.hidePopover();
}}>
  <button bind:this={item} class="btn btn-ghost btn-sm w-full justify-start" role="menuitem" onclick={showDetails}><Info size={16} aria-hidden="true" />Advanced information</button>
</div>
