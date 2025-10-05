<script lang="ts">
  interface Props {
    title: string;
    description?: string;
    children?: any;
  }

  let { title, description, children }: Props = $props();
</script>

<div class="settings-section">
  <div class="section-header">
    <h3 class="section-title">{title}</h3>
  </div>

  {#if description}
    <p class="section-description">{description}</p>
  {/if}

  <div class="section-content">
    {@render children?.()}
  </div>
</div>

<style>
  .settings-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-sm);
  }

  .section-title {
    font-size: var(--font-size-md);
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .section-description {
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
    margin-bottom: var(--spacing-sm);
  }

  .section-content {
    display: flex;
    flex-direction: column;
  }
</style>