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

<div class="setting-row">
  <div class="setting-label-container">
    <label for={buttonId} class="setting-label">{label}</label>
    {#if description}
      <p class="setting-description">{description}</p>
    {/if}
  </div>
  <button
    id={buttonId}
    role="switch"
    aria-checked={checked}
    aria-label="Toggle {label}"
    {disabled}
    onclick={() => onchange?.(!checked)}
    class="toggle-button"
    class:checked
  >
    <span class="toggle-thumb" class:checked></span>
  </button>
</div>

<style>
  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-sm) 0;
  }

  .setting-label-container {
    flex: 1;
    padding-right: var(--spacing-md);
  }

  .setting-label {
    color: var(--color-text-primary);
    font-size: var(--font-size-sm);
    font-weight: 500;
    display: block;
  }

  .setting-description {
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
    margin-top: var(--spacing-xs);
  }

  .toggle-button {
    position: relative;
    display: inline-flex;
    align-items: center;
    height: 1.25rem;
    width: 2.25rem;
    border-radius: var(--radius-full);
    background: var(--color-border);
    border: none;
    cursor: pointer;
    transition: background-color var(--transition-base);
  }

  .toggle-button:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-primary);
  }

  .toggle-button.checked {
    background: var(--color-primary);
  }

  .toggle-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .toggle-thumb {
    display: inline-block;
    height: 1rem;
    width: 1rem;
    border-radius: var(--radius-full);
    background: var(--color-bg-elevated);
    transform: translateX(0.125rem);
    transition: transform var(--transition-base);
  }

  .toggle-thumb.checked {
    transform: translateX(1rem);
  }
</style>