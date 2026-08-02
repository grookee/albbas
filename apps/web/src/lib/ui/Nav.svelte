<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { auth, signOut } from '$lib/auth.svelte';

  let loggingOut = $state(false);

  async function onLogout(): Promise<void> {
    loggingOut = true;
    await signOut();
    await goto(resolve('/'));
    loggingOut = false;
  }
</script>

<header class="nav">
  <div class="container nav-inner">
    <a class="brand" href={resolve('/')}>
      <svg class="logo" viewBox="0 0 5 5" aria-hidden="true">
        <rect x="0" y="0" width="5" height="1" />
        <rect x="0" y="0" width="1" height="5" />
        <rect x="2" y="2" width="1" height="1" />
        <rect x="2" y="4" width="3" height="1" />
      </svg>
      <span>albbas</span>
    </a>
    <nav>
      {#if auth.ready && auth.user}
        <a href={resolve('/gallery')}>gallery</a>
        <a href={resolve('/settings')}>settings</a>
        <button class="btn-link" onclick={onLogout} disabled={loggingOut}>logout</button>
      {:else if auth.ready}
        <a href={resolve('/login')}>login</a>
        <a href={resolve('/register')}>register</a>
      {/if}
    </nav>
  </div>
</header>

<style>
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
  .logo {
    width: 1.25rem;
    height: 1.25rem;
    fill: var(--orange-b);
  }
</style>
