<script lang="ts">
  import { onDestroy } from "svelte";
  import type { PDFDocumentProxy, PDFDocumentLoadingTask, RenderTask } from "pdfjs-dist";
  import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

  let { data, onerror }: { data: Uint8Array; onerror?: (message: string) => void } = $props();
  let canvas = $state<HTMLCanvasElement>();
  let pdf = $state<PDFDocumentProxy>();
  let pageNumber = $state(1);
  let zoom = $state("fit");
  let container = $state<HTMLDivElement>();
  let containerWidth = $state(0);
  let containerHeight = $state(0);
  let loading = $state(false);
  let error = $state("");
  let text = $state("");
  $effect(() => { if (error) onerror?.(error); });

  let task: PDFDocumentLoadingTask | undefined;
  let renderingTask: RenderTask | undefined;
  let renderQueue = Promise.resolve();

  $effect(() => {
    const node = container;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      containerWidth = node.clientWidth;
      containerHeight = node.clientHeight;
    });
    observer.observe(node);
    return () => observer.disconnect();
  });

  $effect(() => {
    const bytes = data;
    let canceled = false;
    loading = true;
    error = "";
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        if (canceled) return;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        const previous = task;
        const current = pdfjs.getDocument({ data: bytes.slice() });
        task = current;
        const document = await current.promise;
        if (canceled) { await current.destroy(); return; }
        pdf = document;
        pageNumber = 1;
        await previous?.destroy();
      } catch (cause) {
        if (!canceled) error = cause instanceof Error ? cause.message : "Could not display this PDF.";
      } finally { if (!canceled) loading = false; }
    })();
    return () => { canceled = true; };
  });

  $effect(() => {
    const document = pdf;
    const node = canvas;
    const number = pageNumber;
    const mode = zoom;
    const width = containerWidth;
    const height = containerHeight;
    if (!document || !node || !width || !height) return;
    let canceled = false;
    renderingTask?.cancel();
    renderQueue = renderQueue.catch(() => {}).then(async () => {
      if (canceled) return;
      try {
        const page = await document.getPage(number);
        const content = await page.getTextContent();
        if (canceled) return;
        text = content.items.map((item) => "str" in item ? item.str : "").join(" ");
        const pixelRatio = window.devicePixelRatio || 1;
        const base = page.getViewport({ scale: 1 });
        const fitWidth = Math.max(1, width - 16) / base.width;
        const fitHeight = Math.max(1, height - 16) / base.height;
        const scale = mode === "fit" ? Math.min(fitWidth, fitHeight) : mode === "width" ? fitWidth : Number(mode) / 100;
        const viewport = page.getViewport({ scale: scale * pixelRatio });
        node.width = viewport.width;
        node.height = viewport.height;
        node.style.width = `${viewport.width / pixelRatio}px`;
        node.style.height = `${viewport.height / pixelRatio}px`;
        renderingTask = page.render({ canvas: node, viewport });
        await renderingTask.promise;
      } catch (cause) {
        if (!canceled && !(cause instanceof Error && cause.name === "RenderingCancelledException")) error = "Could not render this PDF page.";
      }
    });
    return () => { canceled = true; renderingTask?.cancel(); };
  });

  onDestroy(() => { renderingTask?.cancel(); void task?.destroy(); });
</script>

<div class="flex h-full min-h-0 flex-col">
  <div class="flex shrink-0 flex-wrap items-center justify-between gap-2 pb-3">
    <div class="join">
      <button class="btn btn-sm join-item" aria-label="Previous PDF page" disabled={!pdf || pageNumber <= 1} onclick={() => pageNumber--}>‹</button>
      <span class="btn btn-sm join-item pointer-events-none">{pageNumber} / {pdf?.numPages ?? "—"}</span>
      <button class="btn btn-sm join-item" aria-label="Next PDF page" disabled={!pdf || pageNumber >= pdf.numPages} onclick={() => pageNumber++}>›</button>
    </div>
    <label class="select select-sm w-40"><span class="sr-only">PDF zoom</span><select aria-label="PDF zoom" bind:value={zoom}><option value="fit">Fit to container</option><option value="width">Fit width</option><option value="75">75%</option><option value="100">100%</option><option value="125">125%</option><option value="150">150%</option></select></label>
  </div>
  {#if loading}<p role="status" class="flex items-center gap-2"><span class="loading loading-spinner loading-xs"></span>Loading PDF…</p>{/if}
  <div bind:this={container} class="min-h-0 flex-1 overflow-auto rounded-box" data-testid="pdf-viewport">
    <canvas bind:this={canvas} aria-label={`Resume PDF page ${pageNumber}`} class="mx-auto my-2 block bg-white shadow-sm"></canvas>
    <p class="sr-only" aria-live="polite">{text}</p>
  </div>
</div>
