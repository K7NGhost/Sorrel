<script lang="ts">
  import Info from "@lucide/svelte/icons/info";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import type { JobApplication } from "../types";
  let { ondetails, onedit, ondelete }: {
    ondetails: (application: JobApplication) => void;
    onedit: (application: JobApplication) => void;
    ondelete: (application: JobApplication) => void;
  } = $props();
  let menu: HTMLDivElement;
  let item: HTMLButtonElement;
  let application = $state<JobApplication>();
  let x = $state(0);
  let y = $state(0);

  export function open(job: JobApplication, clientX: number, clientY: number) {
    application = job;
    x = Math.max(8, Math.min(clientX, window.innerWidth - 232));
    y = Math.max(8, Math.min(clientY, window.innerHeight - 128));
    menu.showPopover();
    item.focus();
  }

  function choose(action: (job: JobApplication) => void) {
    menu.hidePopover();
    if (application) action(application);
  }

  function keys(event: KeyboardEvent) {
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const items = Array.from(menu.querySelectorAll<HTMLButtonElement>("[role=menuitem]"));
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    }
    if (event.key === "Tab") menu.hidePopover();
  }
</script>

<div bind:this={menu} popover="auto" class="fixed m-0 w-56 rounded-box border border-base-300 bg-base-100 p-1 text-base-content shadow-lg" style:left={`${x}px`} style:top={`${y}px`} role="menu" aria-label="Job actions" tabindex="-1" onkeydown={keys}>
  <button bind:this={item} class="btn btn-ghost btn-sm w-full justify-start" role="menuitem" onclick={() => choose(ondetails)}><Info size={16} aria-hidden="true" />Advanced information</button>
  <button class="btn btn-ghost btn-sm w-full justify-start" role="menuitem" onclick={() => choose(onedit)}><Pencil size={16} aria-hidden="true" />Edit</button>
  <button class="btn btn-ghost btn-sm w-full justify-start text-error" role="menuitem" onclick={() => choose(ondelete)}><Trash2 size={16} aria-hidden="true" />Delete</button>
</div>
