<script lang="ts">
  import { goto } from '$app/navigation';
  import { auth, signOut } from '$lib/auth.svelte';

  let loggingOut = $state(false);

  async function onLogout(): Promise<void> {
    loggingOut = true;
    await signOut();
    await goto('/');
    loggingOut = false;
  }
</script>

<header class="nav">
  <div class="container nav-inner">
    <a class="brand" href="/">albbas</a>
    <nav>
      {#if auth.ready && auth.user}
        <a href="/settings">settings</a>
        <button class="btn-link" onclick={onLogout} disabled={loggingOut}>logout</button>
      {:else if auth.ready}
        <a href="/login">login</a>
        <a href="/register">register</a>
      {/if}
    </nav>
  </div>
</header>
