<script lang="ts">
  import { onMount } from "svelte";
  import { isTauri } from "@tauri-apps/api/core";
  import { getApplicationStats, type ApplicationStats } from "../services/stats";

  let stats = $state<ApplicationStats | null>(null);
  let loading = $state(true);
  let desktop = $state(false);
  let error = $state("");
  let maxMonthlyCount = $derived(Math.max(1, ...stats?.months.map((month) => month.count) ?? []));

  onMount(() => {
    desktop = isTauri();
    if (desktop) void load();
    else loading = false;
  });

  async function load() {
    loading = true;
    error = "";
    try {
      stats = await getApplicationStats();
    } catch {
      error = "Could not load your stats. Please try again.";
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head><title>Stats — Sorrel</title></svelte:head>

<main class="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 lg:p-10">
  <div class="flex flex-wrap items-start justify-between gap-4">
    <div><h1 class="text-3xl font-bold">Your search at a glance</h1><p class="mt-2">See your progress, one application at a time.</p></div>
    <button class="btn btn-outline" disabled={!desktop || loading} onclick={load}>Refresh stats</button>
  </div>
  {#if !desktop && !loading}<div class="alert alert-info" role="status">Open the desktop app to see stats from your saved applications.</div>{/if}
  {#if error}<div class="alert alert-error" role="alert">{error}</div>{/if}
  {#if loading}
    <div class="flex justify-center py-20" role="status"><span class="loading loading-spinner loading-lg" aria-hidden="true"></span><span class="sr-only">Loading stats…</span></div>
  {:else if stats}
    <div class="stats stats-vertical bg-base-200 shadow-sm lg:stats-horizontal">
      <div class="stat"><div class="stat-title">Applications</div><div class="stat-value">{stats.total}</div><div class="stat-desc">Across {stats.companies} companies</div></div>
      <div class="stat"><div class="stat-title">Awaiting a decision</div><div class="stat-value text-info">{stats.counts.applied}</div><div class="stat-desc">Currently in Applied</div></div>
      <div class="stat"><div class="stat-title">Accepted</div><div class="stat-value text-success">{stats.counts.accepted}</div><div class="stat-desc">{stats.counts.rejected} rejected</div></div>
      <div class="stat"><div class="stat-title">Acceptance rate</div><div class="stat-value">{stats.acceptanceRate === null ? "—" : `${stats.acceptanceRate}%`}</div><div class="stat-desc">Accepted / decided applications</div></div>
    </div>
    {#if stats.total === 0}
      <div class="alert" role="status"><span>Add your first application to start seeing progress.</span><a href="/" class="btn btn-primary btn-sm">Go to applications</a></div>
    {/if}
    <div class="grid gap-6 xl:grid-cols-2">
      <section class="card card-border bg-base-100">
        <div class="card-body gap-5">
          <h2 class="card-title">Application activity</h2>
          <p class="text-sm">Applications submitted each month, based on the date applied.</p>
          {#each stats.months as month}
            <div class="flex items-center gap-3">
              <span class="w-24 shrink-0 text-sm">{month.label}</span>
              <progress class="progress progress-primary flex-1" value={month.count} max={maxMonthlyCount} aria-label={`${month.label}: ${month.count} applications`}></progress>
              <span class="badge badge-ghost">{month.count}</span>
            </div>
          {/each}
        </div>
      </section>
      <section class="card card-border bg-base-100">
        <div class="card-body gap-5">
          <h2 class="card-title">Current status</h2>
          <p class="text-sm">Where your applications stand today.</p>
          {#each [{ label: "Applied", count: stats.counts.applied, color: "progress-info" }, { label: "Rejected", count: stats.counts.rejected, color: "progress-error" }, { label: "Accepted", count: stats.counts.accepted, color: "progress-success" }] as item}
            <div>
              <div class="mb-2 flex justify-between gap-3"><span>{item.label}</span><span>{item.count} · {stats.total ? Math.round(item.count / stats.total * 100) : 0}%</span></div>
              <progress class={`progress ${item.color} w-full`} value={item.count} max={Math.max(stats.total, 1)} aria-label={`${item.label}: ${item.count} of ${stats.total}`}></progress>
            </div>
          {/each}
        </div>
      </section>
    </div>
  {/if}
</main>
