<script lang="ts">
  export let size: number = 24;
</script>

<img
  src="/tunnelforge-icon.svg?v=1.0.0"
  alt="TunnelForge"
  style="width: {size}px; height: {size}px"
  class="terminal-icon"
/>

<style>
  .terminal-icon {
    border-radius: 20%;
    box-shadow:
      0 2px 8px rgb(var(--color-bg-base) / 0.3),
      0 1px 3px rgb(var(--color-bg-base) / 0.2);
    background: rgb(var(--color-text-bright) / 0.05);
    padding: 2px;
    display: block;
  }
</style>
