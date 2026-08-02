<script lang="ts">
  import { resolve } from '$app/paths';
  import { auth } from '$lib/auth.svelte';
  import { trpc, errorMessage } from '$lib/trpc';
  import { formatDate } from '$lib/format';
  import { confirm } from '$lib/confirm.svelte';
  import CopyButton from '$lib/ui/CopyButton.svelte';
  import Field from '$lib/ui/Field.svelte';
  import Button from '$lib/ui/Button.svelte';

  type ShortUrlItem = {
    id: string;
    slug: string;
    targetUrl: string;
    url: string;
    visits: number;
    createdAt: string;
  };

  let target = $state('');
  let shortening = $state(false);
  let error = $state<string | null>(null);
  let lastUrl = $state<string | null>(null);

  let items = $state<ShortUrlItem[]>([]);
  let loaded = $state(false);
  let loading = $state(false);
  let listError = $state<string | null>(null);

  async function load(): Promise<void> {
    loading = true;
    listError = null;
    try {
      const res = await trpc.shortUrls.list.query({ limit: 20 });
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

  async function doShorten(): Promise<void> {
    if (shortening) return;
    shortening = true;
    error = null;
    try {
      const form = new FormData();
      form.append('url', target.trim());
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const body = (await res.json().catch(() => null)) as {
        url?: string;
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(body?.error ?? `Shortening failed (HTTP ${res.status})`);
      }
      lastUrl = body?.url ?? null;
      target = '';
      await load();
    } catch (err) {
      error = errorMessage(err);
    } finally {
      shortening = false;
    }
  }

  async function onDelete(item: ShortUrlItem): Promise<void> {
    if (!(await confirm(`Delete short link ${item.slug}?`))) return;
    try {
      await trpc.shortUrls.delete.mutate({ slug: item.slug });
      if (lastUrl === item.url) lastUrl = null;
      await load();
    } catch (err) {
      error = errorMessage(err);
    }
  }
</script>

<svelte:head>
  <title>shorten — albbas</title>
</svelte:head>

{#if !auth.ready}
  <div class="muted">loading…</div>
{:else if !auth.user}
  <p>please <a href={resolve('/login')}>log in</a>.</p>
{:else}
  <section class="card">
    <h2>shorten a url</h2>
    <p class="muted-note">a short link on your domain that redirects to the target.</p>
    <div class="form-row">
      <div style="flex: 1">
        <Field
          name="target-url"
          label="url"
          placeholder="https://example.com/some/long/path"
          bind:value={target}
        />
      </div>
      <Button onclick={doShorten} disabled={shortening || !target.trim()}>
        {shortening ? 'shortening…' : 'shorten'}
      </Button>
    </div>
    {#if error}
      <p class="error">{error}</p>
    {/if}
    {#if lastUrl}
      <div class="upload-result">
        <p class="muted" style="margin-top:0">short link:</p>
        <div class="url-cell">
          <a href={lastUrl} target="_blank" rel="external noreferrer">{lastUrl}</a>
          <CopyButton text={lastUrl} />
        </div>
      </div>
    {/if}
  </section>

  <section class="card">
    <div class="card-head">
      <h2>recent short links</h2>
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
            <th>short link</th>
            <th>target</th>
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
                  <a href={item.url} target="_blank" rel="external noreferrer">{item.slug}</a>
                  <CopyButton text={item.url} />
                </div>
              </td>
              <td class="muted">{item.targetUrl}</td>
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
