<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { initAuth } from '$lib/auth.svelte';
  import Nav from '$lib/ui/Nav.svelte';

  let { children } = $props();

  onMount(() => {
    void initAuth();
  });
</script>

<Nav />
<main class="container">
  {@render children()}
</main>
