<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { uploadFile, createFileInput, removeFileInput } from '$lib/services/filesystem';
  import type { FileSelectedEvent } from '$lib/types';

  // Svelte 5 event props
  interface Props {
    visible?: boolean;
    directSelect?: boolean;
    onfileselected?: (detail: FileSelectedEvent) => void;
    onfileerror?: (detail: string) => void;
    onfilecancel?: () => void;
  }

  let {
    visible = false,
    directSelect = false,
    onfileselected,
    onfileerror,
    onfilecancel
  }: Props = $props();

  // Svelte 5 state
  let uploading = $state(false);
  let uploadProgress = $state(0);
  let fileInput: HTMLInputElement | null = null;

  onMount(() => {
    console.log('📁 File picker component mounted');
    createFileInputElement();
  });

  onDestroy(() => {
    if (fileInput) {
      removeFileInput(fileInput);
      fileInput = null;
    }
  });

  // Watch for visible changes to handle directSelect
  $effect(() => {
    if (visible && directSelect) {
      // Small delay to ensure the component is ready
      setTimeout(() => {
        handleFileClick();
        // Reset visible state since we're not showing the dialog
        visible = false;
      }, 10);
    }
  });

  function createFileInputElement() {
    // Create a hidden file input element
    fileInput = createFileInput();
    fileInput.addEventListener('change', handleFileSelect);
  }

  async function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    try {
      await uploadFileToServer(file);
    } catch (error) {
      console.error('Failed to upload file:', error);
      onfileerror?.(error instanceof Error ? error.message : 'Failed to upload file');
    }

    // Reset the input value so the same file can be selected again
    input.value = '';
  }

  /**
   * Public method to upload a file programmatically (for drag & drop, paste)
   */
  async function uploadFileProgrammatically(file: File): Promise<void> {
    return uploadFileToServer(file);
  }

  /**
   * Public method to directly open the file picker without showing dialog
   */
  function openFilePicker(): void {
    handleFileClick();
  }

  /**
   * Public method to open file picker for images only
   */
  function openImagePicker(): void {
    if (!fileInput) {
      createFileInputElement();
    }

    if (fileInput) {
      fileInput.accept = 'image/*';
      fileInput.removeAttribute('capture');
      fileInput.click();
    }
  }

  /**
   * Public method to open camera for image capture
   */
  function openCamera(): void {
    if (!fileInput) {
      createFileInputElement();
    }

    if (fileInput) {
      fileInput.accept = 'image/*';
      fileInput.capture = 'environment';
      fileInput.click();
    }
  }

  async function uploadFileToServer(file: File): Promise<void> {
    uploading = true;
    uploadProgress = 0;

    try {
      const response = await uploadFile(file);

      if (response.success) {
        console.log(`File uploaded successfully: ${response.filename}`);
        onfileselected?.({
          path: response.path,
          relativePath: response.relativePath,
          filename: response.filename,
          originalName: response.originalName,
          size: response.size,
          mimetype: response.mimetype,
        });
      } else {
        throw new Error(response.error || 'Upload failed');
      }
    } catch (error) {
      throw error;
    } finally {
      uploading = false;
    }
  }

  function handleFileClick() {
    if (!fileInput) {
      createFileInputElement();
    }

    if (fileInput) {
      // Reset to allow all files and remove capture attribute for general file selection
      fileInput.accept = '*/*';
      fileInput.removeAttribute('capture');
      fileInput.click();
    }
  }

  function handleCancel() {
    onfilecancel?.();
  }

  // Expose methods for external use
  $effect(() => {
    // This effect runs when the component is mounted and makes methods available
    if (typeof window !== 'undefined') {
      (window as any).filePickerMethods = {
        uploadFile: uploadFileProgrammatically,
        openFilePicker,
        openImagePicker,
        openCamera,
      };
    }
  });
</script>

{#if visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="picker-backdrop"
    onclick={handleCancel}
    onkeydown={(e) => {
      if (e.key === 'Escape') {
        handleCancel();
      }
    }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="file-picker-title"
    tabindex="-1"
  >
    <div class="picker-dialog">
      <h3 id="file-picker-title" class="picker-title">
        Select File
      </h3>

      {#if uploading}
        <div class="upload-progress-container">
          <div class="upload-status">
            <span class="upload-label">Uploading...</span>
            <span class="upload-percentage">{Math.round(uploadProgress)}%</span>
          </div>
          <div class="progress-bar-track">
            <div
              class="progress-bar-fill"
              style="width: {uploadProgress}%"
            ></div>
          </div>
        </div>
      {:else}
        <div class="picker-actions">
          <button
            id="file-picker-choose-button"
            onclick={handleFileClick}
            class="choose-file-button"
          >
            <svg class="button-icon" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-5L9 2H4z" clip-rule="evenodd"/>
            </svg>
            <span>Choose File</span>
          </button>
        </div>
      {/if}

      <div class="picker-footer">
        <button
          id="file-picker-cancel-button"
          onclick={handleCancel}
          class="cancel-button"
          disabled={uploading}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .picker-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(var(--color-bg-rgb, 250 250 250), 0.8);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 110;
    animation: fadeIn var(--transition-base);
  }

  .picker-dialog {
    background: var(--color-bg-elevated);
    border: 1px solid rgba(var(--color-border-rgb, 229 229 229), 0.5);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-2xl, 0 25px 50px -12px rgba(0, 0, 0, 0.25));
    padding: var(--spacing-xl);
    margin: var(--spacing-md);
    max-width: 24rem;
    width: 100%;
    animation: scaleIn 0.2s ease-out;
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

  .picker-title {
    font-size: var(--font-size-xl, 1.25rem);
    font-weight: 700;
    color: var(--color-primary);
    margin-bottom: 1.5rem;
  }

  .upload-progress-container {
    margin-bottom: 1.5rem;
  }

  .upload-status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .upload-label {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    font-family: var(--font-mono);
  }

  .upload-percentage {
    font-size: var(--font-size-sm);
    color: var(--color-primary);
    font-family: var(--font-mono);
    font-weight: 500;
  }

  .progress-bar-track {
    width: 100%;
    background: var(--color-bg-secondary);
    border-radius: var(--radius-full);
    height: 0.5rem;
    overflow: hidden;
  }

  .progress-bar-fill {
    background: linear-gradient(to right, var(--color-primary), var(--color-accent-green));
    height: 0.5rem;
    border-radius: var(--radius-full);
    transition: width 0.3s ease;
    box-shadow: 0 0 8px rgba(255, 107, 53, 0.4);
  }

  .picker-actions {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .choose-file-button {
    width: 100%;
    background: var(--color-primary);
    color: white;
    font-weight: 500;
    padding: var(--spacing-md) 1.5rem;
    border: none;
    border-radius: var(--radius-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    cursor: pointer;
    transition: all var(--transition-base);
    font-family: var(--font-mono);
  }

  .choose-file-button:hover {
    opacity: 0.9;
    box-shadow: 0 0 12px rgba(255, 107, 53, 0.5);
  }

  .choose-file-button:active {
    transform: scale(0.95);
  }

  .button-icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  .picker-footer {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(var(--color-border-rgb, 229 229 229), 0.5);
  }

  .cancel-button {
    width: 100%;
    background: var(--color-bg-secondary);
    border: 1px solid rgba(var(--color-border-rgb, 229 229 229), 0.5);
    color: var(--color-primary);
    font-family: var(--font-mono);
    padding: 0.75rem 1.5rem;
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: all var(--transition-base);
  }

  .cancel-button:hover:not(:disabled) {
    background: var(--color-bg-tertiary);
    border-color: var(--color-primary);
  }

  .cancel-button:active:not(:disabled) {
    transform: scale(0.95);
  }

  .cancel-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>