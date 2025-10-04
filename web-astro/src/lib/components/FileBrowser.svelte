<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createLogger } from '$lib/utils/logger';
  import { copyToClipboard, formatPathForDisplay } from '$lib/utils/path-utils';
  import {
    browseDirectory,
    getFilePreview,
    getFileDiff,
    getFileDiffContent,
    getAuthConfig,
    type FilePreview as FilePreviewType,
    type FileDiff,
    type FileDiffContent,
    type GitRepoStatus,
    type AuthConfig
  } from '$lib/services/filesystem';
  import {
    getFileIcon,
    getParentDirectoryIcon,
    renderGitStatusBadge,
    UIIcons
  } from '$lib/utils/file-icons';
  import type {
    Session,
    FileInfo,
    FileBrowserEventDetail,
    DirectorySelectedEventDetail
  } from '$lib/types';

  const logger = createLogger('file-browser');

  // Svelte 5 event props
  interface Props {
    visible?: boolean;
    mode?: 'browse' | 'select';
    session?: Session | null;
    oninsertpath?: (detail: FileBrowserEventDetail) => void;
    ondirectoryselected?: (detail: DirectorySelectedEventDetail) => void;
    onbrowsercancel?: () => void;
  }

  let {
    visible = false,
    mode = 'browse',
    session = null,
    oninsertpath,
    ondirectoryselected,
    onbrowsercancel
  }: Props = $props();

  // Svelte 5 state
  let currentPath = $state('');
  let currentFullPath = $state('');
  let files = $state<FileInfo[]>([]);
  let loading = $state(false);
  let selectedFile = $state<FileInfo | null>(null);
  let preview = $state<FilePreviewType | null>(null);
  let diff = $state<FileDiff | null>(null);
  let diffContent = $state<FileDiffContent | null>(null);
  let gitFilter = $state<'all' | 'changed'>('all');
  let showHidden = $state(false);
  let gitStatus = $state<GitRepoStatus | null>(null);
  let previewLoading = $state(false);
  let showDiff = $state(false);
  let errorMessage = $state('');
  let mobileView = $state<'list' | 'preview'>('list');
  let isMobile = $state(false);
  let editingPath = $state(false);
  let pathInputValue = $state('');

  let pathInputRef = $state<HTMLInputElement | null>(null);

  // Touch handling state
  let touchStartX = 0;
  let touchStartY = 0;

  onMount(async () => {
    logger.debug('File browser component mounted');

    // Check auth configuration
    await checkAuthConfig();

    if (visible) {
      currentPath = session?.workingDir || '.';
      await loadDirectory(currentPath);
    }

    // Event listeners
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    setupTouchHandlers();

    // Initial mobile check
    handleResize();
  });

  onDestroy(() => {
    document.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('resize', handleResize);
    removeTouchHandlers();
  });

  // Watch for visible changes
  $effect(() => {
    if (visible) {
      // Component just became visible
      currentPath = session?.workingDir || '.';
      loadDirectory(currentPath);
    }
  });

  // Watch for session changes
  $effect(() => {
    if (visible && session) {
      const oldWorkingDir = session.workingDir;
      const newWorkingDir = session.workingDir;

      if (oldWorkingDir !== newWorkingDir) {
        currentPath = newWorkingDir || '.';
        loadDirectory(currentPath);
      }
    }
  });

  async function loadDirectory(dirPath: string) {
    await loadDirectoryWithRetry(dirPath);
  }

  async function loadDirectoryWithRetry(
    dirPath: string,
    attempt = 1,
    maxRetries = 3
  ): Promise<void> {
    loading = true;
    try {
      const data = await browseDirectory(dirPath, {
        showHidden,
        gitFilter
      });

      // Use the absolute path (fullPath) instead of the potentially relative path
      currentPath = data.fullPath || data.path;
      currentFullPath = data.fullPath || data.path;
      files = (data.files || []).concat(data.directories || []);
      gitStatus = data.gitStatus || null;
      // Clear any previous error message on successful load
      errorMessage = '';
    } catch (error) {
      let errorMessageText = 'Failed to load directory';
      try {
        const errorData = error as any;
        errorMessageText = errorData.message || errorMessageText;
        // Add specific handling for 400 errors
        if (errorData.status === 400) {
          errorMessageText = `Invalid directory path: ${errorData.details || errorMessageText}`;
        }
      } catch {
        // If error isn't JSON, use default message
        errorMessageText = `Failed to load directory`;
      }

      logger.error(`failed to load directory: ${errorMessageText}`, error);

      // Retry on rate limit (429) or server errors
      if ((error as any)?.status === 429 || (error as any)?.status >= 500) {
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * 2 ** (attempt - 1), 10000); // Exponential backoff, max 10s
          if ((error as any)?.status === 429) {
            showErrorMessage(`Rate limited, retrying in ${delay / 1000}s...`);
          } else {
            showErrorMessage(`Server error, retrying in ${delay / 1000}s...`);
          }
          logger.debug(`Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          return loadDirectoryWithRetry(dirPath, attempt + 1, maxRetries);
        }
      }

      showErrorMessage(errorMessageText);
    } finally {
      loading = false;
    }
  }

  async function loadPreview(file: FileInfo) {
    if (file.type === 'directory') return;

    previewLoading = true;
    showDiff = false;

    try {
      preview = await getFilePreview(file.path);
    } catch (error) {
      logger.error('error loading preview:', error);
    } finally {
      previewLoading = false;
    }
  }

  async function loadDiff(file: FileInfo) {
    if (file.type === 'directory' || !file.gitStatus || file.gitStatus === 'unchanged') return;

    previewLoading = true;
    showDiff = true;

    try {
      // Load both the unified diff and the full content for Monaco
      const [diffResponse, contentResponse] = await Promise.all([
        getFileDiff(file.path),
        getFileDiffContent(file.path),
      ]);

      diff = diffResponse;
      diffContent = contentResponse;
    } catch (error) {
      logger.error('error loading diff:', error);
    } finally {
      previewLoading = false;
    }
  }

  function handleFileClick(file: FileInfo) {
    if (file.type === 'directory') {
      // Use the absolute path provided by the server
      loadDirectory(file.path);
    } else {
      // Clear previous state when selecting a new file
      if (selectedFile?.path !== file.path) {
        preview = null;
        diff = null;
        diffContent = null;
        showDiff = false;
      }
      // Set the selected file
      selectedFile = file;
      // On mobile, switch to preview view
      if (isMobile) {
        mobileView = 'preview';
      }
      // Always show file content by default, regardless of git filter
      loadPreview(file);
    }
  }

  async function handleCopyToClipboard(text: string) {
    const success = await copyToClipboard(text);
    if (success) {
      logger.debug(`copied to clipboard: ${text}`);
    } else {
      logger.error('failed to copy to clipboard');
    }
  }

  function insertPathIntoTerminal() {
    if (!selectedFile) return;

    // Construct absolute path by joining the current directory's full path with the file name
    let absolutePath: string;
    if (currentFullPath && selectedFile.name) {
      // Join the directory path with the file name
      absolutePath = currentFullPath.endsWith('/')
        ? currentFullPath + selectedFile.name
        : `${currentFullPath}/${selectedFile.name}`;
    } else {
      // Fallback to relative path if absolute path construction fails
      absolutePath = selectedFile.path;
    }

    // Dispatch event with the absolute file path
    oninsertpath?.({
      path: absolutePath,
      type: selectedFile.type,
    });

    // Close the file browser
    onbrowsercancel?.();
  }

  function showErrorMessage(message: string) {
    errorMessage = message;
    // Clear error message after 5 seconds
    setTimeout(() => {
      errorMessage = '';
    }, 5000);
  }

  function handleParentClick() {
    // Handle navigation to parent directory
    let parentPath: string;

    if (currentFullPath === '/') {
      // Already at root, can't go higher
      return;
    }

    if (currentFullPath) {
      // Use full path for accurate parent calculation
      const parts = currentFullPath.split('/').filter((part) => part !== '');
      if (parts.length === 0) {
        // We're at root
        parentPath = '/';
      } else {
        // Remove last part to get parent
        parts.pop();
        parentPath = parts.length === 0 ? '/' : `/${parts.join('/')}`;
      }
    } else {
      // Fallback to current path logic
      const parts = currentPath.split('/').filter((part) => part !== '');
      if (parts.length <= 1) {
        parentPath = '/';
      } else {
        parts.pop();
        parentPath = `/${parts.join('/')}`;
      }
    }

    loadDirectory(parentPath);
  }

  function toggleGitFilter() {
    gitFilter = gitFilter === 'all' ? 'changed' : 'all';
    loadDirectory(currentPath);
  }

  function toggleHidden() {
    showHidden = !showHidden;
    loadDirectory(currentPath);
  }

  function toggleDiff() {
    if (selectedFile?.gitStatus && selectedFile.gitStatus !== 'unchanged') {
      if (showDiff) {
        loadPreview(selectedFile);
      } else {
        loadDiff(selectedFile);
      }
    }
  }

  function handleSelect() {
    if (mode === 'select' && currentPath) {
      ondirectoryselected?.({
        path: currentFullPath || currentPath,
      });
    }
  }

  function handleCancel() {
    onbrowsercancel?.();
  }

  function renderPreview() {
    if (previewLoading) {
      return `<div class="flex items-center justify-center h-full text-text-muted">
        Loading preview...
      </div>`;
    }

    if (showDiff && (diff || diffContent)) {
      return renderDiff();
    }

    if (!preview) {
      return `<div class="flex flex-col items-center justify-center h-full text-text-muted">
        ${UIIcons.preview}
        <div>Select a file to preview</div>
      </div>`;
    }

    switch (preview.type) {
      case 'image':
        return `<div class="flex items-center justify-center p-4 h-full">
          <img
            src="${preview.url}"
            alt="${selectedFile?.name}"
            class="max-w-full max-h-full object-contain rounded"
          />
        </div>`;

      case 'text':
        return `<div class="h-full w-full p-4">
          <pre class="whitespace-pre-wrap font-mono text-sm">${preview.content || ''}</pre>
        </div>`;

      case 'binary':
        return `<div class="flex flex-col items-center justify-center h-full text-text-muted">
          ${UIIcons.binary}
          <div class="text-lg mb-2">Binary File</div>
          <div class="text-sm">${preview.humanSize || `${preview.size} bytes`}</div>
          <div class="text-sm text-text-muted mt-2">
            ${preview.mimeType || 'Unknown type'}
          </div>
        </div>`;

      default:
        return `<div class="flex items-center justify-center h-full text-text-muted">
          Unsupported file type
        </div>`;
    }
  }

  function renderDiff() {
    // For new files (added or untracked), we might not have a diff but we have diffContent
    if (!diffContent && (!diff || !diff.diff)) {
      return `<div class="flex items-center justify-center h-full text-text-muted">
        No changes in this file
      </div>`;
    }

    // If we have diff content, show it in Monaco's diff editor
    if (diffContent) {
      return `<div class="h-full w-full p-4">
        <pre class="whitespace-pre-wrap font-mono text-sm">${diffContent.modifiedContent || ''}</pre>
      </div>`;
    }

    // Fallback to simple diff display
    if (!diff) return '';
    const lines = diff.diff.split('\n');
    return `<div class="overflow-auto h-full p-4 font-mono text-xs">
      ${lines.map((line) => {
        let className = 'text-text-muted';
        if (line.startsWith('+')) className = 'text-status-success bg-status-success/10';
        else if (line.startsWith('-')) className = 'text-status-error bg-status-error/10';
        else if (line.startsWith('@@')) className = 'text-status-info font-semibold';

        return `<div class="whitespace-pre ${className}">${line}</div>`;
      }).join('')}
    </div>`;
  }

  async function checkAuthConfig() {
    try {
      const config: AuthConfig = await getAuthConfig();
      logger.debug('Auth config:', config);
    } catch (error) {
      logger.error('Failed to fetch auth config:', error);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!visible) return;

    if (e.key === 'Escape') {
      // Only handle escape when editing path
      if (editingPath) {
        e.preventDefault();
        cancelPathEdit();
      }
      // Let modal handle the general escape for closing
    } else if (
      e.key === 'Enter' &&
      selectedFile &&
      selectedFile.type === 'file' &&
      !editingPath
    ) {
      e.preventDefault();
      insertPathIntoTerminal();
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'c' && selectedFile) {
      e.preventDefault();
      handleCopyToClipboard(selectedFile.path);
    }
  }

  function handleResize() {
    isMobile = window.innerWidth < 768;
    if (!isMobile && mobileView === 'preview') {
      mobileView = 'list';
    }
  }

  function setupTouchHandlers() {
    if (!isMobile) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!visible || !isMobile) return;

      const deltaX = e.changedTouches[0].clientX - touchStartX;
      const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartY);

      // Only handle horizontal swipes
      if (Math.abs(deltaX) > 50 && deltaY < 50) {
        if (deltaX > 0) {
          // Swipe right
          if (mobileView === 'preview') {
            mobileView = 'list';
          } else {
            handleCancel();
          }
        }
      }
    };

    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchend', handleTouchEnd);
  }

  function removeTouchHandlers() {
    // Touch handlers are added to document, will be cleaned up automatically
  }

  function handlePathClick() {
    editingPath = true;
    pathInputValue = currentFullPath || currentPath || '';
    // Focus the input after render
    setTimeout(() => {
      if (pathInputRef) {
        pathInputRef.focus();
        pathInputRef.select();
      }
    }, 0);
  }

  function handlePathInput(e: Event) {
    const input = e.target as HTMLInputElement;
    pathInputValue = input.value;
  }

  function handlePathKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      navigateToPath();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelPathEdit();
    }
  }

  async function navigateToPath() {
    const path = pathInputValue.trim();
    if (path) {
      editingPath = false;
      await loadDirectory(path);
    } else {
      cancelPathEdit();
    }
  }

  function cancelPathEdit() {
    editingPath = false;
    pathInputValue = '';
  }
</script>

{#if visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="fixed inset-0 bg-bg/80 backdrop-blur-sm flex items-center justify-center"
    style="z-index: 1100;"
    onclick={handleCancel}
    onkeydown={(e) => {
      if (e.key === 'Escape') {
        handleCancel();
      }
    }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="file-browser-title"
    tabindex="-1"
  >
    <div
      class="fixed inset-0 bg-bg flex flex-col"
      onclick={(e) => e.stopPropagation()}
    >
      {#if isMobile && mobileView === 'preview'}
        <div class="absolute top-1/2 left-2 -translate-y-1/2 text-text-muted opacity-50">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
            ></path>
          </svg>
        </div>
      {/if}
      <div
        class="w-full h-full flex flex-col overflow-hidden"
        data-testid="file-browser"
      >
        <!-- Compact Header (like session-view) -->
        <div
          class="flex items-center justify-between px-3 py-2 border-b border-border/50 text-sm min-w-0 bg-bg-secondary"
          style="padding-top: max(0.5rem, env(safe-area-inset-top)); padding-left: max(0.75rem, env(safe-area-inset-left)); padding-right: max(0.75rem, env(safe-area-inset-right));"
        >
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <button
              class="text-text-muted hover:text-primary font-mono text-xs px-2 py-1 flex-shrink-0 transition-colors flex items-center gap-1"
              onclick={handleCancel}
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 19l-7-7 7-7"
                ></path>
              </svg>
              <span>Back</span>
            </button>
            <div class="text-primary min-w-0 flex-1 overflow-hidden flex items-center gap-2">
              {#if editingPath}
                <input
                  bind:this={pathInputRef}
                  type="text"
                  value={pathInputValue}
                  oninput={handlePathInput}
                  onkeydown={handlePathKeyDown}
                  class="bg-bg border border-border/50 rounded px-2 py-1 text-status-info text-xs sm:text-sm font-mono w-full min-w-0 focus:outline-none focus:border-primary"
                  placeholder="Enter path and press Enter"
                />
              {:else}
                <div
                  class="text-status-info text-xs sm:text-sm overflow-hidden text-ellipsis whitespace-nowrap font-mono cursor-pointer hover:bg-light rounded px-1 py-1 -mx-1"
                  title="{currentFullPath || currentPath || 'File Browser'} (click to edit)"
                  onclick={handlePathClick}
                  role="button"
                  tabindex="0"
                >
                  {formatPathForDisplay(currentFullPath || currentPath || 'File Browser')}
                </div>
              {/if}
              {#if gitStatus?.branch}
                <span class="text-text-muted text-xs flex items-center gap-1 font-mono flex-shrink-0">
                  {@html UIIcons.git} {gitStatus.branch}
                </span>
              {/if}
            </div>
          </div>
          <div class="flex items-center gap-2 text-xs flex-shrink-0 ml-2">
            {#if errorMessage}
              <div
                class="bg-status-error/20 border border-status-error text-status-error px-2 py-1 rounded text-xs"
              >
                {errorMessage}
              </div>
            {/if}
          </div>
        </div>

        <!-- Main content -->
        <div class="flex-1 flex overflow-hidden">
          <!-- File list -->
          <div
            class="{isMobile && mobileView === 'preview' ? 'hidden' : ''} {isMobile ? 'w-full' : 'w-80'} bg-bg-secondary border-r border-border/50 flex flex-col"
          >
            <!-- File list header with toggles -->
            <div
              class="bg-bg-secondary border-b border-border/50 p-3 flex items-center justify-between"
            >
              <div class="flex gap-2">
                <button
                  class="btn-secondary text-xs px-2 py-1 font-mono {gitFilter === 'changed' ? 'bg-primary text-bg' : ''}"
                  onclick={toggleGitFilter}
                  title="Show only Git changes"
                >
                  Git Changes
                </button>
                <button
                  class="btn-secondary text-xs px-2 py-1 font-mono {showHidden ? 'bg-primary text-bg' : ''}"
                  onclick={toggleHidden}
                  title="Show hidden files"
                >
                  Hidden Files
                </button>
              </div>
            </div>

            <!-- File list content -->
            <div
              class="flex-1 overflow-y-auto overflow-x-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent hover:scrollbar-thumb-white/30"
            >
              {#if loading}
                <div class="flex items-center justify-center h-full text-text-muted">
                  Loading...
                </div>
              {:else}
                {#if currentFullPath !== '/'}
                  <div
                    class="p-3 hover:bg-light cursor-pointer transition-colors flex items-center gap-2 border-b border-border/50"
                    onclick={handleParentClick}
                    role="button"
                    tabindex="0"
                  >
                    {@html getParentDirectoryIcon()}
                    <span class="text-text-muted">..</span>
                  </div>
                {/if}
                {#each files as file}
                  <div
                    class="p-3 hover:bg-light cursor-pointer transition-colors flex items-center gap-2
                    {selectedFile?.path === file.path
                      ? 'bg-light border-l-2 border-primary'
                      : ''}"
                    onclick={() => handleFileClick(file)}
                    role="button"
                    tabindex="0"
                  >
                    <span class="flex-shrink-0 relative">
                      {@html getFileIcon(file.name, file.type)}
                      {#if file.isSymlink}
                        <svg
                          class="w-3 h-3 text-text-muted absolute -bottom-1 -right-1">
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fill-rule="evenodd"
                            d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z"
                            clip-rule="evenodd"
                          />
                        </svg>
                      {/if}
                    </span>
                    <span
                      class="flex-1 text-sm whitespace-nowrap {file.type === 'directory' ? 'text-status-info' : 'text-text'}"
                      title="{file.name}{file.isSymlink ? ' (symlink)' : ''}"
                      >{file.name}</span
                    >
                    <span class="flex-shrink-0">{@html renderGitStatusBadge(file.gitStatus)}</span>
                  </div>
                {/each}
              {/if}
            </div>
          </div>

          <!-- Preview pane -->
          <div
            class="{isMobile && mobileView === 'list' ? 'hidden' : ''} {isMobile ? 'w-full' : 'flex-1'} bg-bg flex flex-col overflow-hidden"
          >
            {#if selectedFile}
              <div
                class="bg-bg-secondary border-b border-border/50 p-3 {isMobile ? 'space-y-2' : 'flex items-center justify-between'}"
              >
                <div class="flex items-center gap-2 {isMobile ? 'min-w-0' : ''}">
                  {#if isMobile}
                    <button
                      onclick={() => {
                        mobileView = 'list';
                      }}
                      class="text-text-muted hover:text-primary transition-colors flex-shrink-0"
                      title="Back to files"
                    >
                      <svg
                        class="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M15 19l-7-7 7-7"
                        ></path>
                      </svg>
                    </button>
                  {/if}
                  <span class="flex-shrink-0 relative">
                    {@html getFileIcon(selectedFile.name, selectedFile.type)}
                    {#if selectedFile.isSymlink}
                      <svg
                        class="w-3 h-3 text-muted absolute -bottom-1 -right-1"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fill-rule="evenodd"
                          d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z"
                          clip-rule="evenodd"
                        />
                      </svg>
                    {/if}
                  </span>
                  <span class="font-mono text-sm {isMobile ? 'truncate' : ''}"
                    >{selectedFile.name}{selectedFile.isSymlink ? ' →' : ''}</span
                  >
                  {@html renderGitStatusBadge(selectedFile.gitStatus)}
                </div>
                <div
                  class="{isMobile ? 'grid grid-cols-2 gap-2' : 'flex gap-2 flex-shrink-0'}"
                >
                  {#if selectedFile.type === 'file'}
                    <button
                      class="btn-secondary text-xs px-2 py-1 font-mono"
                      onclick={() => selectedFile && handleCopyToClipboard(selectedFile.path)}
                      title="Copy path to clipboard (⌘C)"
                    >
                      Copy Path
                    </button>
                    {#if mode === 'browse'}
                      <button
                        class="btn-primary text-xs px-2 py-1 font-mono"
                        onclick={insertPathIntoTerminal}
                        title="Insert path into terminal (Enter)"
                      >
                        Insert Path
                      </button>
                    {/if}
                  {/if}
                  {#if selectedFile.gitStatus && selectedFile.gitStatus !== 'unchanged'}
                    <button
                      class="btn-secondary text-xs px-2 py-1 font-mono {showDiff ? 'bg-primary text-bg' : ''} {isMobile &&
                      selectedFile.type === 'file' &&
                      mode === 'browse'
                        ? ''
                        : 'col-span-2'}"
                      onclick={toggleDiff}
                    >
                      {showDiff ? 'View File' : 'View Diff'}
                    </button>
                  {/if}
                </div>
              </div>
            {/if}
            <div class="flex-1 overflow-hidden">
              {@html renderPreview()}
            </div>
          </div>
        </div>

        {#if mode === 'select'}
          <div class="p-4 border-t border-border/50 flex gap-4">
            <button class="btn-ghost font-mono flex-1" onclick={handleCancel}>
              Cancel
            </button>
            <button class="btn-primary font-mono flex-1" onclick={handleSelect}>
              Select Directory
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}