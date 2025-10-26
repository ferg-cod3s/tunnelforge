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
    class="browser-backdrop"
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
      class="browser-container"
      onclick={(e) => e.stopPropagation()}
    >
      {#if isMobile && mobileView === 'preview'}
        <div class="mobile-swipe-indicator">
          <svg class="swipe-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        class="browser-content"
        data-testid="file-browser"
      >
        <!-- Compact Header -->
        <div class="browser-header">
          <div class="header-left">
            <button
              class="back-button"
              onclick={handleCancel}
            >
              <svg class="back-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 19l-7-7 7-7"
                ></path>
              </svg>
              <span>Back</span>
            </button>
            <div class="path-container">
              {#if editingPath}
                <input
                  bind:this={pathInputRef}
                  type="text"
                  value={pathInputValue}
                  oninput={handlePathInput}
                  onkeydown={handlePathKeyDown}
                  class="path-input"
                  placeholder="Enter path and press Enter"
                />
              {:else}
                <div
                  class="path-display"
                  title="{currentFullPath || currentPath || 'File Browser'} (click to edit)"
                  onclick={handlePathClick}
                  role="button"
                  tabindex="0"
                >
                  {formatPathForDisplay(currentFullPath || currentPath || 'File Browser')}
                </div>
              {/if}
              {#if gitStatus?.branch}
                <span class="git-branch">
                  {@html UIIcons.git} {gitStatus.branch}
                </span>
              {/if}
            </div>
          </div>
          <div class="header-right">
            {#if errorMessage}
              <div class="error-badge">
                {errorMessage}
              </div>
            {/if}
          </div>
        </div>

        <!-- Main content -->
        <div class="browser-main">
          <!-- File list -->
          <div
            class="file-list-panel"
            class:hidden={isMobile && mobileView === 'preview'}
            class:mobile-full={isMobile}
          >
            <!-- File list header with toggles -->
            <div class="file-list-header">
              <div class="filter-buttons">
                <button
                  class="filter-button"
                  class:active={gitFilter === 'changed'}
                  onclick={toggleGitFilter}
                  title="Show only Git changes"
                >
                  Git Changes
                </button>
                <button
                  class="filter-button"
                  class:active={showHidden}
                  onclick={toggleHidden}
                  title="Show hidden files"
                >
                  Hidden Files
                </button>
              </div>
            </div>

            <!-- File list content -->
            <div class="file-list-content">
              {#if loading}
                <div class="loading-state">
                  Loading...
                </div>
              {:else}
                {#if currentFullPath !== '/'}
                  <div
                    class="file-item parent-dir"
                    onclick={handleParentClick}
                    role="button"
                    tabindex="0"
                  >
                    {@html getParentDirectoryIcon()}
                    <span class="file-name muted">..</span>
                  </div>
                {/if}
                {#each files as file}
                  <div
                    class="file-item"
                    class:selected={selectedFile?.path === file.path}
                    onclick={() => handleFileClick(file)}
                    role="button"
                    tabindex="0"
                  >
                    <span class="file-icon-container">
                      {@html getFileIcon(file.name, file.type)}
                      {#if file.isSymlink}
                        <svg
                          class="symlink-indicator"
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
                      class="file-name"
                      class:directory={file.type === 'directory'}
                      title="{file.name}{file.isSymlink ? ' (symlink)' : ''}"
                      >{file.name}</span
                    >
                    <span class="git-status-badge">{@html renderGitStatusBadge(file.gitStatus)}</span>
                  </div>
                {/each}
              {/if}
            </div>
          </div>

          <!-- Preview pane -->
          <div
            class="preview-pane"
            class:hidden={isMobile && mobileView === 'list'}
            class:mobile-full={isMobile}
          >
            {#if selectedFile}
              <div
                class="preview-header"
                class:mobile={isMobile}
              >
                <div class="file-info" class:mobile={isMobile}>
                  {#if isMobile}
                    <button
                      onclick={() => {
                        mobileView = 'list';
                      }}
                      class="mobile-back-button"
                      title="Back to files"
                    >
                      <svg
                        class="back-icon"
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
                  <span class="file-icon-container">
                    {@html getFileIcon(selectedFile.name, selectedFile.type)}
                    {#if selectedFile.isSymlink}
                      <svg
                        class="symlink-indicator"
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
                  <span class="file-name" class:truncate={isMobile}
                    >{selectedFile.name}{selectedFile.isSymlink ? ' →' : ''}</span
                  >
                  {@html renderGitStatusBadge(selectedFile.gitStatus)}
                </div>
                <div
                  class="action-buttons"
                  class:mobile-grid={isMobile}
                >
                  {#if selectedFile.type === 'file'}
                    <button
                      class="action-button secondary"
                      onclick={() => selectedFile && handleCopyToClipboard(selectedFile.path)}
                      title="Copy path to clipboard (⌘C)"
                    >
                      Copy Path
                    </button>
                    {#if mode === 'browse'}
                      <button
                        class="action-button primary"
                        onclick={insertPathIntoTerminal}
                        title="Insert path into terminal (Enter)"
                      >
                        Insert Path
                      </button>
                    {/if}
                  {/if}
                  {#if selectedFile.gitStatus && selectedFile.gitStatus !== 'unchanged'}
                    <button
                      class="action-button secondary"
                      class:active={showDiff}
                      class:full-width={isMobile && selectedFile.type === 'file' && mode === 'browse'}
                      onclick={toggleDiff}
                    >
                      {showDiff ? 'View File' : 'View Diff'}
                    </button>
                  {/if}
                </div>
              </div>
            {/if}
            <div class="preview-content">
              {@html renderPreview()}
            </div>
          </div>
        </div>

        {#if mode === 'select'}
          <div class="footer-actions">
            <button class="footer-button ghost" onclick={handleCancel}>
              Cancel
            </button>
            <button class="footer-button primary" onclick={handleSelect}>
              Select Directory
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  /* Backdrop */
  .browser-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(var(--color-bg-rgb, 250 250 250), 0.8);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100;
  }

  /* Container */
  .browser-container {
    position: fixed;
    inset: 0;
    background: var(--color-bg);
    display: flex;
    flex-direction: column;
  }

  /* Mobile swipe indicator */
  .mobile-swipe-indicator {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-secondary);
    border-bottom: 1px solid rgba(var(--color-border-rgb, 229 229 229), 0.5);
    z-index: 10;
  }

  .swipe-icon {
    width: 1.25rem;
    height: 1.25rem;
    color: var(--color-text-muted);
  }

  /* Content wrapper */
  .browser-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Header */
  .browser-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid rgba(var(--color-border-rgb, 229 229 229), 0.5);
    background: var(--color-bg-secondary);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
    flex: 1;
  }

  .back-button {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--color-text-muted);
    transition: color var(--transition-base);
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
  }

  .back-button:hover {
    color: var(--color-primary);
  }

  .back-icon {
    width: 1rem;
    height: 1rem;
  }

  .path-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
    flex: 1;
  }

  .path-input {
    width: 100%;
    padding: 0.25rem 0.5rem;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    color: var(--color-text-primary);
  }

  .path-input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .path-display {
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-sm);
    transition: background var(--transition-base);
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .path-display:hover {
    background: var(--color-bg-tertiary);
  }

  .git-branch {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    flex-shrink: 0;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .error-badge {
    padding: 0.25rem 0.5rem;
    background: rgba(var(--color-status-error-rgb, 239 68 68), 0.1);
    color: var(--color-status-error);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
  }

  /* Main content */
  .browser-main {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  /* File list panel */
  .file-list-panel {
    width: 20rem;
    background: var(--color-bg-secondary);
    border-right: 1px solid rgba(var(--color-border-rgb, 229 229 229), 0.5);
    display: flex;
    flex-direction: column;
  }

  .file-list-panel.mobile-full {
    width: 100%;
  }

  .file-list-panel.hidden {
    display: none;
  }

  .file-list-header {
    background: var(--color-bg-secondary);
    border-bottom: 1px solid rgba(var(--color-border-rgb, 229 229 229), 0.5);
    padding: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .filter-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .filter-button {
    padding: 0.25rem 0.5rem;
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-primary);
    cursor: pointer;
    transition: all var(--transition-base);
  }

  .filter-button:hover {
    background: var(--color-bg-tertiary);
  }

  .filter-button.active {
    background: var(--color-primary);
    color: var(--color-bg);
    border-color: var(--color-primary);
  }

  .file-list-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: auto;
  }

  /* Custom scrollbar */
  .file-list-content::-webkit-scrollbar {
    width: 0.5rem;
  }

  .file-list-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .file-list-content::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: var(--radius-sm);
  }

  .file-list-content::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--color-text-muted);
  }

  .file-item {
    padding: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    transition: background var(--transition-base);
    border-bottom: 1px solid rgba(var(--color-border-rgb, 229 229 229), 0.5);
  }

  .file-item:hover {
    background: rgba(var(--color-bg-elevated-rgb, 255 255 255), 0.3);
  }

  .file-item.selected {
    background: rgba(var(--color-bg-elevated-rgb, 255 255 255), 0.3);
    border-left: 2px solid var(--color-primary);
  }

  .file-item.parent-dir {
    border-bottom: 1px solid rgba(var(--color-border-rgb, 229 229 229), 0.5);
  }

  .file-icon-container {
    flex-shrink: 0;
    position: relative;
  }

  .symlink-indicator {
    width: 0.75rem;
    height: 0.75rem;
    color: var(--color-text-muted);
    position: absolute;
    bottom: -0.25rem;
    right: -0.25rem;
  }

  .file-name {
    flex: 1;
    font-size: var(--font-size-sm);
    white-space: nowrap;
    color: var(--color-text-primary);
  }

  .file-name.directory {
    color: var(--color-status-info);
  }

  .file-name.muted {
    color: var(--color-text-muted);
  }

  .file-name.truncate {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .git-status-badge {
    flex-shrink: 0;
  }

  /* Preview pane */
  .preview-pane {
    flex: 1;
    background: var(--color-bg);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .preview-pane.mobile-full {
    width: 100%;
  }

  .preview-pane.hidden {
    display: none;
  }

  .preview-header {
    background: var(--color-bg-secondary);
    border-bottom: 1px solid rgba(var(--color-border-rgb, 229 229 229), 0.5);
    padding: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .preview-header.mobile {
    flex-direction: column;
    gap: 0.5rem;
  }

  .file-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .file-info.mobile {
    min-width: 0;
    width: 100%;
  }

  .mobile-back-button {
    color: var(--color-text-muted);
    transition: color var(--transition-base);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
  }

  .mobile-back-button:hover {
    color: var(--color-primary);
  }

  .action-buttons {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .action-buttons.mobile-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
    width: 100%;
  }

  .action-button {
    padding: 0.25rem 0.5rem;
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all var(--transition-base);
    border: 1px solid var(--color-border);
  }

  .action-button.secondary {
    background: var(--color-bg);
    color: var(--color-text-primary);
  }

  .action-button.secondary:hover {
    background: var(--color-bg-tertiary);
  }

  .action-button.secondary.active {
    background: var(--color-primary);
    color: var(--color-bg);
    border-color: var(--color-primary);
  }

  .action-button.primary {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }

  .action-button.primary:hover {
    opacity: 0.9;
  }

  .action-button.full-width {
    grid-column: span 2;
  }

  .preview-content {
    flex: 1;
    overflow: hidden;
  }

  /* Footer actions */
  .footer-actions {
    padding: 1rem;
    border-top: 1px solid rgba(var(--color-border-rgb, 229 229 229), 0.5);
    display: flex;
    gap: 1rem;
  }

  .footer-button {
    flex: 1;
    padding: 0.75rem;
    font-family: var(--font-mono);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-base);
    font-size: var(--font-size-sm);
  }

  .footer-button.ghost {
    background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
  }

  .footer-button.ghost:hover {
    background: var(--color-bg-secondary);
  }

  .footer-button.primary {
    background: var(--color-primary);
    color: white;
    border: 1px solid var(--color-primary);
  }

  .footer-button.primary:hover {
    opacity: 0.9;
  }
</style>