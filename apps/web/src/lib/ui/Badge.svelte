<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    color = 'gray',
    children,
  }: { color?: 'gray' | 'green' | 'yellow' | 'red' | 'aqua'; children: Snippet } = $props();
</script>

<span class={`badge badge-${color}`}>{@render children()}</span>
