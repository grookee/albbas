<script lang="ts">
  import { resolve } from '$app/paths';
  import { auth } from '$lib/auth.svelte';
  import { trpc, errorMessage } from '$lib/trpc';
  import { formatBytes, formatDate } from '$lib/format';
  import { confirm } from '$lib/confirm.svelte';
  import CopyButton from '$lib/ui/CopyButton.svelte';

  let fileInput = $state<HTMLInputElement | undefined>(undefined);
  let dragging = $state(false);
  let uploading = $state(false);
  let uploadError = $state<string | null>(null);
  let lastUrl = $state<string | null>(null);
  let lastDeleted = $state<string | null>(null);

  type UploadItem = {
    id: string;
    slug: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    url: string;
    createdAt: string;
  };
  let uploads = $state<UploadItem[]>([]);
  let uploadsStarted = $state(false);
  let uploadsLoading = $state(false);
  let uploadsError = $state<string | null>(null);
  const skeletonRows = Array.from({ length: 5 }, (_, i) => i);

  async function loadUploads(): Promise<void> {
    uploadsLoading = true;
    uploadsError = null;
    try {
      const res = await trpc.uploads.list.query({ limit: 5 });
      uploads = res.items;
    } catch (err) {
      uploadsError = errorMessage(err);
    } finally {
      uploadsLoading = false;
    }
  }

  $effect(() => {
    if (auth.ready && auth.user && !uploadsStarted) {
      uploadsStarted = true;
      void loadUploads();
    }
  });

  async function doUpload(file: File): Promise<void> {
    if (uploading) return;
    uploading = true;
    uploadError = null;
    lastDeleted = null;
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const body = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok) {
        throw new Error(body?.error ?? `Upload failed (HTTP ${res.status})`);
      }
      lastUrl = body?.url ?? null;
      await loadUploads();
    } catch (err) {
      uploadError = errorMessage(err);
    } finally {
      uploading = false;
    }
  }

  function onFileChange(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) void doUpload(file);
  }

  function onDrop(e: DragEvent): void {
    e.preventDefault();
    dragging = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) void doUpload(file);
  }

  async function onDelete(upload: UploadItem): Promise<void> {
    if (!(await confirm(`Delete "${upload.originalName}"?`, { confirmLabel: 'delete' }))) return;
    try {
      await trpc.uploads.delete.mutate({ slug: upload.slug });
      if (lastUrl === upload.url) lastUrl = null;
      lastDeleted = upload.url;
      await loadUploads();
    } catch (err) {
      uploadsError = errorMessage(err);
    }
  }
</script>

<svelte:head>
  <title>albbas</title>
</svelte:head>

{#if !auth.ready}
  <div class="muted">loading…</div>
{:else if !auth.user}
  <section class="hero">
    <h1>private file hosting.</h1>
    <p>
      Upload a file, get a short unguessable link on your own domain. Files are served directly,
      deleted whenever you say so.
    </p>
    <p class="muted">no tracking, no accounts for visitors, nothing public.</p>
    <div class="actions">
      <a class="btn btn-primary" href={resolve('/login')}>login</a>
      <a class="btn btn-secondary" href={resolve('/register')}>register</a>
    </div>
  </section>
{:else}
  <section class="card">
    <h2>upload</h2>
    <div
      class="dropzone"
      class:dragging
      role="button"
      tabindex="0"
      ondragover={(e) => {
        e.preventDefault();
        dragging = true;
      }}
      ondragleave={() => (dragging = false)}
      ondrop={onDrop}
      onclick={() => fileInput?.click()}
      onkeydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          fileInput?.click();
        }
      }}
    >
      <input type="file" bind:this={fileInput} onchange={onFileChange} />
      {#if uploading}
        uploading…
      {:else}
        drop a file here or click to browse
      {/if}
    </div>

    {#if uploadError}
      <p class="error upload-status">{uploadError}</p>
    {/if}

    {#if lastUrl}
      <div class="upload-result">
        <p class="muted" style="margin-top:0">uploaded:</p>
        <div class="url-cell">
          <a href={lastUrl} target="_blank" rel="external noreferrer">{lastUrl}</a>
          <CopyButton text={lastUrl} />
        </div>
      </div>
    {/if}

    {#if lastDeleted}
      <p class="muted-note" style="margin-top:0.75rem">deleted: {lastDeleted}</p>
    {/if}
  </section>

  <section class="card">
    <div class="card-head">
      <h2>recent uploads</h2>
      <a class="btn-link" href={resolve('/gallery')}>view all →</a>
    </div>
    {#if uploadsLoading}
      <div class="table-skeleton" aria-hidden="true">
        {#each skeletonRows as i (i)}
          <div class="table-skeleton-row">
            <div class="skeleton skeleton-line" style="width: 70%"></div>
            <div class="skeleton skeleton-line" style="width: 40%"></div>
            <div class="skeleton skeleton-line" style="width: 60%"></div>
            <div class="skeleton skeleton-line" style="width: 50%"></div>
          </div>
        {/each}
      </div>
    {:else if uploadsError}
      <p class="error">{uploadsError}</p>
    {:else if uploads.length === 0}
      <p class="muted">nothing here yet.</p>
    {:else}
      <table class="table">
        <thead>
          <tr>
            <th>file</th>
            <th>size</th>
            <th>date</th>
            <th class="actions"></th>
          </tr>
        </thead>
        <tbody>
          {#each uploads as upload (upload.id)}
            <tr>
              <td>
                <div class="url-cell">
                  <a href={upload.url} target="_blank" rel="external noreferrer"
                    >{upload.originalName}</a
                  >
                  <CopyButton text={upload.url} />
                </div>
              </td>
              <td class="muted">{formatBytes(upload.sizeBytes)}</td>
              <td class="muted">{formatDate(upload.createdAt)}</td>
              <td class="actions">
                <button class="btn btn-danger btn-sm" onclick={() => onDelete(upload)}
                  >delete</button
                >
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>
{/if}
