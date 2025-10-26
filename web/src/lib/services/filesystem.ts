import type {
  UploadResponse,
  FileSelectedEvent,
  DirectoryListing,
  FilePreview,
  FileDiff,
  FileDiffContent,
  GitRepoStatus,
  AuthConfig
} from '$lib/types';

export {
  type UploadResponse,
  type FileSelectedEvent,
  type DirectoryListing,
  type FilePreview,
  type FileDiff,
  type FileDiffContent,
  type GitRepoStatus,
  type AuthConfig
};

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

/**
 * Get auth configuration
 */
export async function getAuthConfig(): Promise<AuthConfig> {
  const response = await fetch('/api/auth/config');
  if (!response.ok) {
    throw new Error('Failed to fetch auth config');
  }
  return response.json();
}

/**
 * Browse directory contents
 */
export async function browseDirectory(
  path: string,
  options: {
    showHidden?: boolean;
    gitFilter?: 'all' | 'changed';
  } = {}
): Promise<DirectoryListing> {
  const params = new URLSearchParams({
    path,
    showHidden: (options.showHidden ?? false).toString(),
    gitFilter: options.gitFilter ?? 'all',
  });

  const response = await fetch(`/api/fs/browse?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to browse directory: ${response.status}`);
  }

  return response.json();
}

/**
 * Get file preview
 */
export async function getFilePreview(path: string): Promise<FilePreview> {
  const response = await fetch(`/api/fs/preview?path=${encodeURIComponent(path)}`);
  if (!response.ok) {
    throw new Error(`Failed to get file preview: ${response.status}`);
  }

  return response.json();
}

/**
 * Get file diff
 */
export async function getFileDiff(path: string): Promise<FileDiff> {
  const response = await fetch(`/api/fs/diff?path=${encodeURIComponent(path)}`);
  if (!response.ok) {
    throw new Error(`Failed to get file diff: ${response.status}`);
  }

  return response.json();
}

/**
 * Get file diff content
 */
export async function getFileDiffContent(path: string): Promise<FileDiffContent> {
  const response = await fetch(`/api/fs/diff-content?path=${encodeURIComponent(path)}`);
  if (!response.ok) {
    throw new Error(`Failed to get file diff content: ${response.status}`);
  }

  return response.json();
}