<script lang="ts">
  import type { Snippet } from 'svelte';

  let { title = '', children }: { title?: string; children: Snippet } = $props();
</script>

<section class="card">
  {#if title}
    <h2>{title}</h2>
  {/if}
  {@render children()}
</section>
