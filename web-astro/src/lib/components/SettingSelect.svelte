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

<div class="flex items-center justify-between py-2">
  <div class="flex-1 pr-4">
    <label for={selectId} class="text-primary text-sm font-medium">{label}</label>
    {#if description}
      <p class="text-muted text-xs mt-1">{description}</p>
    {/if}
  </div>
  <select
    id={selectId}
    {value}
    {disabled}
    onchange={(e) => onchange?.((e.target as HTMLSelectElement).value)}
    class="input-field py-2 text-sm w-32"
  >
    {#each options as option}
      <option value={option.value}>{option.label}</option>
    {/each}
  </select>
</div>