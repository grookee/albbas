<script lang="ts">
  import { resolve } from '$app/paths';
  import { auth } from '$lib/auth.svelte';
  import { trpc, errorMessage } from '$lib/trpc';
  import { formatBytes, formatDate } from '$lib/format';
  import { confirm, alert } from '$lib/confirm.svelte';
  import FileIcon from '$lib/ui/FileIcon.svelte';
  import CopyButton from '$lib/ui/CopyButton.svelte';

  type UploadItem = {
    id: string;
    slug: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    url: string;
    createdAt: string;
  };

  const PAGE_SIZE = 24;
  const skeletonTiles = Array.from({ length: PAGE_SIZE }, (_, i) => i);

  let items = $state<UploadItem[]>([]);
  let page = $state(1);
  let totalPages = $state(1);
  let total = $state(0);
  let started = $state(false);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let deletingId = $state<string | null>(null);
  let failed = $state<Record<string, boolean>>({});

  async function load(silent = false): Promise<string | null> {
    if (!silent) loading = true;
    error = null;
    try {
      const res = await trpc.uploads.gallery.query({ page, limit: PAGE_SIZE });
      items = res.items;
      totalPages = res.totalPages;
      total = res.total;
      return null;
    } catch (err) {
      const message = errorMessage(err);
      if (!silent) error = message;
      return message;
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (auth.ready && auth.user && !started) {
      started = true;
      void load();
    }
  });

  function goTo(next: number): void {
    if (next < 1 || next > totalPages || next === page) return;
    page = next;
    failed = {};
    void load();
  }

  function pageNumbers(): (number | '…')[] {
    const pages: (number | '…')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    const window = new Set([1, totalPages, page - 1, page, page + 1]);
    let prev = 0;
    for (let i = 1; i <= totalPages; i++) {
      if (!window.has(i)) continue;
      if (prev && i - prev > 1) pages.push('…');
      pages.push(i);
      prev = i;
    }
    return pages;
  }

  function markFailed(id: string): void {
    failed[id] = true;
  }

  function ext(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(dot + 1).slice(0, 8) : 'file';
  }

  function isImage(mime: string): boolean {
    return mime.startsWith('image/');
  }

  function isVideo(mime: string): boolean {
    return mime.startsWith('video/');
  }

  async function onDelete(upload: UploadItem): Promise<void> {
    if (!(await confirm(`Delete "${upload.originalName}"?`, { confirmLabel: 'delete' }))) return;
    deletingId = upload.id;
    error = null;
    try {
      await trpc.uploads.delete.mutate({ slug: upload.slug });
      items = items.filter((u) => u.id !== upload.id);
      total = total - 1;
      if (items.length === 0 && page > 1) {
        page = page - 1;
        failed = {};
        await load();
      } else {
        const message = await load(true);
        if (message) await alert(message);
      }
    } catch (err) {
      await alert(errorMessage(err));
    } finally {
      deletingId = null;
    }
  }
</script>

<svelte:head>
  <title>gallery — albbas</title>
</svelte:head>

{#if !auth.ready}
  <div class="muted">loading…</div>
{:else if !auth.user}
  <p>please <a href={resolve('/login')}>log in</a>.</p>
{:else}
  <section class="card">
    <div class="card-head">
      <h2>gallery</h2>
      {#if total > 0}
        <span class="muted-note">{total} {total === 1 ? 'file' : 'files'}</span>
      {/if}
    </div>

    {#if loading}
      <div class="gallery-grid" aria-hidden="true">
        {#each skeletonTiles as i (i)}
          <div class="gallery-item">
            <div class="skeleton skeleton-block"></div>
            <div class="gallery-meta">
              <div class="skeleton skeleton-line" style="width: 80%"></div>
              <div class="skeleton skeleton-line" style="width: 55%"></div>
            </div>
          </div>
        {/each}
      </div>
    {:else if error}
      <p class="error">{error}</p>
    {:else if items.length === 0}
      <p class="muted">nothing here yet.</p>
    {:else}
      <div class="gallery-grid">
        {#each items as upload (upload.id)}
          <div class="gallery-item">
            <a class="gallery-thumb" href={upload.url} target="_blank" rel="external noreferrer">
              {#if isImage(upload.mimeType) && !failed[upload.id]}
                <img src={upload.url} alt={upload.originalName} loading="lazy" onerror={() => markFailed(upload.id)} />
              {:else if isVideo(upload.mimeType) && !failed[upload.id]}
                <!-- svelte-ignore a11y_media_has_caption -->
                <video
                  src={upload.url}
                  controls
                  preload="metadata"
                  onerror={() => markFailed(upload.id)}
                ></video>
              {:else}
                <div class="gallery-placeholder">
                  <FileIcon mime={upload.mimeType} />
                  <span class="ext">{ext(upload.originalName)}</span>
                </div>
              {/if}
            </a>
            <div class="gallery-meta">
              <a class="gallery-name" href={upload.url} target="_blank" rel="external noreferrer">
                {upload.originalName}
              </a>
              <span class="gallery-sub">
                {formatBytes(upload.sizeBytes)} · {formatDate(upload.createdAt)}
              </span>
              <div class="gallery-actions">
                <CopyButton text={upload.url} />
                <a class="btn btn-secondary btn-sm" href={upload.url} target="_blank" rel="external noreferrer"
                  >open</a
                >
                <button
                  class="btn btn-danger btn-sm"
                  onclick={() => onDelete(upload)}
                  disabled={deletingId === upload.id}
                >
                  {deletingId === upload.id ? '…' : 'delete'}
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>

      {#if totalPages > 1}
        <nav class="pagination" aria-label="gallery pages">
          <button class="btn btn-secondary btn-sm" onclick={() => goTo(page - 1)} disabled={page <= 1}>
            ← prev
          </button>
          {#each pageNumbers() as p (p)}
            {#if p === '…'}
              <span class="page-gap">…</span>
            {:else}
              <button
                class="btn btn-secondary btn-sm page-btn"
                class:page-current={p === page}
                onclick={() => goTo(p)}
              >
                {p}
              </button>
            {/if}
          {/each}
          <button
            class="btn btn-secondary btn-sm"
            onclick={() => goTo(page + 1)}
            disabled={page >= totalPages}
          >
            next →
          </button>
        </nav>
      {/if}
    {/if}
  </section>
{/if}
