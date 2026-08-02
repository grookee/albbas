<script lang="ts">
  import { resolve } from '$app/paths';
  import { auth } from '$lib/auth.svelte';
  import { trpc, errorMessage } from '$lib/trpc';
  import { formatBytes, formatDate } from '$lib/format';
  import { confirm } from '$lib/confirm.svelte';
  import { PASTE_LANGUAGES } from '@albbas/shared';
  import CopyButton from '$lib/ui/CopyButton.svelte';
  import Field from '$lib/ui/Field.svelte';
  import Button from '$lib/ui/Button.svelte';

  type PasteItem = {
    id: string;
    slug: string;
    title: string | null;
    language: string;
    sizeBytes: number;
    url: string;
    visits: number;
    createdAt: string;
  };

  let content = $state('');
  let title = $state('');
  let language = $state('text');
  let pasting = $state(false);
  let error = $state<string | null>(null);
  let lastUrl = $state<string | null>(null);

  let items = $state<PasteItem[]>([]);
  let loaded = $state(false);
  let loading = $state(false);
  let listError = $state<string | null>(null);

  async function load(): Promise<void> {
    loading = true;
    listError = null;
    try {
      const res = await trpc.pastes.list.query({ limit: 20 });
      items = res.items;
    } catch (err) {
      listError = errorMessage(err);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (auth.ready && auth.user && !loaded) {
      loaded = true;
      void load();
    }
  });

  async function doPaste(): Promise<void> {
    if (pasting) return;
    pasting = true;
    error = null;
    try {
      const form = new FormData();
      const blob = new Blob([content], { type: 'text/plain' });
      form.append('file', blob, 'paste.txt');
      form.append('language', language);
      if (title.trim()) form.append('title', title.trim());
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const body = (await res.json().catch(() => null)) as {
        url?: string;
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(body?.error ?? `Paste failed (HTTP ${res.status})`);
      }
      lastUrl = body?.url ?? null;
      content = '';
      title = '';
      await load();
    } catch (err) {
      error = errorMessage(err);
    } finally {
      pasting = false;
    }
  }

  function languageLabel(lang: string): string {
    const display = lang === 'text' ? 'plain text' : lang;
    return display.slice(0, 24);
  }

  async function onDelete(item: PasteItem): Promise<void> {
    const label = item.title ?? item.slug;
    if (!(await confirm(`Delete paste "${label}"?`))) return;
    try {
      await trpc.pastes.delete.mutate({ slug: item.slug });
      if (lastUrl === item.url) lastUrl = null;
      await load();
    } catch (err) {
      error = errorMessage(err);
    }
  }
</script>

<svelte:head>
  <title>paste — albbas</title>
</svelte:head>

{#if !auth.ready}
  <div class="muted">loading…</div>
{:else if !auth.user}
  <p>please <a href={resolve('/login')}>log in</a>.</p>
{:else}
  <section class="card">
    <h2>new paste</h2>
    <p class="muted-note">
      pastes are served as highlighted pages on your domain. bigger than 8 MB? upload it as a file
      instead.
    </p>
    <div class="form-row" style="margin-bottom: 1rem">
      <div style="flex: 1">
        <Field
          name="paste-title"
          label="title (optional)"
          placeholder="server crash log"
          bind:value={title}
        />
      </div>
      <div style="flex: 1; max-width: 14rem">
        <div class="field">
          <label for="paste-language">language</label>
          <select id="paste-language" bind:value={language}>
            {#each PASTE_LANGUAGES as lang (lang)}
              <option value={lang}>{lang}</option>
            {/each}
          </select>
        </div>
      </div>
    </div>
    <div class="field">
      <label for="paste-content">text</label>
      <textarea
        id="paste-content"
        class="paste-textarea"
        placeholder="paste your text or code here…"
        bind:value={content}
        spellcheck="false"
      ></textarea>
    </div>
    <div style="display: flex; align-items: center; gap: 0.75rem">
      <Button onclick={doPaste} disabled={pasting || !content.trim()}>
        {pasting ? 'pasting…' : 'create paste'}
      </Button>
      <span class="muted-note">{content.length.toLocaleString()} chars</span>
    </div>
    {#if error}
      <p class="error">{error}</p>
    {/if}
    {#if lastUrl}
      <div class="upload-result">
        <p class="muted" style="margin-top:0">paste:</p>
        <div class="url-cell">
          <a href={lastUrl} target="_blank" rel="external noreferrer">{lastUrl}</a>
          <CopyButton text={lastUrl} />
        </div>
      </div>
    {/if}
  </section>

  <section class="card">
    <div class="card-head">
      <h2>recent pastes</h2>
    </div>
    {#if loading}
      <div class="muted">loading…</div>
    {:else if listError}
      <p class="error">{listError}</p>
    {:else if items.length === 0}
      <p class="muted">nothing here yet.</p>
    {:else}
      <table class="table">
        <thead>
          <tr>
            <th>title</th>
            <th>language</th>
            <th>size</th>
            <th>visits</th>
            <th>date</th>
            <th class="actions"></th>
          </tr>
        </thead>
        <tbody>
          {#each items as item (item.id)}
            <tr>
              <td>
                <div class="url-cell">
                  <a href={item.url} target="_blank" rel="external noreferrer"
                    >{item.title ?? item.slug}</a
                  >
                  <CopyButton text={item.url} />
                </div>
              </td>
              <td class="muted">{languageLabel(item.language)}</td>
              <td class="muted">{formatBytes(item.sizeBytes)}</td>
              <td class="muted">{item.visits}</td>
              <td class="muted">{formatDate(item.createdAt)}</td>
              <td class="actions">
                <button class="btn btn-danger btn-sm" onclick={() => onDelete(item)}>delete</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>
{/if}

<style>
  .paste-textarea {
    width: 100%;
    min-height: 12rem;
    padding: 0.5rem 0.6rem;
    background: var(--bg1);
    color: var(--fg1);
    border: 1px solid var(--bg3);
    border-radius: var(--radius);
    font-family: var(--font-mono);
    font-size: 0.9rem;
    line-height: 1.5;
    resize: vertical;
  }

  .paste-textarea:focus {
    outline: none;
    border-color: var(--orange);
  }
</style>
