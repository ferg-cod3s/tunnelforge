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

<div class="flex items-center justify-between py-2">
  <div class="flex-1 pr-4">
    <label for={inputId} class="text-primary text-sm font-medium">{label}</label>
    {#if description}
      <p class="text-muted text-xs mt-1">{description}</p>
    {/if}
  </div>
  <input
    id={inputId}
    {type}
    {value}
    {placeholder}
    {disabled}
    onchange={(e) => onchange?.((e.target as HTMLInputElement).value)}
    class="input-field py-2 text-sm w-32"
  />
</div>