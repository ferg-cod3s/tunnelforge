import { writable, derived } from 'svelte/store';
import type { AuthConfig } from '../types';

export const authConfig = writable<AuthConfig>({
  enableSSHKeys: false,
  disallowUserPassword: false,
  noAuth: false,
});

export const currentUserId = writable<string>('');
export const userAvatar = writable<string>('');
export const isLoading = writable<boolean>(false);
export const authError = writable<string>('');
export const authSuccess = writable<string>('');

export const isAuthenticated = writable<boolean>(false);

export const authToken = derived(
  isAuthenticated,
  $isAuthenticated => {
    if (!$isAuthenticated) return null;
    return localStorage.getItem('tunnelforge_auth_token');
  }
);
