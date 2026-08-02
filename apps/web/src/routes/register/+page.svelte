<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { auth } from '$lib/auth.svelte';
  import { trpc, errorMessage } from '$lib/trpc';
  import Button from '$lib/ui/Button.svelte';
  import Field from '$lib/ui/Field.svelte';

  let email = $state('');
  let password = $state('');
  let inviteCode = $state('');
  let error = $state<string | null>(null);
  let busy = $state(false);

  $effect(() => {
    if (auth.ready && auth.user) void goto(resolve('/'), { replaceState: true });
  });

  async function onSubmit(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    busy = true;
    error = null;
    try {
      await trpc.auth.register.mutate({ email, password, inviteCode });
      auth.user = await trpc.auth.me.query();
      await goto(resolve('/'));
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>register — albbas</title>
</svelte:head>

<div class="auth-card">
  <h1>register</h1>
  <form onsubmit={onSubmit}>
    <Field
      name="email"
      label="email"
      type="email"
      autocomplete="email"
      required
      bind:value={email}
    />
    <Field
      name="password"
      label="password"
      type="password"
      autocomplete="new-password"
      required
      hint="at least 8 characters"
      bind:value={password}
    />
    <Field
      name="invite"
      label="invite code"
      placeholder="XXXX-XXXX-XXXX-XXXX"
      autocomplete="off"
      required
      bind:value={inviteCode}
    />
    {#if error}
      <p class="error">{error}</p>
    {/if}
    <Button type="submit" disabled={busy}>
      {busy ? 'creating account…' : 'create account'}
    </Button>
  </form>
  <p class="foot muted">already have an account? <a href={resolve('/login')}>login</a></p>
</div>
