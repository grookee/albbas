<script lang="ts">
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import { auth } from '$lib/auth.svelte';
  import { trpc, errorMessage } from '$lib/trpc';
  import { formatDate } from '$lib/format';
  import { confirm } from '$lib/confirm.svelte';
  import { ALLOWED_DOMAINS, baseUrlFor, type AllowedDomain } from '@albbas/shared';
  import Button from '$lib/ui/Button.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import CodeBlock from '$lib/ui/CodeBlock.svelte';
  import Field from '$lib/ui/Field.svelte';

  let origin = $state('');
  onMount(() => {
    origin = window.location.origin;
  });

  // ---- share domain ----
  let domain = $state<AllowedDomain>('mateakos.com');
  let subdomain = $state('');
  let savingSettings = $state(false);
  let settingsError = $state<string | null>(null);
  let settingsMsg = $state<string | null>(null);
  let loaded = $state(false);

  $effect(() => {
    if (!auth.ready || !auth.user || loaded) return;
    loaded = true;
    domain = auth.user.domain ?? 'mateakos.com';
    subdomain = auth.user.subdomain ?? '';
    void loadKeys();
    if (auth.user.role === 'ADMIN') void loadInvites();
  });

  function baseUrlPreview(): string {
    return baseUrlFor({ domain, subdomain: subdomain.trim() || undefined });
  }

  async function saveSettings(): Promise<void> {
    savingSettings = true;
    settingsError = null;
    settingsMsg = null;
    try {
      auth.user = await trpc.users.updateSettings.mutate({
        domain,
        subdomain: subdomain.trim() || undefined,
      });
      settingsMsg = 'saved — your share links use the new address.';
    } catch (err) {
      settingsError = errorMessage(err);
    } finally {
      savingSettings = false;
    }
  }

  // ---- api keys ----
  type ApiKeyRow = {
    id: string;
    name: string;
    prefix: string;
    lastUsedAt: string | null;
    createdAt: string;
  };
  let keys = $state<ApiKeyRow[]>([]);
  let keyName = $state('');
  let creatingKey = $state(false);
  let keysError = $state<string | null>(null);
  let activeKey: { id: string; name: string; key: string } | null = $state(null);
  let revealingId = $state<string | null>(null);
  let configError = $state<string | null>(null);

  async function loadKeys(): Promise<void> {
    keys = await trpc.keys.list.query();
  }

  async function createKey(): Promise<void> {
    creatingKey = true;
    keysError = null;
    try {
      const created = await trpc.keys.create.mutate({ name: keyName });
      activeKey = { id: created.id, name: created.name, key: created.key };
      configError = null;
      keyName = '';
      await loadKeys();
    } catch (err) {
      keysError = errorMessage(err);
    } finally {
      creatingKey = false;
    }
  }

  async function showConfig(key: ApiKeyRow): Promise<void> {
    revealingId = key.id;
    configError = null;
    try {
      const revealed = await trpc.keys.reveal.query({ id: key.id });
      activeKey = { id: revealed.id, name: revealed.name, key: revealed.key };
    } catch (err) {
      configError = errorMessage(err);
    } finally {
      revealingId = null;
    }
  }

  async function revokeKey(id: string): Promise<void> {
    if (!(await confirm('Revoke this API key? Uploaders using it will stop working.', { confirmLabel: 'revoke' })))
      return;
    try {
      await trpc.keys.revoke.mutate({ id });
      if (activeKey?.id === id) activeKey = null;
      await loadKeys();
    } catch (err) {
      keysError = errorMessage(err);
    }
  }

  // ---- uploader configs ----
  function sxcuConfig(key: string): string {
    return JSON.stringify(
      {
        Name: 'albbas',
        DestinationType: 'ImageUploader, TextUploader, FileUploader',
        RequestMethod: 'POST',
        RequestURL: `${origin}/api/upload`,
        Body: 'MultipartFormData',
        FileFormName: 'file',
        Headers: { 'X-Api-Key': key },
        URL: '{response:url}',
        DeletionURL: '{response:deleteUrl}',
        ErrorMessage: '{response:error}',
      },
      null,
      2,
    );
  }

  function upicConfig(key: string): string {
    return JSON.stringify(
      {
        label: 'albbas',
        endpoint: `${origin}/api/upload`,
        method: 'POST',
        formData: { file: '$filename' },
        headers: { 'X-Api-Key': key },
        url: '{url}',
        fileKey: 'file',
      },
      null,
      2,
    );
  }

  // ---- invites (admin) ----
  type InviteStatus = 'valid' | 'used' | 'revoked' | 'expired';
  type InviteRow = {
    id: string;
    code: string;
    createdAt: string;
    expiresAt: string | null;
    usedAt: string | null;
    status: InviteStatus;
  };
  let invites = $state<InviteRow[]>([]);
  let inviteDays = $state('');
  let creatingInvite = $state(false);
  let lastInvite = $state<string | null>(null);
  let invitesError = $state<string | null>(null);

  async function loadInvites(): Promise<void> {
    invites = await trpc.invites.list.query();
  }

  async function createInvite(): Promise<void> {
    creatingInvite = true;
    invitesError = null;
    try {
      const expiresAt = inviteDays
        ? new Date(Date.now() + Number(inviteDays) * 86_400_000).toISOString()
        : undefined;
      const created = await trpc.invites.create.mutate({ expiresAt });
      lastInvite = created.code;
      inviteDays = '';
      await loadInvites();
    } catch (err) {
      invitesError = errorMessage(err);
    } finally {
      creatingInvite = false;
    }
  }

  async function revokeInvite(id: string): Promise<void> {
    if (!(await confirm('Revoke this invite code?', { confirmLabel: 'revoke' }))) return;
    try {
      await trpc.invites.revoke.mutate({ id });
      await loadInvites();
    } catch (err) {
      invitesError = errorMessage(err);
    }
  }

  function inviteBadgeColor(status: InviteStatus): 'green' | 'gray' | 'red' | 'yellow' {
    switch (status) {
      case 'valid':
        return 'green';
      case 'used':
        return 'gray';
      case 'revoked':
        return 'red';
      case 'expired':
        return 'yellow';
    }
  }
</script>

<svelte:head>
  <title>settings — albbas</title>
</svelte:head>

{#if !auth.ready}
  <div class="muted">loading…</div>
{:else if !auth.user}
  <p>please <a href={resolve('/login')}>log in</a>.</p>
{:else}
  <section class="card">
    <h2>share domain</h2>
    {#if !auth.user.domain}
      <p class="error">you haven't picked a share domain yet — uploads are disabled until you do.</p>
    {/if}
    <div class="form-row">
      <div class="field">
        <label for="subdomain">subdomain</label>
        <input id="subdomain" name="subdomain" bind:value={subdomain} placeholder="i" />
      </div>
      <div class="field">
        <label for="domain">domain</label>
        <select id="domain" name="domain" bind:value={domain}>
          {#each ALLOWED_DOMAINS as option (option)}
            <option value={option}>{option}</option>
          {/each}
        </select>
      </div>
    </div>
    <p class="muted-note">
      your links will look like <span style="color: var(--fg1)">{baseUrlPreview()}/abc123456</span>
    </p>
    {#if settingsError}
      <p class="error">{settingsError}</p>
    {/if}
    {#if settingsMsg}
      <p class="muted-note" style="color: var(--green-b)">{settingsMsg}</p>
    {/if}
    <div style="margin-top: 0.75rem">
      <Button onclick={saveSettings} disabled={savingSettings}>
        {savingSettings ? 'saving…' : 'save'}
      </Button>
    </div>
  </section>

  <section class="card">
    <h2>api keys</h2>
    <p class="muted-note">keys are used by uploader clients (ShareX, uPic). pick one and download its config below.</p>
    <div class="form-row" style="margin-bottom: 1rem">
      <div style="flex: 1">
        <Field name="key-name" label="name" placeholder="work mac" bind:value={keyName} />
      </div>
      <Button onclick={createKey} disabled={creatingKey || !keyName.trim()}>
        {creatingKey ? 'creating…' : 'create key'}
      </Button>
    </div>
    {#if keysError}
      <p class="error">{keysError}</p>
    {/if}
    {#if configError}
      <p class="error">{configError}</p>
    {/if}
    {#if keys.length === 0}
      <p class="muted">no keys yet.</p>
    {:else}
      <table class="table">
        <thead>
          <tr>
            <th>name</th>
            <th>prefix</th>
            <th>last used</th>
            <th class="actions"></th>
          </tr>
        </thead>
        <tbody>
          {#each keys as key (key.id)}
            <tr>
              <td>{key.name}</td>
              <td class="muted">{key.prefix}…</td>
              <td class="muted">{key.lastUsedAt ? formatDate(key.lastUsedAt) : 'never'}</td>
              <td class="actions">
                <button
                  class="btn btn-secondary btn-sm"
                  onclick={() => showConfig(key)}
                  disabled={revealingId === key.id}
                >
                  {revealingId === key.id ? 'loading…' : 'config'}
                </button>
                <button class="btn btn-danger btn-sm" onclick={() => revokeKey(key.id)}
                  >revoke</button
                >
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>

  <section class="card">
    <h2>uploader config</h2>
    {#if !activeKey}
      <p class="muted-note">
        create a new api key or pick an existing one above to generate a ready-made config for your
        uploader.
      </p>
    {:else if !origin}
      <div class="muted">loading…</div>
    {:else}
      <p class="muted-note">key <span style="color: var(--fg1)">{activeKey.name}</span></p>

      <h3 style="margin-bottom: 0.25rem">sharex</h3>
      <p class="muted-note">
        windows only. download the file or copy the config into ShareX →
        destinations → custom uploader.
      </p>
      <CodeBlock text={sxcuConfig(activeKey.key)} />
      <a
        class="btn btn-secondary btn-sm"
        href={`/api/uploaders/sharex.sxcu?api_key=${activeKey.key}`}
        rel="external"
        >download albbas.sxcu</a
      >

      <hr />

      <h3 style="margin-bottom: 0.25rem">upic</h3>
      <p class="muted-note">
        macos only. open uPic preferences → uploaders → add, pick "custom", and paste the JSON
        below.
      </p>
      <CodeBlock text={upicConfig(activeKey.key)} />
    {/if}
  </section>

  {#if auth.user.role === 'ADMIN'}
    <section class="card">
      <h2>invite codes</h2>
      <p class="muted-note">
        one-time codes for registering new accounts. leave expiry empty for a code that never
        expires.
      </p>
      <div class="form-row" style="margin-bottom: 1rem">
        <div style="flex: 1">
          <Field
            name="invite-days"
            label="expire after (days, optional)"
            type="number"
            placeholder="30"
            bind:value={inviteDays}
          />
        </div>
        <Button onclick={createInvite} disabled={creatingInvite}>
          {creatingInvite ? 'creating…' : 'generate'}
        </Button>
      </div>
      {#if lastInvite}
        <p class="muted-note" style="color: var(--green-b)">
          new invite: <span style="color: var(--fg0)">{lastInvite}</span>
        </p>
      {/if}
      {#if invitesError}
        <p class="error">{invitesError}</p>
      {/if}
      {#if invites.length === 0}
        <p class="muted">no invites yet.</p>
      {:else}
        <table class="table">
          <thead>
            <tr>
              <th>code</th>
              <th>status</th>
              <th>created</th>
              <th>expires</th>
              <th class="actions"></th>
            </tr>
          </thead>
          <tbody>
            {#each invites as invite (invite.id)}
              <tr>
                <td>{invite.code}</td>
                <td>
                  <Badge color={inviteBadgeColor(invite.status)}>{invite.status}</Badge>
                </td>
                <td class="muted">{formatDate(invite.createdAt)}</td>
                <td class="muted">{invite.expiresAt ? formatDate(invite.expiresAt) : 'never'}</td>
                <td class="actions">
                  {#if invite.status === 'valid'}
                    <button class="btn btn-danger btn-sm" onclick={() => revokeInvite(invite.id)}
                      >revoke</button
                    >
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </section>
  {/if}
{/if}
