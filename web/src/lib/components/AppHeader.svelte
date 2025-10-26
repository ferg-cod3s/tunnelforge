<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Session, User } from '$lib/types';
  import FullHeader from './FullHeader.svelte';
  import SidebarHeader from './SidebarHeader.svelte';

  // Props
  interface Props {
    sessions?: Session[];
    hideExited?: boolean;
    showSplitView?: boolean;
    user?: User;
    notificationCount?: number;
  }

  let {
    sessions = [],
    hideExited = true,
    showSplitView = false,
    user,
    notificationCount = 0
  }: Props = $props();

  // Events
  const dispatch = createEventDispatcher<{
    'create-session': void;
    'hide-exited-change': { hideExited: boolean };
    'kill-all-sessions': void;
    'clean-exited-sessions': void;
    'open-file-browser': void;
    'open-tmux-sessions': void;
    'open-settings': void;
    'logout': void;
    'navigate-to-list': void;
    'toggle-sidebar': void;
  }>();

  // Forward events from child components
  function forwardEvent(event: CustomEvent) {
    dispatch(event.type as any, event.detail);
  }
</script>

{#if showSplitView}
  <SidebarHeader
    {sessions}
    {hideExited}
    {user}
    {notificationCount}
    on:create-session={forwardEvent}
    on:hide-exited-change={forwardEvent}
    on:kill-all-sessions={forwardEvent}
    on:clean-exited-sessions={forwardEvent}
    on:open-file-browser={forwardEvent}
    on:open-tmux-sessions={forwardEvent}
    on:open-settings={forwardEvent}
    on:logout={forwardEvent}
    on:navigate-to-list={forwardEvent}
    on:toggle-sidebar={forwardEvent}
  />
{:else}
  <FullHeader
    {sessions}
    {hideExited}
    {user}
    {notificationCount}
    on:create-session={forwardEvent}
    on:hide-exited-change={forwardEvent}
    on:kill-all-sessions={forwardEvent}
    on:clean-exited-sessions={forwardEvent}
    on:open-file-browser={forwardEvent}
    on:open-tmux-sessions={forwardEvent}
    on:open-settings={forwardEvent}
    on:logout={forwardEvent}
    on:navigate-to-list={forwardEvent}
  />
{/if}