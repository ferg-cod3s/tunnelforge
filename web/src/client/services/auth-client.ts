import { BrowserSSHAgent } from './ssh-agent.js';

interface AuthResponse {
  success: boolean;
  token?: string;
  userId?: string;
  authMethod?: 'ssh-key' | 'password';
  error?: string;
}

interface Challenge {
  challengeId: string;
  challenge: string;
  expiresAt: number;
}

interface User {
  userId: string;
  token: string;
  authMethod: 'ssh-key' | 'password';
  loginTime: number;
}

export class AuthClient {
  private static readonly TOKEN_KEY = 'vibetunnel_auth_token';
  private static readonly USER_KEY = 'vibetunnel_user_data';

  private currentUser: User | null = null;
  private sshAgent: BrowserSSHAgent;

  constructor() {
    this.sshAgent = new BrowserSSHAgent();
    this.loadCurrentUser();
  }

  /**
   * Get SSH agent instance
   */
  getSSHAgent(): BrowserSSHAgent {
    return this.sshAgent;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.currentUser !== null && this.isTokenValid();
  }

  /**
   * Get current user info
   */
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Get current system user from server
   */
  async getCurrentSystemUser(): Promise<string> {
    try {
      const response = await fetch('/api/auth/current-user');
      if (response.ok) {
        const data = await response.json();
        return data.userId;
      }
      throw new Error('Failed to get current user');
    } catch (error) {
      console.error('Failed to get current system user:', error);
      throw error;
    }
  }

  /**
   * Get user avatar (macOS returns base64, others get generic)
   */
  async getUserAvatar(userId: string): Promise<string> {
    try {
      const response = await fetch(`/api/auth/avatar/${userId}`);
      if (response.ok) {
        const data = await response.json();

        if (data.avatar) {
          // If it's a data URL (base64), return as is
          if (data.avatar.startsWith('data:')) {
            return data.avatar;
          }
          // If it's a file path, we'd need to handle that differently
          // For now, fall back to generic avatar
        }
      }
    } catch (error) {
      console.error('Failed to get user avatar:', error);
    }

    // Return generic avatar SVG for non-macOS or when no avatar found
    return (
      'data:image/svg+xml;base64,' +
      btoa(`
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="24" fill="#6B7280"/>
        <circle cx="24" cy="18" r="8" fill="#9CA3AF"/>
        <path d="M8 38c0-8.837 7.163-16 16-16s16 7.163 16 16" fill="#9CA3AF"/>
      </svg>
    `)
    );
  }

  /**
   * Authenticate using SSH key (priority method)
   */
  async authenticateWithSSHKey(userId: string, keyId: string): Promise<AuthResponse> {
    try {
      // Check if SSH agent is unlocked
      if (!this.sshAgent.isUnlocked()) {
        return { success: false, error: 'SSH agent is locked' };
      }

      // Create challenge
      const challenge = await this.createChallenge(userId);

      // Sign challenge with SSH key
      const signatureResult = await this.sshAgent.sign(keyId, challenge.challenge);
      const publicKey = this.sshAgent.getPublicKey(keyId);

      if (!publicKey) {
        return { success: false, error: 'SSH key not found' };
      }

      // Send authentication request
      const response = await fetch('/api/auth/ssh-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          publicKey,
          signature: signatureResult.signature,
        }),
      });

      const result = await response.json();
      console.log('🔐 SSH key auth server response:', result);

      if (result.success) {
        console.log('✅ SSH key auth successful, setting current user');
        this.setCurrentUser({
          userId: result.userId,
          token: result.token,
          authMethod: 'ssh-key',
          loginTime: Date.now(),
        });
        console.log('👤 Current user set:', this.getCurrentUser());
      } else {
        console.log('❌ SSH key auth failed:', result.error);
      }

      return result;
    } catch (error) {
      console.error('SSH key authentication failed:', error);
      return { success: false, error: 'SSH key authentication failed' };
    }
  }

  /**
   * Authenticate using password (fallback method)
   */
  async authenticateWithPassword(userId: string, password: string): Promise<AuthResponse> {
    try {
      const response = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, password }),
      });

      const result = await response.json();

      if (result.success) {
        this.setCurrentUser({
          userId: result.userId,
          token: result.token,
          authMethod: 'password',
          loginTime: Date.now(),
        });
      }

      return result;
    } catch (error) {
      console.error('Password authentication failed:', error);
      return { success: false, error: 'Password authentication failed' };
    }
  }

  /**
   * Automated authentication - tries SSH keys first, then prompts for password
   */
  async authenticate(userId: string): Promise<AuthResponse> {
    console.log('🚀 Starting SSH authentication for user:', userId);

    // Try SSH key authentication first if agent is unlocked
    if (this.sshAgent.isUnlocked()) {
      const keys = this.sshAgent.listKeys();
      console.log(
        '🗝️ Found SSH keys:',
        keys.length,
        keys.map((k) => ({ id: k.id, name: k.name }))
      );

      for (const key of keys) {
        try {
          console.log(`🔑 Trying SSH key: ${key.name} (${key.id})`);
          const result = await this.authenticateWithSSHKey(userId, key.id);
          console.log(`🎯 SSH key ${key.name} result:`, result);

          if (result.success) {
            console.log(`✅ Authenticated with SSH key: ${key.name}`);
            return result;
          }
        } catch (error) {
          console.warn(`❌ SSH key authentication failed for key ${key.name}:`, error);
        }
      }
    } else {
      console.log('🔒 SSH agent is locked');
    }

    // SSH key auth failed or no keys available
    return {
      success: false,
      error: 'SSH key authentication failed. Password authentication required.',
    };
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      // Call server logout endpoint
      if (this.currentUser?.token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.currentUser.token}`,
            'Content-Type': 'application/json',
          },
        });
      }
    } catch (error) {
      console.warn('Server logout failed:', error);
    } finally {
      // Clear local state
      this.clearCurrentUser();
    }
  }

  /**
   * Get authorization header for API requests
   */
  getAuthHeader(): Record<string, string> {
    if (this.currentUser?.token) {
      return { Authorization: `Bearer ${this.currentUser.token}` };
    }
    console.warn('⚠️ No token available for auth header');
    return {};
  }

  /**
   * Verify current token with server
   */
  async verifyToken(): Promise<boolean> {
    if (!this.currentUser?.token) return false;

    try {
      const response = await fetch('/api/auth/verify', {
        headers: { Authorization: `Bearer ${this.currentUser.token}` },
      });

      const result = await response.json();
      return result.valid;
    } catch (error) {
      console.error('Token verification failed:', error);
      return false;
    }
  }

  /**
   * Unlock SSH agent (no-op since we don't use encryption)
   */
  async unlockSSHAgent(_passphrase: string): Promise<boolean> {
    return true; // Always unlocked
  }

  /**
   * Lock SSH agent (no-op since we don't use encryption)
   */
  lockSSHAgent(): void {
    // No-op since agent is always unlocked
  }

  /**
   * Check if SSH agent is unlocked
   */
  isSSHAgentUnlocked(): boolean {
    return true; // Always unlocked since we don't use encryption
  }

  // Private methods

  private async createChallenge(userId: string): Promise<Challenge> {
    const response = await fetch('/api/auth/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      throw new Error('Failed to create authentication challenge');
    }

    return response.json();
  }

  private setCurrentUser(user: User): void {
    this.currentUser = user;
    this.saveCurrentUser();
  }

  private clearCurrentUser(): void {
    this.currentUser = null;
    localStorage.removeItem(AuthClient.TOKEN_KEY);
    localStorage.removeItem(AuthClient.USER_KEY);
  }

  private saveCurrentUser(): void {
    if (this.currentUser) {
      localStorage.setItem(AuthClient.TOKEN_KEY, this.currentUser.token);
      localStorage.setItem(
        AuthClient.USER_KEY,
        JSON.stringify({
          userId: this.currentUser.userId,
          authMethod: this.currentUser.authMethod,
          loginTime: this.currentUser.loginTime,
        })
      );
    }
  }

  private loadCurrentUser(): void {
    try {
      const token = localStorage.getItem(AuthClient.TOKEN_KEY);
      const userData = localStorage.getItem(AuthClient.USER_KEY);

      if (token && userData) {
        const user = JSON.parse(userData);
        this.currentUser = {
          token,
          userId: user.userId,
          authMethod: user.authMethod,
          loginTime: user.loginTime,
        };

        // Verify token is still valid
        this.verifyToken().then((valid) => {
          if (!valid) {
            this.clearCurrentUser();
          }
        });
      }
    } catch (error) {
      console.error('Failed to load current user:', error);
      this.clearCurrentUser();
    }
  }

  private isTokenValid(): boolean {
    if (!this.currentUser) return false;

    // Check if token is expired (24 hours)
    const tokenAge = Date.now() - this.currentUser.loginTime;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    return tokenAge < maxAge;
  }
}

// Export singleton instance
export const authClient = new AuthClient();
