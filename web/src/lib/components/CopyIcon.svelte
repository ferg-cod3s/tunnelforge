<script lang="ts">
  let { size = 16 }: { size?: number } = $props();
</script>

<svg
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  style="width: {size}px; height: {size}px;"
  class="copy-icon"
>
  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
</svg>

<style>
  .copy-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    opacity: 0.4;
    transition: opacity var(--transition-base);
    flex-shrink: 0;
  }

  .copy-icon:hover {
    opacity: 0.8;
  }
</style>
