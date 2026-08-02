<script lang="ts">
  let { mime }: { mime: string } = $props();

  type Kind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'archive' | 'file';

  function kind(): Kind {
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    if (mime === 'application/pdf') return 'pdf';
    if (mime.startsWith('text/')) return 'text';
    if (/(zip|gzip|tar|rar|7z|compress)/.test(mime)) return 'archive';
    return 'file';
  }
</script>

{#if kind() === 'image'}
  <svg class="file-icon" viewBox="0 0 48 48" aria-hidden="true">
    <rect x="6" y="10" width="36" height="28" rx="2" />
    <circle cx="17" cy="21" r="4" />
    <path d="M10 36l10-10 8 8 6-6 9 9" />
  </svg>
{:else if kind() === 'video'}
  <svg class="file-icon" viewBox="0 0 48 48" aria-hidden="true">
    <rect x="5" y="12" width="26" height="24" rx="2" />
    <path d="M31 20l12-7v22l-12-7z" />
  </svg>
{:else if kind() === 'audio'}
  <svg class="file-icon" viewBox="0 0 48 48" aria-hidden="true">
    <path d="M10 30v-12h8l12-6v30l-12-6h-8z" />
    <path d="M34 19a9 9 0 0 1 0 10" />
  </svg>
{:else if kind() === 'pdf'}
  <svg class="file-icon" viewBox="0 0 48 48" aria-hidden="true">
    <path d="M14 6h14l10 10v26H14z" />
    <path d="M28 6v10h10" />
    <path d="M17 25h14M17 30h10M17 35h12" />
  </svg>
{:else if kind() === 'text'}
  <svg class="file-icon" viewBox="0 0 48 48" aria-hidden="true">
    <path d="M14 6h14l10 10v26H14z" />
    <path d="M28 6v10h10" />
    <path d="M18 24h12M18 29h12M18 34h8" />
  </svg>
{:else if kind() === 'archive'}
  <svg class="file-icon" viewBox="0 0 48 48" aria-hidden="true">
    <path d="M6 14h36v26H6z" />
    <path d="M6 14l6-8h24l6 8" />
    <path d="M20 24h8M24 24v6" />
  </svg>
{:else}
  <svg class="file-icon" viewBox="0 0 48 48" aria-hidden="true">
    <path d="M14 6h14l10 10v26H14z" />
    <path d="M28 6v10h10" />
    <path d="M18 26h12M18 31h12M18 36h8" />
  </svg>
{/if}
