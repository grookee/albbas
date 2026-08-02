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
    <a class="brand" href={resolve('/')}>albbas</a>
    <nav>
      {#if auth.ready && auth.user}
        <a href={resolve('/settings')}>settings</a>
        <button class="btn-link" onclick={onLogout} disabled={loggingOut}>logout</button>
      {:else if auth.ready}
        <a href={resolve('/login')}>login</a>
        <a href={resolve('/register')}>register</a>
      {/if}
    </nav>
  </div>
</header>
