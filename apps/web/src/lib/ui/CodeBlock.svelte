<script lang="ts">
  let { text = '' }: { text?: string } = $props();

  let copied = $state(false);

  async function copy(): Promise<void> {
    await navigator.clipboard.writeText(text);
    copied = true;
    setTimeout(() => (copied = false), 1500);
  }
</script>

<pre class="codeblock"><code>{text}</code><button
    class="copy-btn btn btn-secondary btn-sm"
    onclick={copy}
    title="Copy to clipboard">
    {copied ? 'copied' : 'copy'}
  </button></pre>
