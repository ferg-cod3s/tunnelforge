<script lang="ts">
  interface Option {
    value: string;
    label: string;
  }

  interface Props {
    label: string;
    description?: string;
    value: string;
    options: Option[];
    disabled?: boolean;
    onchange?: (value: string) => void;
  }

  let {
    label,
    description,
    value = '',
    options = [],
    disabled = false,
    onchange
  }: Props = $props();

  let selectId = `select-${Math.random().toString(36).substr(2, 9)}`;
</script>

<div class="setting-row">
  <div class="setting-label-container">
    <label for={selectId} class="setting-label">{label}</label>
    {#if description}
      <p class="setting-description">{description}</p>
    {/if}
  </div>
  <select
    id={selectId}
    {value}
    {disabled}
    onchange={(e) => onchange?.((e.target as HTMLSelectElement).value)}
    class="setting-select"
  >
    {#each options as option}
      <option value={option.value}>{option.label}</option>
    {/each}
  </select>
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

  .setting-select {
    padding: var(--spacing-sm);
    font-size: var(--font-size-sm);
    width: 8rem;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-primary);
    transition: border-color var(--transition-base);
    cursor: pointer;
  }

  .setting-select:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .setting-select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>