<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { authToken } from '$lib/stores/auth';
  import { uploadFile } from '$lib/services/filesystem';
  import type { Session } from '$lib/types';
  import { createLogger } from '$lib/utils/logger';

  const logger = createLogger('file-operations-manager');

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    'upload-complete': { file: File; response: any };
    'download-complete': { path: string; response: any };
    'operation-error': { operation: string; error: string };
  }>();

  // Props
  interface Props {
    session?: Session | null;
  }

  let { session = null }: Props = $props();

  // Svelte 5 state
  let isDragOver = $state(false);
  let uploadQueue = $state<Array<UploadItem>>([]);
  let downloadQueue = $state<Array<DownloadItem>>([]);
  let dragCounter = $state(0);
  let dragLeaveTimer = $state<ReturnType<typeof setTimeout> | null>(null);
  let globalDragOverTimer = $state<ReturnType<typeof setTimeout> | null>(null);

  // UI state
  let showUploadModal = $state(false);
  let showDownloadModal = $state(false);
  let selectedFiles = $state<FileList | null>(null);
  let downloadPath = $state('');

  // Upload item interface
  interface UploadItem {
    id: string;
    file: File;
    progress: number;
    status: 'pending' | 'uploading' | 'completed' | 'error';
    error?: string;
    startTime: number;
    endTime?: number;
  }

  // Download item interface
  interface DownloadItem {
    id: string;
    path: string;
    filename: string;
    progress: number;
    status: 'pending' | 'downloading' | 'completed' | 'error';
    error?: string;
    startTime: number;
    endTime?: number;
    size?: number;
  }

  // Derived state
  let activeUploads = $derived(() =>
    uploadQueue.filter(item => item.status === 'uploading')
  );

  let activeDownloads = $derived(() =>
    downloadQueue.filter(item => item.status === 'downloading')
  );

  // Bound event handlers for cleanup
  let boundHandleDragOver = handleDragOver;
  let boundHandleDragEnter = handleDragEnter;
  let boundHandleDragLeave = handleDragLeave;
  let boundHandleDrop = handleDrop;
  let boundHandleDragEnd = handleDragEnd;
  let boundGlobalDragOver = handleGlobalDragOver;

  // File size formatter
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Speed and ETA calculator
  function calculateSpeedAndETA(item: UploadItem | DownloadItem): { speed: string; eta: string } {
    const now = Date.now();
    const elapsed = now - item.startTime;
    const progress = item.progress / 100;
    const totalSize = 'size' in item && item.size ? item.size : ('file' in item ? item.file.size : 0);

    if (elapsed < 1000 || progress === 0) {
      return { speed: '--', eta: '--' };
    }

    const bytesProcessed = totalSize * progress;
    const speed = bytesProcessed / (elapsed / 1000); // bytes per second
    const remaining = totalSize - bytesProcessed;
    const eta = remaining / speed; // seconds

    const speedFormatted = formatFileSize(speed) + '/s';
    const etaFormatted = eta < 60 ? `${Math.round(eta)}s` :
                        eta < 3600 ? `${Math.round(eta / 60)}m` :
                        `${Math.round(eta / 3600)}h`;

    return { speed: speedFormatted, eta: etaFormatted };
  }

  // Upload functions
  async function uploadFileToServer(file: File): Promise<void> {
    if (!session?.id) {
      throw new Error('No active session');
    }

    const uploadItem: UploadItem = {
      id: crypto.randomUUID(),
      file,
      progress: 0,
      status: 'uploading',
      startTime: Date.now(),
    };

    uploadQueue.push(uploadItem);

    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', file);

      // Get auth token
      const token = $authToken;

      // Upload with progress tracking
      const response = await fetch(`/api/sessions/${session.id}/upload`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const result = await response.json();

      uploadItem.status = 'completed';
      uploadItem.progress = 100;
      uploadItem.endTime = Date.now();

      dispatch('upload-complete', { file, response: result });
      logger.log(`Successfully uploaded file: ${file.name}`);

    } catch (error) {
      uploadItem.status = 'error';
      uploadItem.error = error instanceof Error ? error.message : 'Upload failed';
      uploadItem.endTime = Date.now();

      dispatch('operation-error', {
        operation: 'upload',
        error: uploadItem.error
      });
      logger.error(`Failed to upload file: ${file.name}`, error);
    }
  }

  // Download functions
  async function downloadFile(path: string): Promise<void> {
    if (!session?.id) {
      throw new Error('No active session');
    }

    const filename = path.split('/').pop() || 'download';
    const downloadItem: DownloadItem = {
      id: crypto.randomUUID(),
      path,
      filename,
      progress: 0,
      status: 'downloading',
      startTime: Date.now(),
    };

    downloadQueue.push(downloadItem);

    try {
      const token = $authToken;
      const response = await fetch(`/api/sessions/${session.id}/download?path=${encodeURIComponent(path)}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      // Get content length for progress tracking
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        downloadItem.size = parseInt(contentLength, 10);
      }

      // Create download
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      // Create download link
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      downloadItem.status = 'completed';
      downloadItem.progress = 100;
      downloadItem.endTime = Date.now();

      dispatch('download-complete', { path, response });
      logger.log(`Successfully downloaded file: ${filename}`);

    } catch (error) {
      downloadItem.status = 'error';
      downloadItem.error = error instanceof Error ? error.message : 'Download failed';
      downloadItem.endTime = Date.now();

      dispatch('operation-error', {
        operation: 'download',
        error: downloadItem.error
      });
      logger.error(`Failed to download file: ${path}`, error);
    }
  }

  // Queue management
  function cancelUpload(id: string): void {
    const item = uploadQueue.find(item => item.id === id);
    if (item && item.status === 'uploading') {
      item.status = 'error';
      item.error = 'Cancelled by user';
      item.endTime = Date.now();
    }
  }

  function cancelDownload(id: string): void {
    const item = downloadQueue.find(item => item.id === id);
    if (item && item.status === 'downloading') {
      item.status = 'error';
      item.error = 'Cancelled by user';
      item.endTime = Date.now();
    }
  }

  function retryUpload(id: string): void {
    const item = uploadQueue.find(item => item.id === id);
    if (item && item.status === 'error') {
      item.status = 'pending';
      item.error = undefined;
      item.startTime = Date.now();
      item.endTime = undefined;
      // Re-upload
      uploadFileToServer(item.file);
    }
  }

  function retryDownload(id: string): void {
    const item = downloadQueue.find(item => item.id === id);
    if (item && item.status === 'error') {
      item.status = 'pending';
      item.error = undefined;
      item.startTime = Date.now();
      item.endTime = undefined;
      // Re-download
      downloadFile(item.path);
    }
  }

  function clearCompleted(): void {
    uploadQueue = uploadQueue.filter(item => item.status !== 'completed');
    downloadQueue = downloadQueue.filter(item => item.status !== 'completed');
  }

  // Drag & drop handlers
  function handleDragOver(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();

    // Clear any pending timers
    if (dragLeaveTimer) {
      clearTimeout(dragLeaveTimer);
      dragLeaveTimer = null;
    }
    if (globalDragOverTimer) {
      clearTimeout(globalDragOverTimer);
      globalDragOverTimer = null;
    }

    // Check if the drag contains files
    if (e.dataTransfer?.types.includes('Files')) {
      isDragOver = true;
    }
  }

  function handleDragEnter(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();

    // Clear any pending drag leave timer
    if (dragLeaveTimer) {
      clearTimeout(dragLeaveTimer);
      dragLeaveTimer = null;
    }

    dragCounter++;

    // Check if the drag contains files
    if (e.dataTransfer?.types.includes('Files')) {
      isDragOver = true;
    }
  }

  function handleDragLeave(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();

    dragCounter--;

    // Use a timer to handle the drag leave to avoid flicker when moving between elements
    if (dragLeaveTimer) {
      clearTimeout(dragLeaveTimer);
    }

    dragLeaveTimer = setTimeout(() => {
      // Check if we're really outside the drop zone
      if (dragCounter <= 0) {
        isDragOver = false;
        dragCounter = 0; // Reset to 0 to handle any counting inconsistencies
      }
    }, 100); // Small delay to handle rapid enter/leave events
  }

  async function handleDrop(e: DragEvent): Promise<void> {
    e.preventDefault();
    e.stopPropagation();

    // Clear any pending drag leave timer
    if (dragLeaveTimer) {
      clearTimeout(dragLeaveTimer);
      dragLeaveTimer = null;
    }

    isDragOver = false;
    dragCounter = 0; // Reset counter on drop

    const files = Array.from(e.dataTransfer?.files || []);

    if (files.length === 0) {
      logger.warn('No files found in drop');
      return;
    }

    // Upload all files sequentially
    for (const file of files) {
      try {
        await uploadFileToServer(file);
        logger.log(`Successfully uploaded dropped file: ${file.name}`);
      } catch (error) {
        logger.error(`Failed to upload dropped file: ${file.name}`, error);
      }
    }
  }

  function handleDragEnd(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();

    // Clear any pending drag leave timer
    if (dragLeaveTimer) {
      clearTimeout(dragLeaveTimer);
      dragLeaveTimer = null;
    }

    // Reset drag state when drag operation ends (e.g., user cancels with ESC)
    dragCounter = 0;
    isDragOver = false;

    logger.debug('Drag operation ended, resetting drag state');
  }

  function handleGlobalDragOver(_e: DragEvent): void {
    // Clear any existing timer
    if (globalDragOverTimer) {
      clearTimeout(globalDragOverTimer);
      globalDragOverTimer = null;
    }

    // If we have an active drag state, set a timer to clear it if no drag events occur
    if (dragCounter > 0) {
      globalDragOverTimer = setTimeout(() => {
        // If no drag events have occurred for 500ms, assume the drag left the window
        dragCounter = 0;
        isDragOver = false;
        logger.debug('No drag events detected, clearing drag state');
      }, 500);
    }
  }

  // UI handlers
  function closeUploadModal(): void {
    showUploadModal = false;
    selectedFiles = null;
  }

  function closeDownloadModal(): void {
    showDownloadModal = false;
    downloadPath = '';
  }

  function handleFileSelect(e: Event): void {
    const input = e.target as HTMLInputElement;
    selectedFiles = input.files;
  }

  async function handleUploadSelected(): Promise<void> {
    if (!selectedFiles) return;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      try {
        await uploadFileToServer(file);
      } catch (error) {
        logger.error(`Failed to upload selected file: ${file.name}`, error);
      }
    }

    closeUploadModal();
  }

  async function handleDownload(): Promise<void> {
    if (!downloadPath.trim()) return;

    try {
      await downloadFile(downloadPath.trim());
      closeDownloadModal();
    } catch (error) {
      logger.error(`Failed to download: ${downloadPath}`, error);
    }
  }

  // Setup drag & drop event listeners
  function setupEventListeners(): void {
    document.addEventListener('dragover', boundHandleDragOver);
    document.addEventListener('dragenter', boundHandleDragEnter);
    document.addEventListener('dragleave', boundHandleDragLeave);
    document.addEventListener('drop', boundHandleDrop);
    document.addEventListener('dragend', boundHandleDragEnd);
    document.addEventListener('dragover', boundGlobalDragOver, true);
  }

  function removeEventListeners(): void {
    document.removeEventListener('dragover', boundHandleDragOver);
    document.removeEventListener('dragenter', boundHandleDragEnter);
    document.removeEventListener('dragleave', boundHandleDragLeave);
    document.removeEventListener('drop', boundHandleDrop);
    document.removeEventListener('dragend', boundHandleDragEnd);
    document.removeEventListener('dragover', boundGlobalDragOver, true);

    // Clear any pending timers
    if (dragLeaveTimer) {
      clearTimeout(dragLeaveTimer);
      dragLeaveTimer = null;
    }
    if (globalDragOverTimer) {
      clearTimeout(globalDragOverTimer);
      globalDragOverTimer = null;
    }
  }

  // Lifecycle
  onMount(() => {
    setupEventListeners();
    logger.log('FileOperationsManager mounted');
  });

  onDestroy(() => {
    removeEventListeners();
    logger.log('FileOperationsManager destroyed');
  });


</script>

<!-- Drag overlay -->
{#if isDragOver}
  <div class="drag-overlay">
    <div class="drag-zone">
      <svg class="drop-icon" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
      </svg>
      <div class="drop-text">Drop files here to upload</div>
    </div>
  </div>
{/if}

<!-- Upload Modal -->
{#if showUploadModal}
  <div class="modal-backdrop" onclick={closeUploadModal}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h3 class="modal-title">Upload Files</h3>
        <button class="modal-close" onclick={closeUploadModal}>×</button>
      </div>

      <div class="modal-body">
        <div class="upload-zone">
          <input
            type="file"
            multiple
            id="file-input"
            class="file-input"
            onchange={handleFileSelect}
          />
          <label for="file-input" class="upload-button">
            <svg class="upload-icon" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
            </svg>
            Choose Files
          </label>
          <div class="upload-hint">or drag and drop files here</div>
        </div>

        {#if selectedFiles && selectedFiles.length > 0}
          <div class="selected-files">
            <h4>Selected Files ({selectedFiles.length})</h4>
            <div class="file-list">
              {#each Array.from(selectedFiles) as file}
                <div class="file-item">
                  <span class="file-name">{file.name}</span>
                  <span class="file-size">{formatFileSize(file.size)}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="cancel-button" onclick={closeUploadModal}>Cancel</button>
        <button
          class="upload-button-primary"
          onclick={handleUploadSelected}
          disabled={!selectedFiles || selectedFiles.length === 0}
        >
          Upload
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Download Modal -->
{#if showDownloadModal}
  <div class="modal-backdrop" onclick={closeDownloadModal}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h3 class="modal-title">Download File</h3>
        <button class="modal-close" onclick={closeDownloadModal}>×</button>
      </div>

      <div class="modal-body">
        <div class="download-form">
          <label for="download-path" class="form-label">File Path</label>
          <input
            type="text"
            id="download-path"
            class="form-input"
            placeholder="/path/to/file.txt"
            bind:value={downloadPath}
          />
          <div class="form-hint">Enter the full path to the file you want to download</div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="cancel-button" onclick={closeDownloadModal}>Cancel</button>
        <button
          class="download-button-primary"
          onclick={handleDownload}
          disabled={!downloadPath.trim()}
        >
          Download
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Progress Panel -->
{#if uploadQueue.length > 0 || downloadQueue.length > 0}
  <div class="progress-panel">
    <div class="progress-header">
      <h4>File Operations</h4>
      <button class="clear-button" onclick={clearCompleted} title="Clear completed">×</button>
    </div>

    <!-- Upload Progress -->
    {#if uploadQueue.length > 0}
      <div class="operation-section">
        <h5>Uploads ({uploadQueue.length})</h5>
        <div class="progress-list">
          {#each uploadQueue as item (item.id)}
            <div class="progress-item" class:error={item.status === 'error'}>
              <div class="item-info">
                <span class="item-name">{item.file.name}</span>
                <span class="item-size">{formatFileSize(item.file.size)}</span>
              </div>

              {#if item.status === 'uploading'}
                <div class="progress-details">
                  <div class="progress-bar">
                    <div class="progress-fill" style="width: {item.progress}%"></div>
                  </div>
                  <div class="progress-stats">
                    <span class="progress-percent">{item.progress}%</span>
                    {#if item.progress > 0}
                      {@const stats = calculateSpeedAndETA(item)}
                      <span class="progress-speed">{stats.speed}</span>
                      <span class="progress-eta">ETA: {stats.eta}</span>
                    {/if}
                  </div>
                </div>
              {:else if item.status === 'completed'}
                <div class="status-completed">✓ Completed</div>
              {:else if item.status === 'error'}
                <div class="status-error">✗ {item.error}</div>
              {/if}

              <div class="item-actions">
                {#if item.status === 'uploading'}
                  <button class="action-button cancel" onclick={() => cancelUpload(item.id)}>Cancel</button>
                {:else if item.status === 'error'}
                  <button class="action-button retry" onclick={() => retryUpload(item.id)}>Retry</button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Download Progress -->
    {#if downloadQueue.length > 0}
      <div class="operation-section">
        <h5>Downloads ({downloadQueue.length})</h5>
        <div class="progress-list">
          {#each downloadQueue as item (item.id)}
            <div class="progress-item" class:error={item.status === 'error'}>
              <div class="item-info">
                <span class="item-name">{item.filename}</span>
                {#if item.size}
                  <span class="item-size">{formatFileSize(item.size)}</span>
                {/if}
              </div>

              {#if item.status === 'downloading'}
                <div class="progress-details">
                  <div class="progress-bar">
                    <div class="progress-fill" style="width: {item.progress}%"></div>
                  </div>
                  <div class="progress-stats">
                    <span class="progress-percent">{item.progress}%</span>
                    {#if item.progress > 0}
                      {@const stats = calculateSpeedAndETA(item)}
                      <span class="progress-speed">{stats.speed}</span>
                      <span class="progress-eta">ETA: {stats.eta}</span>
                    {/if}
                  </div>
                </div>
              {:else if item.status === 'completed'}
                <div class="status-completed">✓ Completed</div>
              {:else if item.status === 'error'}
                <div class="status-error">✗ {item.error}</div>
              {/if}

              <div class="item-actions">
                {#if item.status === 'downloading'}
                  <button class="action-button cancel" onclick={() => cancelDownload(item.id)}>Cancel</button>
                {:else if item.status === 'error'}
                  <button class="action-button retry" onclick={() => retryDownload(item.id)}>Retry</button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  /* Drag overlay */
  .drag-overlay {
    position: fixed;
    inset: 0;
    background: rgba(var(--color-bg-rgb, 250 250 250), 0.9);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.2s ease-out;
  }

  .drag-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 3rem;
    border: 3px dashed var(--color-primary);
    border-radius: var(--radius-xl);
    background: var(--color-bg-elevated);
    box-shadow: var(--shadow-2xl);
  }

  .drop-icon {
    width: 4rem;
    height: 4rem;
    color: var(--color-primary);
  }

  .drop-text {
    font-size: var(--font-size-xl);
    font-weight: 600;
    color: var(--color-primary);
  }

  /* Modal styles */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(var(--color-bg-rgb, 250 250 250), 0.8);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn var(--transition-base);
  }

  .modal-content {
    background: var(--color-bg-elevated);
    border: 1px solid rgba(var(--color-border-rgb, 229 229 229), 0.5);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-2xl);
    max-width: 32rem;
    width: 100%;
    margin: var(--spacing-md);
    animation: scaleIn 0.2s ease-out;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-xl);
    border-bottom: 1px solid rgba(var(--color-border-rgb, 229 229 229), 0.5);
  }

  .modal-title {
    font-size: var(--font-size-xl);
    font-weight: 700;
    color: var(--color-primary);
    margin: 0;
  }

  .modal-close {
    background: none;
    border: none;
    font-size: var(--font-size-xl);
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: var(--radius-md);
    transition: all var(--transition-base);
  }

  .modal-close:hover {
    background: var(--color-bg-secondary);
    color: var(--color-primary);
  }

  .modal-body {
    padding: var(--spacing-xl);
  }

  .modal-footer {
    display: flex;
    gap: var(--spacing-md);
    justify-content: flex-end;
    padding: var(--spacing-xl);
    border-top: 1px solid rgba(var(--color-border-rgb, 229 229 229), 0.5);
  }

  /* Upload zone */
  .upload-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 2rem;
    border: 2px dashed var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-bg-secondary);
    transition: all var(--transition-base);
  }

  .upload-zone:hover {
    border-color: var(--color-primary);
    background: rgba(var(--color-primary-rgb, 255 107 53), 0.05);
  }

  .file-input {
    display: none;
  }

  .upload-button {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: var(--spacing-md) var(--spacing-xl);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-lg);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-base);
    font-family: var(--font-mono);
  }

  .upload-button:hover {
    opacity: 0.9;
    box-shadow: 0 0 12px rgba(255, 107, 53, 0.5);
  }

  .upload-icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  .upload-hint {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    text-align: center;
  }

  /* Selected files */
  .selected-files {
    margin-top: 1.5rem;
  }

  .selected-files h4 {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--color-primary);
    margin-bottom: 0.75rem;
  }

  .file-list {
    max-height: 12rem;
    overflow-y: auto;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }

  .file-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    border-bottom: 1px solid var(--color-border);
  }

  .file-item:last-child {
    border-bottom: none;
  }

  .file-name {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    color: var(--color-text);
  }

  .file-size {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    font-family: var(--font-mono);
  }

  /* Download form */
  .download-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .form-label {
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--color-text);
  }

  .form-input {
    padding: 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg);
    color: var(--color-text);
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
  }

  .form-input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb, 255 107 53), 0.1);
  }

  .form-hint {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  /* Buttons */
  .cancel-button,
  .upload-button-primary,
  .download-button-primary {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: var(--radius-lg);
    font-family: var(--font-mono);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-base);
  }

  .cancel-button {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    color: var(--color-primary);
  }

  .cancel-button:hover:not(:disabled) {
    background: var(--color-bg-tertiary);
    border-color: var(--color-primary);
  }

  .upload-button-primary,
  .download-button-primary {
    background: var(--color-primary);
    color: white;
  }

  .upload-button-primary:hover:not(:disabled),
  .download-button-primary:hover:not(:disabled) {
    opacity: 0.9;
    box-shadow: 0 0 12px rgba(255, 107, 53, 0.5);
  }

  .upload-button-primary:disabled,
  .download-button-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Progress panel */
  .progress-panel {
    position: fixed;
    bottom: var(--spacing-xl);
    right: var(--spacing-xl);
    background: var(--color-bg-elevated);
    border: 1px solid rgba(var(--color-border-rgb, 229 229 229), 0.5);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-2xl);
    min-width: 24rem;
    max-width: 32rem;
    max-height: 80vh;
    overflow: hidden;
    z-index: 900;
    animation: slideIn 0.3s ease-out;
  }

  .progress-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-lg);
    border-bottom: 1px solid rgba(var(--color-border-rgb, 229 229 229), 0.5);
  }

  .progress-header h4 {
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--color-primary);
    margin: 0;
  }

  .clear-button {
    background: none;
    border: none;
    font-size: var(--font-size-lg);
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: var(--radius-md);
    transition: all var(--transition-base);
  }

  .clear-button:hover {
    background: var(--color-bg-secondary);
    color: var(--color-primary);
  }

  .operation-section {
    padding: var(--spacing-lg);
    border-bottom: 1px solid rgba(var(--color-border-rgb, 229 229 229), 0.5);
  }

  .operation-section:last-child {
    border-bottom: none;
  }

  .operation-section h5 {
    font-size: var(--font-size-md);
    font-weight: 600;
    color: var(--color-primary);
    margin: 0 0 1rem 0;
  }

  .progress-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .progress-item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--color-bg-secondary);
    border-radius: var(--radius-md);
    border: 1px solid transparent;
    transition: all var(--transition-base);
  }

  .progress-item.error {
    border-color: var(--color-error);
    background: rgba(var(--color-error-rgb, 239 68 68), 0.05);
  }

  .item-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .item-name {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--color-text);
  }

  .item-size {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    font-family: var(--font-mono);
  }

  .progress-details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .progress-bar {
    width: 100%;
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-full);
    height: 0.5rem;
    overflow: hidden;
  }

  .progress-fill {
    background: linear-gradient(to right, var(--color-primary), var(--color-accent-green));
    height: 0.5rem;
    border-radius: var(--radius-full);
    transition: width 0.3s ease;
    box-shadow: 0 0 8px rgba(255, 107, 53, 0.4);
  }

  .progress-stats {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    font-family: var(--font-mono);
  }

  .progress-percent {
    font-weight: 500;
    color: var(--color-primary);
  }

  .progress-speed,
  .progress-eta {
    color: var(--color-text-muted);
  }

  .status-completed {
    font-size: var(--font-size-sm);
    color: var(--color-accent-green);
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .status-error {
    font-size: var(--font-size-sm);
    color: var(--color-error);
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .item-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .action-button {
    padding: 0.25rem 0.75rem;
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-size-xs);
    font-family: var(--font-mono);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-base);
  }

  .action-button.cancel {
    background: var(--color-error);
    color: white;
  }

  .action-button.cancel:hover {
    opacity: 0.9;
  }

  .action-button.retry {
    background: var(--color-accent-blue);
    color: white;
  }

  .action-button.retry:hover {
    opacity: 0.9;
  }

  /* Animations */
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(1rem);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Responsive */
  @media (max-width: 768px) {
    .progress-panel {
      bottom: var(--spacing-md);
      right: var(--spacing-md);
      left: var(--spacing-md);
      max-width: none;
    }

    .modal-content {
      margin: var(--spacing-sm);
      max-width: none;
    }

    .upload-zone {
      padding: 1.5rem;
    }

    .progress-stats {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
    }
  }
</style>