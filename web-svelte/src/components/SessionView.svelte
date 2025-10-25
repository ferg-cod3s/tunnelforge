<script lang="ts">
  /**
   * SessionView.svelte - Individual session display container
   *
   * Migrated from: web/src/client/components/session-view.ts (Lit)
   *
   * Handles:
   * - Terminal session rendering
   * - Session metadata display
   * - Session actions (kill, restart, etc.)
   * - Drag and drop support
   */

  import { onMount } from 'svelte';
  import Terminal from './Terminal.svelte';

  interface Props {
    sessionId: string;
    title?: string;
    workingDir?: string;
    command?: string;
    active?: boolean;
    onClose?: (sessionId: string) => void;
    onSelect?: (sessionId: string) => void;
  }

  let {
    sessionId,
    title = 'Terminal Session',
    workingDir = '~',
    command = '',
    active = false,
    onClose,
    onSelect
  }: Props = $props();

  let terminal: Terminal | null = $state(null);
  let isDragging = $state(false);

  // Focus terminal when active
  $effect(() => {
    if (active && terminal) {
      terminal.focus();
    }
  });

  function handleSessionClick() {
    onSelect?.(sessionId);
  }

  function handleCloseClick(event: MouseEvent) {
    event.stopPropagation();
    onClose?.(sessionId);
  }

  function handleDragStart(event: DragEvent) {
    isDragging = true;
    event.dataTransfer!.effectAllowed = 'move';
    event.dataTransfer!.setData('application/x-session-id', sessionId);
  }

  function handleDragEnd() {
    isDragging = false;
  }
</script>

<div
  class="session-view"
  class:active
  class:dragging={isDragging}
  onclick={handleSessionClick}
  draggable="true"
  ondragstart={handleDragStart}
  ondragend={handleDragEnd}
  role="tab"
  tabindex={active ? 0 : -1}
  aria-selected={active}
  aria-label={`Session: ${title}`}
>
  <div class="session-header">
    <div class="session-info">
      <div class="session-title">{title}</div>
      <div class="session-meta">
        <span class="working-dir">{workingDir}</span>
        {#if command}
          <span class="command-separator">•</span>
          <span class="command">{command}</span>
        {/if}
      </div>
    </div>

    <button
      class="close-button"
      onclick={handleCloseClick}
      aria-label="Close session"
      title="Close session"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
      </svg>
    </button>
  </div>

  <div class="session-terminal">
    <Terminal bind:this={terminal} {sessionId} />
  </div>
</div>

<style>
  .session-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #1e1e1e;
    border: 1px solid #3c3c3c;
    border-radius: 4px;
    overflow: hidden;
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .session-view:hover {
    border-color: #505050;
  }

  .session-view.active {
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 1px rgb(var(--color-primary) / 0.3);
  }

  .session-view.dragging {
    opacity: 0.5;
  }

  .session-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: #252526;
    border-bottom: 1px solid #3c3c3c;
    min-height: 40px;
  }

  .session-info {
    flex: 1;
    min-width: 0;
  }

  .session-title {
    font-size: 14px;
    font-weight: 500;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .session-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #888888;
    margin-top: 2px;
  }

  .working-dir {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
  }

  .command-separator {
    color: #555555;
  }

  .command {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 300px;
  }

  .close-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: #888888;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .close-button:hover {
    background: #3c3c3c;
    color: #ffffff;
  }

  .close-button:active {
    background: #505050;
  }

  .session-terminal {
    flex: 1;
    overflow: hidden;
  }

  /* Focus styles */
  .session-view:focus {
    outline: none;
  }

  .session-view:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: -2px;
  }
</style>
