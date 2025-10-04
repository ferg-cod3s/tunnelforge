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
    class="fixed inset-0 bg-bg/80 backdrop-blur-sm flex items-center justify-center animate-fade-in"
    style="z-index: 110;"
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
    <div
      class="bg-elevated border border-border/50 rounded-xl shadow-2xl p-8 m-4 max-w-sm w-full animate-scale-in"
    >
      <h3 id="file-picker-title" class="text-xl font-bold text-primary mb-6">
        Select File
      </h3>

      {#if uploading}
        <div class="mb-6">
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm text-text-muted font-mono">Uploading...</span>
            <span class="text-sm text-primary font-mono font-medium">{Math.round(uploadProgress)}%</span>
          </div>
          <div class="w-full bg-bg-secondary rounded-full h-2 overflow-hidden">
            <div
              class="bg-gradient-to-r from-primary to-primary-light h-2 rounded-full transition-all duration-300 shadow-glow-sm"
              style="width: {uploadProgress}%"
            ></div>
          </div>
        </div>
      {:else}
        <div class="space-y-4">
          <button
            id="file-picker-choose-button"
            onclick={handleFileClick}
            class="w-full bg-primary text-bg font-medium py-4 px-6 rounded-lg flex items-center justify-center gap-3 transition-all duration-200 hover:bg-primary-light hover:shadow-glow active:scale-95"
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-5L9 2H4z" clip-rule="evenodd"/>
            </svg>
            <span class="font-mono">Choose File</span>
          </button>
        </div>
      {/if}

      <div class="mt-6 pt-6 border-t border-border/50">
        <button
          id="file-picker-cancel-button"
          onclick={handleCancel}
          class="w-full bg-bg-secondary border border-border/50 text-primary font-mono py-3 px-6 rounded-lg transition-all duration-200 hover:bg-surface hover:border-primary active:scale-95"
          disabled={uploading}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}