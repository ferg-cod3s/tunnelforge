<script lang="ts">
  interface Props {
    label: string;
    description?: string;
    checked: boolean;
    disabled?: boolean;
    onchange?: (checked: boolean) => void;
  }

  let { label, description, checked = false, disabled = false, onchange }: Props = $props();

  let buttonId = `toggle-${Math.random().toString(36).substr(2, 9)}`;
</script>

<div class="flex items-center justify-between py-2">
  <div class="flex-1 pr-4">
    <label for={buttonId} class="text-primary text-sm font-medium">{label}</label>
    {#if description}
      <p class="text-muted text-xs mt-1">{description}</p>
    {/if}
  </div>
  <button
    id={buttonId}
    role="switch"
    aria-checked={checked}
    aria-label="Toggle {label}"
    {disabled}
    onclick={() => onchange?.(!checked)}
    class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-base {checked
      ? 'bg-primary'
      : 'bg-border'}"
  >
    <span
      class="inline-block h-4 w-4 transform rounded-full bg-bg-elevated transition-transform {checked
        ? 'translate-x-4'
        : 'translate-x-0.5'}"
    ></span>
  </button>
</div>