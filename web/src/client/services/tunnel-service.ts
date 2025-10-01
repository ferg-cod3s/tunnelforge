import type { AuthClient } from './auth-client.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('tunnel-service');

export interface TunnelConfig {
  tunnelId?: string;
  tunnelName?: string;
  hostname?: string;
  credentialsFile?: string;
  protocol?: string;
  originServerName?: string;
}

export interface TunnelStartRequest {
  port?: number;
  config?: TunnelConfig;
  type?: 'quick' | 'authenticated';
}

export interface TunnelStatus {
  running: boolean;
  type?: string;
  url?: string;
  port?: number;
  config?: TunnelConfig;
}

export interface TunnelService {
  type: string;
  installed: boolean;
  running: boolean;
}

export class TunnelAPIService {
  constructor(private authClient?: AuthClient) {}

  async listTunnelServices(): Promise<TunnelService[]> {
    const response = await fetch('/api/tunnels', {
      headers: this.getHeaders(),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to list tunnel services: ${response.statusText}`);
    }
    
    const data = await response.json();
    const tunnels = data.tunnels || {};
    return Object.values(tunnels);
  }

  async startTunnel(request: TunnelStartRequest): Promise<{ url?: string }> {
    const response = await fetch('/api/tunnels/cloudflare/start', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ port: request.port || 3000 }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to start tunnel');
    }
    
    return response.json();
  }

  async stopTunnel(): Promise<void> {
    const response = await fetch('/api/tunnels/cloudflare/stop', {
      method: 'POST',
      headers: this.getHeaders(),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to stop tunnel: ${response.statusText}`);
    }
  }

  async getCloudflareStatus(): Promise<TunnelStatus> {
    const response = await fetch('/api/tunnels/cloudflare/status', {
      headers: this.getHeaders(),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get tunnel status: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getCloudflareURL(): Promise<{ url: string }> {
    const response = await fetch('/api/tunnels/cloudflare/url', {
      headers: this.getHeaders(),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get tunnel URL: ${response.statusText}`);
    }
    
    return response.json();
  }

  async isCloudflareInstalled(): Promise<{ installed: boolean }> {
    const list = await this.listTunnelServices();
    const cloudflare = list.find(t => t.type === 'cloudflare');
    return { installed: cloudflare?.installed || false };
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (this.authClient?.token) {
      headers['Authorization'] = `Bearer ${this.authClient.token}`;
    }
    
    return headers;
  }
}
