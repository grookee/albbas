<script lang="ts">
  import { goto } from '$app/navigation';
  import { auth } from '$lib/auth.svelte';
  import { trpc, errorMessage } from '$lib/trpc';
  import Button from '$lib/ui/Button.svelte';
  import Field from '$lib/ui/Field.svelte';

  let email = $state('');
  let password = $state('');
  let error = $state<string | null>(null);
  let busy = $state(false);

  $effect(() => {
    if (auth.ready && auth.user) void goto('/', { replaceState: true });
  });

  async function onSubmit(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    busy = true;
    error = null;
    try {
      await trpc.auth.login.mutate({ email, password });
      auth.user = await trpc.auth.me.query();
      await goto('/');
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>login — albbas</title>
</svelte:head>

<div class="auth-card">
  <h1>login</h1>
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
      autocomplete="current-password"
      required
      bind:value={password}
    />
    {#if error}
      <p class="error">{error}</p>
    {/if}
    <Button type="submit" disabled={busy}>
      {busy ? 'signing in…' : 'sign in'}
    </Button>
  </form>
  <p class="foot muted">no account? <a href="/register">register</a></p>
</div>
