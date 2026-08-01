<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    variant = 'primary',
    type = 'button',
    disabled = false,
    class: className = '',
    onclick,
    children,
  }: {
    variant?: 'primary' | 'secondary' | 'danger';
    type?: 'button' | 'submit';
    disabled?: boolean;
    class?: string;
    onclick?: () => void;
    children: Snippet;
  } = $props();
</script>

<button {type} {disabled} {onclick} class={`btn btn-${variant} ${className}`}>
  {@render children()}
</button>
