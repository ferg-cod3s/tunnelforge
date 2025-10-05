<script lang="ts">
  interface Props {
    label: string;
    description?: string;
    value: string;
    placeholder?: string;
    type?: string;
    disabled?: boolean;
    onchange?: (value: string) => void;
  }

  let {
    label,
    description,
    value = '',
    placeholder = '',
    type = 'text',
    disabled = false,
    onchange
  }: Props = $props();

  let inputId = `input-${Math.random().toString(36).substr(2, 9)}`;
</script>

<div class="setting-row">
  <div class="setting-label-container">
    <label for={inputId} class="setting-label">{label}</label>
    {#if description}
      <p class="setting-description">{description}</p>
    {/if}
  </div>
  <input
    id={inputId}
    {type}
    {value}
    {placeholder}
    {disabled}
    onchange={(e) => onchange?.((e.target as HTMLInputElement).value)}
    class="setting-input"
  />
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

  .setting-input {
    padding: var(--spacing-sm);
    font-size: var(--font-size-sm);
    width: 8rem;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-primary);
    transition: border-color var(--transition-base);
  }

  .setting-input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .setting-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>