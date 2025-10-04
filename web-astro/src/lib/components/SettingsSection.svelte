<script lang="ts">
  interface Props {
    title: string;
    description?: string;
    children?: any;
  }

  let { title, description, children }: Props = $props();
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between mb-3">
    <h3 class="text-md font-bold text-primary">{title}</h3>
  </div>

  {#if description}
    <p class="text-muted text-xs mb-3">{description}</p>
  {/if}

  {@render children?.()}
</div>