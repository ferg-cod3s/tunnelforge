<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ModalWrapper from './ModalWrapper.svelte';
  import type {
    MultiplexerStatus,
    MultiplexerTarget,
    MultiplexerType,
    TmuxPane,
    TmuxWindow,
  } from '$lib/types';

  // Props
  interface Props {
    open: boolean;
  }

  let { open }: Props = $props();

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    close: void;
    'navigate-to-session': { sessionId: string };
  }>();

  // Reactive state using Svelte 5 runes
  let activeTab = $state<MultiplexerType>('tmux');
  let multiplexerStatus = $state<MultiplexerStatus | null>(null);
  let windows = $state<Map<string, TmuxWindow[]>>(new Map());
  let panes = $state<Map<string, TmuxPane[]>>(new Map());
  let expandedSessions = $state<Set<string>>(new Set());
  let expandedWindows = $state<Set<string>>(new Set());
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Load multiplexer status when modal opens
  $effect(() => {
    if (open) {
      loadMultiplexerStatus();
    }
  });

  async function loadMultiplexerStatus() {
    loading = true;
    error = null;

    try {
      const response = await fetch('/api/multiplexer/status');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const status: MultiplexerStatus = await response.json();
      multiplexerStatus = status;

      // Set active tab to first available multiplexer
      if (!status.tmux.available) {
        if (status.zellij.available) {
          activeTab = 'zellij';
        } else if (status.screen.available) {
          activeTab = 'screen';
        }
      }

      // Load windows for tmux sessions
      windows.clear();
      if (status.tmux.available) {
        for (const session of status.tmux.sessions) {
          try {
            const windowsResponse = await fetch(
              `/api/multiplexer/tmux/sessions/${session.name}/windows`
            );
            if (windowsResponse.ok) {
              const { windows: sessionWindows }: { windows: TmuxWindow[] } = await windowsResponse.json();
              windows.set(session.name, sessionWindows);
            }
          } catch (error) {
            console.error(`Failed to load windows for tmux session ${session.name}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load multiplexer status:', error);
      error = 'Failed to load terminal sessions';
    } finally {
      loading = false;
    }
  }

  function toggleSession(sessionName: string) {
    if (expandedSessions.has(sessionName)) {
      expandedSessions.delete(sessionName);
    } else {
      expandedSessions.add(sessionName);
    }
  }

  function toggleWindow(sessionName: string, windowIndex: number) {
    const key = `${sessionName}:${windowIndex}`;
    if (expandedWindows.has(key)) {
      expandedWindows.delete(key);
    } else {
      expandedWindows.add(key);
      // Load panes for this window if not already loaded
      loadPanesForWindow(sessionName, windowIndex);
    }
  }

  async function loadPanesForWindow(sessionName: string, windowIndex: number) {
    const key = `${sessionName}:${windowIndex}`;
    if (panes.has(key)) return; // Already loaded

    try {
      const response = await fetch(
        `/api/multiplexer/tmux/sessions/${sessionName}/panes?window=${windowIndex}`
      );
      if (response.ok) {
        const { panes: windowPanes }: { panes: TmuxPane[] } = await response.json();
        panes.set(key, windowPanes);
      }
    } catch (error) {
      console.error(`Failed to load panes for window ${key}:`, error);
    }
  }

  function formatTimestamp(timestamp: string): string {
    const ts = Number.parseInt(timestamp, 10);
    if (Number.isNaN(ts)) return timestamp;

    const now = Math.floor(Date.now() / 1000);
    const diff = now - ts;

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  function formatPaneInfo(pane: TmuxPane): string {
    // If we have a meaningful title that's not just the hostname, use it
    if (pane.title && !pane.title.includes('< /dev/null') && !pane.title.match(/^[\w.-]+$/)) {
      return pane.title;
    }

    // If we have a current path, show it with the command
    if (pane.currentPath && pane.command) {
      // Simple home directory replacement for display
      const shortPath = pane.currentPath.replace(/^\/Users\/[^/]+/, '~');
      return `${pane.command} (${shortPath})`;
    }

    // Otherwise just show command or 'shell'
    return pane.command || 'shell';
  }

  async function attachToSession(target: MultiplexerTarget) {
    try {
      const response = await fetch('/api/multiplexer/attach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: target.type,
          sessionName: target.session,
          windowIndex: target.window,
          paneIndex: target.pane,
          cols: window.innerWidth > 768 ? 120 : 80,
          rows: window.innerHeight > 600 ? 30 : 24,
          titleMode: 'dynamic',
          metadata: {
            source: 'multiplexer-modal',
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: {
        success: boolean;
        sessionId?: string;
        command?: string;
      } = await response.json();

      if (result.success) {
        // Close modal and navigate to the new session
        handleClose();
        // Dispatch navigation event that the app can handle
        dispatch('navigate-to-session', { sessionId: result.sessionId! });
      }
    } catch (error) {
      console.error(`Failed to attach to ${target.type} session:`, error);
      error = `Failed to attach to ${target.type} session`;
    }
  }

  async function createNewSession() {
    try {
      // Generate a unique session name
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const sessionName = `session-${timestamp}`;

      if (activeTab === 'tmux' || activeTab === 'screen') {
        // For tmux and screen, create the session first
        const createResponse = await fetch('/api/multiplexer/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: activeTab,
            name: sessionName,
          }),
        });

        if (!createResponse.ok) {
          throw new Error(`Failed to create ${activeTab} session`);
        }

        const createResult: { success: boolean } = await createResponse.json();
        if (!createResult.success) {
          throw new Error(`Failed to create ${activeTab} session`);
        }
      }

      // For all multiplexers, attach to the session
      // Zellij will create the session automatically with the -c flag
      const attachResponse = await fetch('/api/multiplexer/attach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: activeTab,
          sessionName: sessionName,
          cols: window.innerWidth > 768 ? 120 : 80,
          rows: window.innerHeight > 600 ? 30 : 24,
          titleMode: 'dynamic',
          metadata: {
            source: 'multiplexer-modal-new',
          },
        }),
      });

      if (!attachResponse.ok) {
        throw new Error(`HTTP ${attachResponse.status}: ${attachResponse.statusText}`);
      }

      const attachResult: {
        success: boolean;
        sessionId?: string;
        command?: string;
      } = await attachResponse.json();

      if (attachResult.success) {
        // Close modal and navigate to the new session
        handleClose();
        dispatch('navigate-to-session', { sessionId: attachResult.sessionId! });
      }
    } catch (error) {
      console.error(`Failed to create new ${activeTab} session:`, error);
      error = `Failed to create new ${activeTab} session`;
    }
  }

  async function killSession(type: MultiplexerType, sessionName: string) {
    if (
      !confirm(
        `Are you sure you want to kill session "${sessionName}"? This will terminate all windows and panes.`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/multiplexer/${type}/sessions/${sessionName}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: { success: boolean } = await response.json();
      if (result.success) {
        await loadMultiplexerStatus();
      }
    } catch (error) {
      console.error(`Failed to kill ${type} session:`, error);
      error = `Failed to kill ${type} session`;
    }
  }

  async function killWindow(sessionName: string, windowIndex: number) {
    if (
      !confirm(
        `Are you sure you want to kill window ${windowIndex}? This will terminate all panes in this window.`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        `/api/multiplexer/tmux/sessions/${sessionName}/windows/${windowIndex}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: { success: boolean } = await response.json();
      if (result.success) {
        await loadMultiplexerStatus();
      }
    } catch (error) {
      console.error(`Failed to kill window:`, error);
      error = `Failed to kill window`;
    }
  }

  async function killPane(sessionName: string, paneId: string) {
    if (!confirm(`Are you sure you want to kill this pane?`)) {
      return;
    }

    try {
      const response = await fetch(
        `/api/multiplexer/tmux/sessions/${sessionName}/panes/${paneId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: { success: boolean } = await response.json();
      if (result.success) {
        // Reload panes for the affected window
        panes.clear();
        expandedWindows.forEach((key) => {
          const [session, windowStr] = key.split(':');
          if (session === sessionName) {
            loadPanesForWindow(session, Number.parseInt(windowStr, 10));
          }
        });
      }
    } catch (error) {
      console.error(`Failed to kill pane:`, error);
      error = `Failed to kill pane`;
    }
  }

  function handleClose() {
    dispatch('close');
  }

  function switchTab(type: MultiplexerType) {
    activeTab = type;
  }
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <ModalWrapper visible={open} on:close={handleClose} ariaLabel="Terminal Sessions">
      <div class="w-full max-w-2xl max-h-[80vh] flex flex-col bg-bg-secondary border border-border rounded-xl p-6 shadow-xl">
        <h2 class="m-0 mb-4 text-xl font-semibold text-text">Terminal Sessions</h2>

        {#if multiplexerStatus && (multiplexerStatus.tmux.available || multiplexerStatus.zellij.available || multiplexerStatus.screen.available)}
          <div class="flex gap-2 mb-4 border-b border-border">
            {#if multiplexerStatus.tmux.available}
              <button
                class="px-4 py-2 border-none bg-transparent text-text-muted cursor-pointer relative transition-colors hover:text-text {activeTab === 'tmux' ? 'text-primary' : ''}"
                onclick={() => switchTab('tmux')}
              >
                tmux
                <span class="ml-2 text-xs px-1.5 py-0.5 bg-bg-tertiary rounded-full">{multiplexerStatus.tmux.sessions.length}</span>
                {#if activeTab === 'tmux'}
                  <div class="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-primary"></div>
                {/if}
              </button>
            {/if}
            {#if multiplexerStatus.zellij.available}
              <button
                class="px-4 py-2 border-none bg-transparent text-text-muted cursor-pointer relative transition-colors hover:text-text {activeTab === 'zellij' ? 'text-primary' : ''}"
                onclick={() => switchTab('zellij')}
              >
                Zellij
                <span class="ml-2 text-xs px-1.5 py-0.5 bg-bg-tertiary rounded-full">{multiplexerStatus.zellij.sessions.length}</span>
                {#if activeTab === 'zellij'}
                  <div class="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-primary"></div>
                {/if}
              </button>
            {/if}
            {#if multiplexerStatus.screen.available}
              <button
                class="px-4 py-2 border-none bg-transparent text-text-muted cursor-pointer relative transition-colors hover:text-text {activeTab === 'screen' ? 'text-primary' : ''}"
                onclick={() => switchTab('screen')}
              >
                Screen
                <span class="ml-2 text-xs px-1.5 py-0.5 bg-bg-tertiary rounded-full">{multiplexerStatus.screen.sessions.length}</span>
                {#if activeTab === 'screen'}
                  <div class="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-primary"></div>
                {/if}
              </button>
            {/if}
          </div>
        {/if}

        {#if loading}
          <div class="mb-4 p-3 bg-bg-tertiary rounded-lg text-text-muted text-center">Loading terminal sessions...</div>
        {:else if !multiplexerStatus}
          <div class="mb-4 p-3 bg-bg-tertiary rounded-lg text-text-muted text-center">No multiplexer status available</div>
        {:else if !multiplexerStatus.tmux.available && !multiplexerStatus.zellij.available && !multiplexerStatus.screen.available}
          <div class="text-center py-12 text-text-muted">
            <h3 class="m-0 mb-2 text-text">No Terminal Multiplexer Available</h3>
            <p>No terminal multiplexer (tmux, Zellij, or Screen) is installed on this system.</p>
            <p>Install tmux, Zellij, or GNU Screen to use this feature.</p>
          </div>
        {:else if !multiplexerStatus[activeTab].available}
          <div class="text-center py-12 text-text-muted">
            <h3 class="m-0 mb-2 text-text">{activeTab} Not Available</h3>
            <p>{activeTab} is not installed or not available on this system.</p>
            <p>Install {activeTab} to use this feature.</p>
          </div>
        {:else if error}
          <div class="mb-4 p-3 bg-bg-tertiary rounded-lg text-text-muted text-center">{error}</div>
        {:else if multiplexerStatus[activeTab].sessions.length === 0}
          <div class="text-center py-12 text-text-muted">
            <h3 class="m-0 mb-2 text-text">No {activeTab} Sessions</h3>
            <p>There are no active {activeTab} sessions.</p>
            <button class="mt-4 px-6 py-3 bg-primary text-white border-none rounded-md text-sm cursor-pointer transition-colors hover:bg-primary-hover" onclick={createNewSession}>
              Create New Session
            </button>
          </div>
        {:else}
          <div class="flex-1 overflow-y-auto -mx-4 px-4">
            {#each multiplexerStatus[activeTab].sessions as session (session.type + '-' + session.name)}
              {@const sessionWindows = windows.get(session.name) || []}
              {@const isExpanded = expandedSessions.has(session.name)}

              <div class="mb-2 border border-border rounded-lg overflow-hidden transition-all hover:border-primary hover:shadow-md">
                <div
                  class="px-4 py-3 bg-bg-secondary cursor-pointer flex items-center justify-between transition-colors hover:bg-bg-tertiary"
                  onclick={session.type === 'tmux' ? () => toggleSession(session.name) : undefined}
                  onkeydown={session.type === 'tmux' ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSession(session.name); } } : undefined}
                  style="cursor: {session.type === 'tmux' ? 'pointer' : 'default'}"
                  role={session.type === 'tmux' ? 'button' : undefined}
                  tabindex={session.type === 'tmux' ? 0 : undefined}
                >
                  <div class="flex-1">
                    <div class="font-semibold text-text mb-1">{session.name}</div>
                    <div class="text-sm text-text-muted flex gap-4">
                      {#if session.windows !== undefined}
                        <span>{session.windows} window{session.windows !== 1 ? 's' : ''}</span>
                      {/if}
                      {#if session.exited}
                        <span class="bg-red-500 text-white px-1.5 py-0.5 rounded text-xs font-semibold">EXITED</span>
                      {/if}
                      {#if session.activity}
                        <span>Last activity: {formatTimestamp(session.activity)}</span>
                      {/if}
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    {#if session.attached}
                      <div class="w-2 h-2 rounded-full bg-primary" title="Attached"></div>
                    {/if}
                    {#if session.current}
                      <div class="w-2 h-2 rounded-full bg-primary" title="Current"></div>
                    {/if}
                    <button
                      class="px-3 py-1.5 bg-primary text-white border-none rounded text-xs font-medium cursor-pointer transition-colors hover:bg-primary-hover active:scale-95"
                      onclick={(e) => {
                        e.stopPropagation();
                        attachToSession({
                          type: session.type,
                          session: session.name,
                        });
                      }}
                    >
                      Attach
                    </button>
                    <button
                      class="px-3 py-1.5 bg-red-500 text-white border-none rounded text-xs font-medium cursor-pointer transition-colors hover:bg-red-600 active:scale-95"
                      onclick={(e) => {
                        e.stopPropagation();
                        killSession(session.type, session.name);
                      }}
                      title="Kill session"
                    >
                      Kill
                    </button>
                    {#if session.type === 'tmux'}
                      <span class="transition-transform {isExpanded ? 'rotate-90' : ''}">▶</span>
                    {/if}
                  </div>
                </div>

                {#if session.type === 'tmux' && isExpanded && sessionWindows.length > 0}
                  <div class="px-2 py-2 pl-8 bg-bg border-t border-border">
                    {#each sessionWindows as window (session.name + '-' + window.index)}
                      {@const windowKey = `${session.name}:${window.index}`}
                      {@const isWindowExpanded = expandedWindows.has(windowKey)}
                      {@const windowPanes = panes.get(windowKey) || []}

                      <div>
                        <div
                          class="p-2 mb-1 rounded cursor-pointer flex items-center justify-between transition-colors hover:bg-bg-secondary {window.active ? 'bg-bg-tertiary font-medium' : ''}"
                          onclick={(e) => {
                            e.stopPropagation();
                            if (window.panes > 1) {
                              toggleWindow(session.name, window.index);
                            } else {
                              attachToSession({
                                type: session.type,
                                session: session.name,
                                window: window.index,
                              });
                            }
                          }}
                          onkeydown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              if (window.panes > 1) {
                                toggleWindow(session.name, window.index);
                              } else {
                                attachToSession({
                                  type: session.type,
                                  session: session.name,
                                  window: window.index,
                                });
                              }
                            }
                          }}
                          role="button"
                          tabindex="0"
                        >
                          <div class="flex items-center gap-2">
                            <span class="font-mono text-sm text-text-muted">{window.index}:</span>
                            <span>{window.name}</span>
                          </div>
                          <div class="flex items-center gap-2">
                            <button
                              class="px-2 py-0.5 bg-red-500 text-white border-none rounded text-xs font-medium cursor-pointer transition-colors hover:bg-red-600 active:scale-95"
                              onclick={(e) => {
                                e.stopPropagation();
                                killWindow(session.name, window.index);
                              }}
                              title="Kill window"
                            >
                              Kill
                            </button>
                            <span class="text-xs text-text-dim">
                              {window.panes} pane{window.panes !== 1 ? 's' : ''}
                              {#if window.panes > 1}
                                <span class="ml-2 transition-transform {isWindowExpanded ? 'rotate-90' : ''}">▶</span>
                              {/if}
                            </span>
                          </div>
                        </div>

                        {#if isWindowExpanded && windowPanes.length > 0}
                          <div class="px-1 py-1 pl-6 bg-bg border-t border-border">
                            {#each windowPanes as pane (session.name + ':' + window.index + '.' + pane.index)}
                              <div
                                class="px-2 py-1.5 mb-0.5 rounded cursor-pointer flex items-center justify-between text-sm transition-colors hover:bg-bg-secondary {pane.active ? 'bg-bg-tertiary font-medium' : ''}"
                                onclick={(e) => {
                                  e.stopPropagation();
                                  attachToSession({
                                    type: session.type,
                                    session: session.name,
                                    window: window.index,
                                    pane: pane.index,
                                  });
                                }}
                                onkeydown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    attachToSession({
                                      type: session.type,
                                      session: session.name,
                                      window: window.index,
                                      pane: pane.index,
                                    });
                                  }
                                }}
                                role="button"
                                tabindex="0"
                              >
                                <div class="flex items-center gap-2">
                                  <span class="font-mono text-xs text-text-muted">%${pane.index}</span>
                                  <span class="text-text">{formatPaneInfo(pane)}</span>
                                </div>
                                <div class="flex items-center gap-2">
                                  <button
                                    class="px-2 py-0.5 bg-red-500 text-white border-none rounded text-xs font-medium cursor-pointer transition-colors hover:bg-red-600 active:scale-95"
                                    onclick={(e) => {
                                      e.stopPropagation();
                                      killPane(
                                        session.name,
                                        `${session.name}:${window.index}.${pane.index}`
                                      );
                                    }}
                                    title="Kill pane"
                                  >
                                    Kill
                                  </button>
                                  <span class="text-xs text-text-dim">{pane.width}×{pane.height}</span>
                                </div>
                              </div>
                            {/each}
                          </div>
                        {/if}
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}

        <div class="mt-4 flex gap-2 justify-end">
          <button class="px-4 py-2 border border-border rounded-md bg-bg-secondary text-text text-sm cursor-pointer transition-all hover:bg-bg-tertiary hover:border-primary" onclick={handleClose}>Cancel</button>
          {#if !loading && multiplexerStatus && multiplexerStatus[activeTab].available}
            <button class="px-4 py-2 bg-primary text-white border border-primary rounded-md text-sm cursor-pointer transition-colors hover:bg-primary-hover" onclick={createNewSession}>
              New Session
            </button>
          {/if}
        </div>
      </div>
    </ModalWrapper>
  </div>
{/if}