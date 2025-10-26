<!--
  CompactMenu.svelte - Generic dropdown menu component for Svelte 5

  Features:
  - Configurable menu items with different types (action, checkbox, radio, divider)
  - Keyboard navigation (arrow keys, Enter, Esc)
  - Click outside to close
  - Auto-positioning to avoid viewport overflow
  - Smooth animations
  - Full accessibility support
  - Touch-friendly on mobile
-->

<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { onMount } from 'svelte';

  interface MenuItem {
    id: string;
    label?: string;
    icon?: string;
    action?: () => void;
    type?: 'action' | 'checkbox' | 'radio' | 'divider';
    checked?: boolean;
    disabled?: boolean;
    danger?: boolean;
  }

  interface Props {
    items: MenuItem[];
    trigger?: 'click' | 'hover';
    position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
    icon?: string;
    label?: string;
  }

  let {
    items = [],
    trigger = 'click',
    position = 'bottom-right',
    icon,
    label
  }: Props = $props();

  let dispatch = createEventDispatcher<{
    'item-clicked': { item: MenuItem; event: Event };
    'menu-opened': void;
    'menu-closed': void;
  }>();

  let menuButton = $state<HTMLElement>();
  let menuContainer = $state<HTMLElement>();
  let isOpen = $state(false);
  let focusedIndex = $state(-1);
  let menuItems = $derived(() => items.filter(item => item.type !== 'divider'));

  // Auto-positioning logic
  let actualPosition = $derived(() => {
    if (!menuButton || !isOpen) return position;

    const rect = menuButton.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuWidth = 250; // min-width from styles
    const menuHeight = items.length * 48 + 16; // approximate height

    // Check if current position would overflow
    const wouldOverflowRight = position.includes('right') && rect.right + menuWidth > viewportWidth;
    const wouldOverflowLeft = position.includes('left') && rect.left - menuWidth < 0;
    const wouldOverflowBottom = position.includes('bottom') && rect.bottom + menuHeight > viewportHeight;
    const wouldOverflowTop = position.includes('top') && rect.top - menuHeight < 0;

    // Adjust position to avoid overflow
    if (wouldOverflowRight && !wouldOverflowLeft) {
      return position.replace('right', 'left');
    }
    if (wouldOverflowLeft && !wouldOverflowRight) {
      return position.replace('left', 'right');
    }
    if (wouldOverflowBottom && !wouldOverflowTop) {
      return position.replace('bottom', 'top');
    }
    if (wouldOverflowTop && !wouldOverflowBottom) {
      return position.replace('top', 'bottom');
    }

    return position;
  });

  function toggleMenu() {
    isOpen = !isOpen;
    if (isOpen) {
      dispatch('menu-opened');
      focusedIndex = -1;
    } else {
      dispatch('menu-closed');
      focusedIndex = -1;
    }
  }

  function handleItemClick(item: MenuItem, event: Event) {
    if (item.disabled) return;

    if (item.type === 'checkbox') {
      item.checked = !item.checked;
    } else if (item.type === 'radio') {
      // Uncheck all radio items in the same group
      items.forEach(otherItem => {
        if (otherItem.type === 'radio' && otherItem.id !== item.id) {
          otherItem.checked = false;
        }
      });
      item.checked = true;
    }

    dispatch('item-clicked', { item, event });

    if (item.action) {
      // Close menu immediately to ensure it doesn't block modals
      isOpen = false;
      focusedIndex = -1;
      // Call the action after a brief delay
      setTimeout(() => {
        item.action?.();
      }, 50);
    } else if (item.type === 'action') {
      // Close menu for action items
      isOpen = false;
      focusedIndex = -1;
    }
    // Keep menu open for checkbox/radio items
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (!isOpen) return;

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        isOpen = false;
        focusedIndex = -1;
        menuButton?.focus();
        break;

      case 'ArrowDown':
        event.preventDefault();
        navigateMenu(1);
        break;

      case 'ArrowUp':
        event.preventDefault();
        navigateMenu(-1);
        break;

      case 'Enter':
        event.preventDefault();
        if (focusedIndex >= 0) {
          selectFocusedItem();
        }
        break;

      case 'Home':
        event.preventDefault();
        focusedIndex = 0;
        break;

      case 'End':
        event.preventDefault();
        focusedIndex = menuItems.length - 1;
        break;
    }
  }

  function navigateMenu(direction: number) {
    if (menuItems.length === 0) return;

    let newIndex = focusedIndex + direction;

    // Handle wrapping
    if (newIndex < 0) {
      newIndex = menuItems.length - 1;
    } else if (newIndex >= menuItems.length) {
      newIndex = 0;
    }

    focusedIndex = newIndex;
  }

  function selectFocusedItem() {
    const items = menuItems();
    const item = items[focusedIndex];
    if (item && !item.disabled) {
      handleItemClick(item, new Event('keyboard'));
    }
  }

  function handleClickOutside(event: MouseEvent) {
    if (!menuContainer?.contains(event.target as Node)) {
      isOpen = false;
      focusedIndex = -1;
    }
  }

  function handleMenuButtonKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' && !isOpen) {
      event.preventDefault();
      isOpen = true;
      dispatch('menu-opened');
      focusedIndex = 0;
    }
  }

  // Lifecycle
  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  });

  // Position classes
  const positionClasses: Record<string, string> = {
    'bottom-left': 'top-full left-0 mt-2',
    'bottom-right': 'top-full right-0 mt-2',
    'top-left': 'bottom-full left-0 mb-2',
    'top-right': 'bottom-full right-0 mb-2'
  };
</script>

<div class="relative inline-block" bind:this={menuContainer}>
  <!-- Trigger Button -->
  <button
    bind:this={menuButton}
    class="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg hover:border-primary hover:bg-surface-hover transition-all duration-200 text-primary {isOpen ? 'border-primary bg-surface-hover' : ''}"
    onclick={toggleMenu}
    onkeydown={handleMenuButtonKeyDown}
    aria-label={label || "Menu"}
    aria-expanded={isOpen}
    aria-haspopup="menu"
    type="button"
  >
    {#if icon}
      <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
        <path d={icon} />
      </svg>
    {:else}
      <!-- Default menu icon -->
      <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
      </svg>
    {/if}
    {#if label}
      <span class="text-sm font-medium">{label}</span>
    {/if}
  </button>

  <!-- Dropdown Menu -->
  {#if isOpen}
    <div
      class="absolute {positionClasses[actualPosition()]} bg-surface border border-border rounded-lg shadow-xl py-1 min-w-[200px] max-w-[300px] z-50 animate-in fade-in-0 zoom-in-95 duration-200"
      role="menu"
      aria-label={label || "Menu"}
    >
      {#each items as item, index}
        {#if item.type === 'divider'}
          <div class="border-t border-border my-1" role="separator"></div>
        {:else}
          {@const itemsArray = menuItems()}
          {@const isFocused = focusedIndex === itemsArray.indexOf(item)}
          {@const isChecked = item.checked}
          {@const isDisabled = item.disabled}

          <button
            class="w-full text-left px-4 py-3 text-sm font-mono flex items-center gap-3 transition-colors duration-150 {isDisabled ? 'text-text-muted cursor-not-allowed opacity-50' : item.danger ? 'text-status-error hover:bg-surface-hover' : 'text-primary hover:bg-surface-hover hover:text-primary'} {isFocused ? 'bg-surface-hover' : ''}"
            onclick={(event) => handleItemClick(item, event)}
            disabled={isDisabled}
            role={item.type === 'checkbox' ? 'menuitemcheckbox' : item.type === 'radio' ? 'menuitemradio' : 'menuitem'}
            aria-checked={item.type === 'checkbox' || item.type === 'radio' ? isChecked : undefined}
            aria-disabled={isDisabled}
            tabindex={isOpen ? 0 : -1}
            data-menu-item={item.id}
          >
            <!-- Icon -->
            {#if item.icon}
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path d={item.icon} />
              </svg>
            {:else if item.type === 'checkbox'}
              <div class="w-4 h-4 border border-border rounded flex items-center justify-center {isChecked ? 'bg-primary border-primary' : ''}">
                {#if isChecked}
                  <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor" class="text-surface">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                  </svg>
                {/if}
              </div>
            {:else if item.type === 'radio'}
              <div class="w-4 h-4 border border-border rounded-full flex items-center justify-center {isChecked ? 'border-primary' : ''}">
                {#if isChecked}
                  <div class="w-2 h-2 bg-primary rounded-full"></div>
                {/if}
              </div>
            {/if}

            <!-- Label -->
            <span class="flex-1 truncate">{item.label}</span>

            <!-- Checkmark for selected radio items -->
            {#if item.type === 'radio' && isChecked}
              <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" class="text-primary">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
              </svg>
            {/if}
          </button>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  /* Custom animations for menu appearance */
  @keyframes fade-in-0 {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes zoom-in-95 {
    from { transform: scale(0.95); }
    to { transform: scale(1); }
  }

  .animate-in {
    animation-fill-mode: both;
  }

  .fade-in-0 {
    animation-name: fade-in-0;
  }

  .zoom-in-95 {
    animation-name: zoom-in-95;
  }

  .duration-200 {
    animation-duration: 200ms;
  }
</style>