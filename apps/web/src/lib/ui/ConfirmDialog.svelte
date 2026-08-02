<script lang="ts">
  import { confirmState, settleConfirm } from '$lib/confirm.svelte';

  let dialogEl = $state<HTMLDivElement | undefined>(undefined);

  $effect(() => {
    if (!confirmState.current) return;
    dialogEl?.querySelector<HTMLButtonElement>('button')?.focus();
  });

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && confirmState.current) settleConfirm(false);
  }
</script>

{#if confirmState.current}
  <div
    class="overlay"
    role="presentation"
    onkeydown={onKeydown}
    onclick={(e) => {
      if (e.target === e.currentTarget) settleConfirm(false);
    }}
  >
    <div
      bind:this={dialogEl}
      class="dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
    >
      <h3 id="confirm-title">{confirmState.current.title}</h3>
      <p id="confirm-message">{confirmState.current.message}</p>
      <div class="dialog-actions">
        {#if !confirmState.current.alert}
          <button class="btn btn-secondary" onclick={() => settleConfirm(false)}>cancel</button>
        {/if}
        <button
          class={confirmState.current.alert ? 'btn btn-secondary' : 'btn btn-danger'}
          onclick={() => settleConfirm(true)}
        >
          {confirmState.current.confirmLabel}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.55);
  }

  .dialog {
    width: 90%;
    max-width: 380px;
    background: var(--bg1);
    border: 1px solid var(--bg3);
    border-radius: var(--radius);
    padding: 1.25rem;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
  }

  .dialog h3 {
    margin: 0 0 0.5rem;
  }

  .dialog p {
    margin: 0;
    color: var(--fg2);
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 1.25rem;
  }
</style>
