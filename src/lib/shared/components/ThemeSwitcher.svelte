<script lang="ts">
  import { onMount } from "svelte";

  let dark = $state(false);

  onMount(() => {
    dark = document.documentElement.getAttribute("data-theme") === "obsidian";
  });

  function changeTheme(event: Event) {
    dark = (event.currentTarget as HTMLInputElement).checked;
    const theme = dark ? "obsidian" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("sorrel-theme", theme);
    } catch {
      // Keep the selection active for this session if storage is unavailable.
    }
  }
</script>

<label class="flex items-center gap-2" title="Switch between Light and Obsidian">
  <span class="text-sm">Light</span>
  <input
    type="checkbox"
    class="toggle toggle-sm theme-controller"
    value="obsidian"
    checked={dark}
    onchange={changeTheme}
    aria-label="Dark mode (Obsidian)"
  />
  <span class="text-sm">Dark</span>
</label>
