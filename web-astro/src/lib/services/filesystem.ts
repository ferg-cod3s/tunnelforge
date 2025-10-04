import type { UploadResponse, FileSelectedEvent } from '$lib/types';

export { type UploadResponse, type FileSelectedEvent };

/**
 * Upload a file to the server
 */
export async function uploadFile(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/files/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }

  return response.json();
}

/**
 * Create a hidden file input element for file selection
 */
export function createFileInput(accept = '*/*', capture?: string): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.style.display = 'none';

  if (capture) {
    input.capture = capture;
  }

  document.body.appendChild(input);
  return input;
}

/**
 * Remove a file input element from the DOM
 */
export function removeFileInput(input: HTMLInputElement): void {
  if (input.parentNode) {
    input.parentNode.removeChild(input);
  }
}