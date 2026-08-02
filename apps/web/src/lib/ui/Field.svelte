<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  let {
    label = '',
    name,
    type = 'text',
    placeholder = '',
    hint = '',
    autocomplete,
    required = false,
    value = $bindable(''),
  }: {
    label?: string;
    name: string;
    type?: string;
    placeholder?: string;
    hint?: string;
    autocomplete?: HTMLInputAttributes['autocomplete'];
    required?: boolean;
    value?: string;
  } = $props();
</script>

<div class="field">
  {#if label}
    <label for={name}>{label}</label>
  {/if}
  <input id={name} {name} {type} {placeholder} {autocomplete} {required} bind:value />
  {#if hint}
    <p class="hint">{hint}</p>
  {/if}
</div>
