<script lang="ts">
  import { page } from "$app/state";
  import { afterNavigate } from "$app/navigation";
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";
  import ThemeSwitcher from "./ThemeSwitcher.svelte";

  let { children }: { children: Snippet } = $props();
  let expanded = $state(false);
  let boundedPage = $derived(page.url.pathname === "/" || page.url.pathname.replace(/\/$/, "") === "/resume-builder");
  const links = [
    { href: "/", label: "Applications", icon: "board" },
    { href: "/stats", label: "Stats", icon: "chart" },
    { href: "/profile", label: "Profile", icon: "user" },
    { href: "/resume-builder", label: "Resume Builder", icon: "file" },
  ] as const;
  let activePage = $derived(links.find((link) => link.href === page.url.pathname.replace(/\/$/, "") || (link.href === "/" && page.url.pathname === "/"))?.label ?? "Sorrel");

  afterNavigate(() => {
    if (window.matchMedia("(max-width: 1023px)").matches) expanded = false;
  });
</script>

<div class="drawer lg:drawer-open min-h-screen bg-base-100" class:h-dvh={boundedPage} class:overflow-hidden={boundedPage}>
  <input id="app-drawer" type="checkbox" class="drawer-toggle" bind:checked={expanded} aria-label="Expand sidebar" />
  <div class="drawer-content flex min-h-0 min-w-0 flex-col">
    <header class="navbar h-11 min-h-0 bg-base-300 shrink-0 gap-2 px-3 py-1">
      <button type="button" class="btn btn-sm btn-square btn-ghost drawer-button" aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"} aria-expanded={expanded} aria-controls="app-sidebar" onclick={() => expanded = !expanded}>
        <Icon name="sidebar" />
      </button>
      <div class="flex-1 px-1 text-sm font-semibold">{activePage}</div>
      <ThemeSwitcher />
      <span class="badge badge-sm badge-ghost">Sorrel</span>
    </header>
    {@render children()}
  </div>
  <div class="drawer-side is-drawer-close:overflow-visible">
    <label for="app-drawer" aria-label="Close sidebar" class="drawer-overlay"></label>
    <aside id="app-sidebar" class="bg-base-200 flex min-h-full flex-col items-start is-drawer-close:w-14 is-drawer-open:w-64">
      <a href="/" class="btn btn-ghost m-2 gap-3 px-2 is-drawer-close:w-10 is-drawer-close:px-1" aria-label="Sorrel applications">
        <img src="/app-icon.png" alt="" class="size-8 shrink-0 object-contain" width="32" height="32" />
        <span class="is-drawer-close:hidden text-lg">Sorrel</span>
      </a>
      <nav class="w-full grow" aria-label="Main navigation">
        <ul class="menu w-full gap-1">
          {#each links as link}
            <li>
              <a href={link.href} class="is-drawer-close:tooltip is-drawer-close:tooltip-right" class:menu-active={activePage === link.label} data-tip={link.label} aria-label={link.label} aria-current={activePage === link.label ? "page" : undefined}>
                <Icon name={link.icon} />
                <span class="is-drawer-close:hidden">{link.label}</span>
              </a>
            </li>
          {/each}
        </ul>
      </nav>
      <p class="p-4 text-sm is-drawer-close:hidden">Your next move, organized.</p>
    </aside>
  </div>
</div>
