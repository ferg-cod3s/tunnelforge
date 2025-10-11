<!--
  Example usage of CompactMenu.svelte component
-->

<script lang="ts">
  import CompactMenu from './CompactMenu.svelte';

  // Example menu items
  const menuItems = [
    {
      id: 'new-session',
      label: 'New Session',
      icon: 'M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2Z',
      type: 'action' as const,
      action: () => console.log('New session clicked')
    },
    {
      id: 'file-browser',
      label: 'Browse Files',
      icon: 'M1.75 1h5.5c.966 0 1.75.784 1.75 1.75v1h4c.966 0 1.75.784 1.75 1.75v7.75A1.75 1.75 0 0113 15H3a1.75 1.75 0 01-1.75-1.75V2.75C1.25 1.784 1.784 1 1.75 1zM2.75 2.5v10.75c0 .138.112.25.25.25h10a.25.25 0 00.25-.25V5.5a.25.25 0 00-.25-.25H8.75v-2.5a.25.25 0 00-.25-.25h-5.5a.25.25 0 00-.25.25z',
      type: 'action' as const
    },
    { id: 'divider1', type: 'divider' as const },
    {
      id: 'theme-light',
      label: 'Light Theme',
      type: 'radio' as const,
      checked: false
    },
    {
      id: 'theme-dark',
      label: 'Dark Theme',
      type: 'radio' as const,
      checked: true
    },
    {
      id: 'theme-system',
      label: 'System Theme',
      type: 'radio' as const,
      checked: false
    },
    { id: 'divider2', type: 'divider' as const },
    {
      id: 'notifications',
      label: 'Enable Notifications',
      type: 'checkbox' as const,
      checked: true
    },
    {
      id: 'autosave',
      label: 'Auto-save Sessions',
      type: 'checkbox' as const,
      checked: false
    },
    { id: 'divider3', type: 'divider' as const },
    {
      id: 'terminate',
      label: 'Terminate Session',
      type: 'action' as const,
      danger: true,
      action: () => console.log('Terminate clicked')
    }
  ];

  function handleItemClick(event: CustomEvent) {
    console.log('Item clicked:', event.detail.item);
  }

  function handleMenuOpened() {
    console.log('Menu opened');
  }

  function handleMenuClosed() {
    console.log('Menu closed');
  }
</script>

<div class="p-8 space-y-8">
  <h1 class="text-2xl font-bold">CompactMenu Examples</h1>

  <!-- Basic menu -->
  <div>
    <h2 class="text-lg font-semibold mb-4">Basic Menu</h2>
    <CompactMenu
      items={menuItems}
      label="Actions"
      on:item-clicked={handleItemClick}
      on:menu-opened={handleMenuOpened}
      on:menu-closed={handleMenuClosed}
    />
  </div>

  <!-- Menu with custom icon -->
  <div>
    <h2 class="text-lg font-semibold mb-4">Menu with Custom Icon</h2>
    <CompactMenu
      items={menuItems}
      icon="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      label="Star Menu"
      position="bottom-left"
    />
  </div>

  <!-- Menu positioned at top -->
  <div class="mt-16">
    <h2 class="text-lg font-semibold mb-4">Top-positioned Menu</h2>
    <CompactMenu
      items={menuItems}
      position="top-right"
      label="Top Menu"
    />
  </div>
</div>