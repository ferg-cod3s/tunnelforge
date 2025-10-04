export interface AuthResponse {
  success: boolean;
  token?: string;
  userId?: string;
  authMethod?: 'ssh-key' | 'password' | 'no-auth';
  error?: string;
}

export interface AuthConfig {
  enableSSHKeys: boolean;
  disallowUserPassword: boolean;
  noAuth: boolean;
}

export async function getCurrentSystemUser(): Promise<string> {
  const response = await fetch('/api/auth/current-user');
  if (response.ok) {
    const data = await response.json();
    return data.userId;
  }
  throw new Error('Failed to get current user');
}

export async function getUserAvatar(userId: string): Promise<string> {
  try {
    const response = await fetch(`/api/auth/avatar/${userId}`);
    if (response.ok) {
      const data = await response.json();
      if (data.avatar && data.avatar.startsWith('data:')) {
        return data.avatar;
      }
    }
  } catch (error) {
    console.error('Failed to get user avatar:', error);
  }

  const computedStyle = getComputedStyle(document.documentElement);
  const bgColor = computedStyle
    .getPropertyValue('--color-text-dim')
    .trim()
    .split(' ')
    .map((v) => Number.parseInt(v, 10));
  const fgColor = computedStyle
    .getPropertyValue('--color-text-muted')
    .trim()
    .split(' ')
    .map((v) => Number.parseInt(v, 10));
  const bgColorStr = `rgb(${bgColor.join(', ')})`;
  const fgColorStr = `rgb(${fgColor.join(', ')})`;

  return (
    'data:image/svg+xml;base64,' +
    btoa(`
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="24" fill="${bgColorStr}"/>
        <circle cx="24" cy="18" r="8" fill="${fgColorStr}"/>
        <path d="M8 38c0-8.837 7.163-16 16-16s16 7.163 16 16" fill="${fgColorStr}"/>
      </svg>
    `)
  );
}

export async function getAuthConfig(): Promise<AuthConfig> {
  const response = await fetch('/api/auth/config');
  if (response.ok) {
    return response.json();
  }
  return {
    enableSSHKeys: false,
    disallowUserPassword: false,
    noAuth: false,
  };
}

export async function authenticateWithPassword(userId: string, password: string): Promise<AuthResponse> {
  const response = await fetch('/api/auth/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, password }),
  });
  return response.json();
}

export async function authenticateWithSSHKey(userId: string): Promise<AuthResponse> {
  return {
    success: false,
    error: 'SSH key authentication not yet implemented in Svelte version',
  };
}
