<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte';

  export let value: string = '';
  export let placeholder: string = '';
  export let onSave: ((value: string) => void) | undefined = undefined;

  const dispatch = createEventDispatcher<{
    save: { value: string };
    cancel: void;
  }>();

  let isEditing = false;
  let editValue = '';
  let inputElement: HTMLInputElement;

  function startEdit() {
    editValue = value;
    isEditing = true;
    tick().then(() => {
      if (inputElement) {
        inputElement.focus();
        inputElement.select();
      }
    });
  }

  function handleInput(e: Event) {
    const input = e.target as HTMLInputElement;
    editValue = input.value;
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  }

  function handleSave() {
    const trimmedValue = editValue.trim();
    if (trimmedValue && trimmedValue !== value) {
      onSave?.(trimmedValue);
      dispatch('save', { value: trimmedValue });
    }
    isEditing = false;
  }

  function handleCancel() {
    isEditing = false;
    editValue = '';
    dispatch('cancel');
  }
</script>

<div class="inline-edit-container">
  {#if isEditing}
    <div class="edit-container">
      <input
        bind:this={inputElement}
        type="text"
        value={editValue}
        on:input={handleInput}
        on:keydown={handleKeyDown}
        {placeholder}
        class="edit-input"
      />
      <div class="action-buttons">
        <button
          class="btn-save"
          on:click|stopPropagation={handleSave}
          title="Save (Enter)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </button>
        <button
          class="btn-cancel"
          on:click|stopPropagation={handleCancel}
          title="Cancel (Esc)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
  {:else}
    <div class="display-container">
      <span class="display-text" title={value}>
        {value}
      </span>
      <svg
        class="edit-icon"
        on:click|stopPropagation={startEdit}
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
    </div>
  {/if}
</div>

<style>
  .inline-edit-container {
    display: block;
    max-width: 100%;
    min-width: 0;
    overflow: hidden;
  }

  .edit-container {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    width: 100%;
  }

  .edit-input {
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    color: inherit;
    font: inherit;
    padding: 0.125rem 0.25rem;
    border-radius: var(--radius-sm);
    outline: none;
    width: 100%;
    min-width: 0;
  }

  .edit-input:focus {
    border-color: var(--color-primary);
  }

  .action-buttons {
    display: flex;
    gap: var(--spacing-xs);
    flex-shrink: 0;
  }

  .btn-save,
  .btn-cancel {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.125rem;
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
    transition: all var(--transition-base);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
  }

  .btn-save {
    color: var(--color-primary);
  }

  .btn-save:hover {
    background: color-mix(in srgb, var(--color-primary) 20%, transparent);
  }

  .btn-cancel {
    color: var(--color-status-error);
  }

  .btn-cancel:hover {
    background: color-mix(in srgb, var(--color-status-error) 20%, transparent);
  }

  .display-container {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    max-width: 100%;
    min-width: 0;
  }

  .display-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
    max-width: 100%;
  }

  .edit-icon {
    cursor: pointer;
    opacity: 0;
    transition: opacity var(--transition-base);
    flex-shrink: 0;
    width: 0.875rem;
    height: 0.875rem;
  }

  .display-container:hover .edit-icon {
    opacity: 0.5;
  }

  .edit-icon:hover {
    opacity: 1 !important;
  }

  /* Show edit icon on touch devices */
  @media (hover: none) and (pointer: coarse) {
    .edit-icon {
      opacity: 0.5;
    }
  }
</style>
