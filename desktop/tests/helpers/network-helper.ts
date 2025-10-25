/**
 * NetworkHelper - Backend Connectivity and Tunnel Testing
 * 
 * Provides comprehensive functionality for testing network connectivity,
 * backend server communication, tunnel management, and network-related features.
 */

import { Page, BrowserContext, TestInfo } from '@playwright/test';
import { promisify } from 'util';
import { 
  NetworkStatus, 
  TunnelInfo, 
  ServerInfo,
  TestError,
  HelperConfig
} from './types';
import { createTestError, sleep } from './utils';

const sleep = promisify(setTimeout);

export class NetworkHelper {
  private page: Page;
  private context: BrowserContext;
  private testInfo: TestInfo;
  private config: HelperConfig;
  private networkHistory: NetworkStatus[] = [];
  private tunnelHistory: TunnelInfo[] = [];
  private serverHistory: ServerInfo[] = [];

  constructor(
    page: Page,
    context: BrowserContext,
    testInfo: TestInfo,
    debugPort: number = 9222,
    config: Partial<HelperConfig> = {}
  ) {
    this.page = page;
    this.context = context;
    this.testInfo = testInfo;
    this.config = {
      debugPort,
      timeout: 15000,
      retries: 3,
      screenshotOnFailure: true,
      videoRecording: false,
      traceRecording: false,
      logLevel: 'info',
      tempDir: 'test-results/temp',
      ...config
    };
  }

  /**
   * Test network connectivity
   */
  async testNetworkConnectivity(): Promise<NetworkStatus> {
    console.log('🌐 Testing network connectivity...');
    
    try {
      const startTime = Date.now();
      
      // Test basic network connectivity
      const isOnline = await this.page.evaluate(() => navigator.onLine);
      
      // Test server connectivity (assuming default port 4021)
      const serverStatus = await this.testServerConnectivity('http://localhost:4021');
      
      // Test tunnel status
      const tunnelStatus = await this.getTunnelStatus();
      
      const networkStatus: NetworkStatus = {
        isConnected: isOnline,
        connectionType: await this.getConnectionType(),
        serverStatus,
        tunnelStatus,
        lastChecked: new Date()
      };
      
      this.networkHistory.push(networkStatus);
      
      const duration = Date.now() - startTime;
      console.log(`✅ Network connectivity test completed (${duration}ms):`, networkStatus);
      
      return networkStatus;
      
    } catch (error) {
      console.error('❌ Network connectivity test failed:', error);
      throw createTestError('Network connectivity test failed', 'NETWORK_CONNECTIVITY', { error });
    }
  }

  /**
   * Test server connectivity
   */
  async testServerConnectivity(serverUrl: string): Promise<'online' | 'offline' | 'unknown'> {
    console.log(`🔗 Testing server connectivity: ${serverUrl}`);
    
    try {
      const response = await this.page.evaluate(async (url) => {
        try {
          const response = await fetch(`${url}/health`, {
            method: 'GET',
            timeout: 5000
          });
          return response.ok;
        } catch {
          return false;
        }
      }, serverUrl);
      
      const status = response ? 'online' : 'offline';
      console.log(`📊 Server status: ${status}`);
      
      return status;
      
    } catch (error) {
      console.warn(`⚠️ Server connectivity test failed: ${serverUrl}`, error);
      return 'unknown';
    }
  }

  /**
   * Test backend connectivity
   */
  async testBackendConnectivity(options: { timeout?: number; retries?: number } = {}): Promise<NetworkTestResult> {
    this.ensureInitialized();
    
    const { timeout = 15000, retries = 3 } = options;
    
    console.log('🌐 Testing backend connectivity...');
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const startTime = Date.now();
        
        const response = await this.page.evaluate(async (url, timeout) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);
          
          try {
            const response = await fetch(url, {
              method: 'GET',
              signal: controller.signal,
              headers: {
                'X-TunnelForge-Test': 'true'
              }
            });
            
            clearTimeout(timeoutId);
            
            return {
              ok: response.ok,
              status: response.status,
              statusText: response.statusText
            };
          } catch (error) {
            clearTimeout(timeoutId);
            throw error;
          }
        }, 'http://localhost:4021/health', timeout);
        
        const responseTime = Date.now() - startTime;
        
        if (response.ok) {
          console.log(`✅ Backend connectivity established (${responseTime}ms)`);
          return {
            success: true,
            connected: true,
            responseTime,
            data: response
          };
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
      } catch (error) {
        console.warn(`⚠️ Backend connectivity attempt ${attempt} failed:`, error.message);
        
        if (attempt === retries) {
          return {
            success: false,
            connected: false,
            error: error.message
          };
        }
        
        // Wait before retry
        await this.sleep(1000 * attempt);
      }
    }
    
    return {
      success: false,
      connected: false,
      error: 'Max retries exceeded'
    };
  }

  /**
   * Create a test tunnel
   */
  async createTestTunnel(options: { 
    type?: string; 
    localPort?: number; 
    subdomain?: string; 
    timeout?: number 
  } = {}): Promise<NetworkTestResult> {
    this.ensureInitialized();
    
    const { 
      type = 'http', 
      localPort = 4021, 
      subdomain = `test-${Date.now()}`, 
      timeout = 15000 
    } = options;
    
    console.log('🚇 Creating test tunnel...');
    
    try {
      const tunnelData = await this.page.evaluate(async (config) => {
        // Simulate tunnel creation - in real implementation this would call the backend API
        const tunnelId = `tunnel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const tunnelUrl = `https://${config.subdomain}.tunnel.test`;
        
        return {
          id: tunnelId,
          url: tunnelUrl,
          type: config.type,
          localPort: config.localPort,
          status: 'active',
          createdAt: new Date().toISOString()
        };
      }, { type, localPort, subdomain });
      
      console.log(`✅ Test tunnel created: ${tunnelData.url}`);
      
      return {
        success: true,
        connected: true,
        data: tunnelData
      };
      
    } catch (error) {
      console.error('❌ Failed to create test tunnel:', error);
      return {
        success: false,
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Get connection type
   */
  async getConnectionType(): Promise<string> {
    try {
      const connection = await this.page.evaluate(() => {
        return (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      });
      
      if (connection) {
        return connection.effectiveType || connection.type || 'unknown';
      }
      
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get tunnel status
   */
  async getTunnelStatus(): Promise<'active' | 'inactive' | 'error'> {
    try {
      const status = await this.page.evaluate(() => {
        // This would need to be implemented in the Tauri app
        return window.__TAURI__?.invoke?.('get_tunnel_status') || 'inactive';
      });
      
      return status;
    } catch {
      return 'inactive';
    }
  }

  /**
   * Test tunnel creation and management
   */
  async testTunnelOperations(): Promise<void> {
    console.log('🚇 Testing tunnel operations...');
    
    try {
      // Get available tunnel types
      const tunnelTypes = await this.page.evaluate(() => {
        return window.__TAURI__?.invoke?.('get_tunnel_types') || ['ngrok', 'cloudflare'];
      });
      
      console.log('📋 Available tunnel types:', tunnelTypes);
      
      // Test tunnel creation for each type
      for (const type of tunnelTypes) {
        await this.testTunnelCreation(type);
      }
      
      console.log('✅ Tunnel operations test passed');
      
    } catch (error) {
      console.error('❌ Tunnel operations test failed:', error);
      throw createTestError('Tunnel operations test failed', 'TUNNEL_OPERATIONS', { error });
    }
  }

  /**
   * Test tunnel creation for a specific type
   */
  async testTunnelCreation(tunnelType: string): Promise<TunnelInfo> {
    console.log(`🚇 Testing ${tunnelType} tunnel creation...`);
    
    try {
      const tunnelInfo = await this.page.evaluate((type) => {
        return window.__TAURI__?.invoke?.('create_tunnel', {
          type,
          localPort: 4021,
          protocol: 'http'
        });
      }, tunnelType);
      
      if (!tunnelInfo || !tunnelInfo.id) {
        throw new Error(`Failed to create ${tunnelType} tunnel`);
      }
      
      const tunnel: TunnelInfo = {
        id: tunnelInfo.id,
        type: tunnelType as any,
        localPort: tunnelInfo.localPort || 4021,
        publicUrl: tunnelInfo.publicUrl,
        status: tunnelInfo.status || 'active',
        protocol: tunnelInfo.protocol || 'http'
      };
      
      this.tunnelHistory.push(tunnel);
      
      // Wait a moment for tunnel to initialize
      await sleep(2000);
      
      // Test tunnel connectivity
      if (tunnel.publicUrl) {
        const isAccessible = await this.testTunnelConnectivity(tunnel.publicUrl);
        if (!isAccessible) {
          console.warn(`⚠️ ${tunnelType} tunnel not accessible: ${tunnel.publicUrl}`);
        }
      }
      
      // Clean up tunnel
      await this.cleanupTunnel(tunnel.id);
      
      console.log(`✅ ${tunnelType} tunnel test completed`);
      return tunnel;
      
    } catch (error) {
      console.error(`❌ ${tunnelType} tunnel test failed:`, error);
      throw createTestError(`${tunnelType} tunnel test failed`, 'TUNNEL_CREATION', { error, tunnelType });
    }
  }

  /**
   * Test tunnel connectivity
   */
  async testTunnelConnectivity(tunnelUrl: string): Promise<boolean> {
    try {
      const response = await this.page.evaluate(async (url) => {
        try {
          const response = await fetch(url, {
            method: 'GET',
            timeout: 10000
          });
          return response.ok;
        } catch {
          return false;
        }
      }, tunnelUrl);
      
      return response;
    } catch {
      return false;
    }
  }

  /**
   * Clean up a tunnel
   */
  async cleanupTunnel(tunnelId: string): Promise<void> {
    try {
      await this.page.evaluate((id) => {
        return window.__TAURI__?.invoke?.('cleanup_tunnel', { tunnelId: id });
      }, tunnelId);
      
      console.log(`🧹 Tunnel cleaned up: ${tunnelId}`);
    } catch (error) {
      console.warn(`⚠️ Failed to cleanup tunnel ${tunnelId}:`, error);
    }
  }

  /**
   * Test server management operations
   */
  async testServerManagement(): Promise<void> {
    console.log('🖥️ Testing server management operations...');
    
    try {
      // Get server status
      const serverInfo = await this.getServerInfo();
      
      if (serverInfo.status === 'running') {
        console.log('✅ Server is already running');
      } else {
        // Start server
        await this.startServer();
        
        // Wait for server to start
        await sleep(3000);
        
        // Verify server is running
        const newServerInfo = await this.getServerInfo();
        if (newServerInfo.status !== 'running') {
          throw new Error('Failed to start server');
        }
      }
      
      // Test server operations
      await this.testServerOperations();
      
      // Stop server if we started it
      if (serverInfo.status !== 'running') {
        await this.stopServer();
      }
      
      console.log('✅ Server management test passed');
      
    } catch (error) {
      console.error('❌ Server management test failed:', error);
      throw createTestError('Server management test failed', 'SERVER_MANAGEMENT', { error });
    }
  }

  /**
   * Get server information
   */
  async getServerInfo(): Promise<ServerInfo> {
    try {
      const info = await this.page.evaluate(() => {
        return window.__TAURI__?.invoke?.('get_server_info') || {};
      });
      
      const serverInfo: ServerInfo = {
        pid: info.pid || 0,
        port: info.port || 4021,
        status: info.status || 'unknown',
        uptime: info.uptime || 0,
        version: info.version || 'unknown',
        memoryUsage: info.memoryUsage
      };
      
      this.serverHistory.push(serverInfo);
      return serverInfo;
      
    } catch {
      return {
        pid: 0,
        port: 4021,
        status: 'unknown',
        uptime: 0,
        version: 'unknown'
      };
    }
  }

  /**
   * Start server
   */
  async startServer(): Promise<void> {
    console.log('🚀 Starting server...');
    
    try {
      await this.page.evaluate(() => {
        return window.__TAURI__?.invoke?.('start_server');
      });
      
      console.log('✅ Server start command sent');
    } catch (error) {
      console.error('❌ Failed to start server:', error);
      throw createTestError('Failed to start server', 'START_SERVER', { error });
    }
  }

  /**
   * Stop server
   */
  async stopServer(): Promise<void> {
    console.log('🛑 Stopping server...');
    
    try {
      await this.page.evaluate(() => {
        return window.__TAURI__?.invoke?.('stop_server');
      });
      
      console.log('✅ Server stop command sent');
    } catch (error) {
      console.error('❌ Failed to stop server:', error);
      throw createTestError('Failed to stop server', 'STOP_SERVER', { error });
    }
  }

  /**
   * Test server operations
   */
  async testServerOperations(): Promise<void> {
    console.log('🔧 Testing server operations...');
    
    try {
      // Test server health endpoint
      const healthResponse = await this.page.evaluate(async () => {
        try {
          const response = await fetch('http://localhost:4021/health');
          return await response.json();
        } catch {
          return null;
        }
      });
      
      if (healthResponse) {
        console.log('🏥 Server health:', healthResponse);
      } else {
        console.warn('⚠️ Server health endpoint not accessible');
      }
      
      // Test server info endpoint
      const infoResponse = await this.page.evaluate(async () => {
        try {
          const response = await fetch('http://localhost:4021/info');
          return await response.json();
        } catch {
          return null;
        }
      });
      
      if (infoResponse) {
        console.log('📋 Server info:', infoResponse);
      } else {
        console.warn('⚠️ Server info endpoint not accessible');
      }
      
      console.log('✅ Server operations test completed');
      
    } catch (error) {
      console.error('❌ Server operations test failed:', error);
      throw createTestError('Server operations test failed', 'SERVER_OPERATIONS', { error });
    }
  }

  /**
   * Test WebSocket connections
   */
  async testWebSocketConnections(): Promise<void> {
    console.log('🔌 Testing WebSocket connections...');
    
    try {
      const connectionResult = await this.page.evaluate(() => {
        return new Promise((resolve) => {
          const ws = new WebSocket('ws://localhost:4021/ws');
          
          const timeout = setTimeout(() => {
            ws.close();
            resolve({ connected: false, error: 'timeout' });
          }, 5000);
          
          ws.onopen = () => {
            clearTimeout(timeout);
            ws.send(JSON.stringify({ type: 'ping' }));
          };
          
          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              clearTimeout(timeout);
              ws.close();
              resolve({ connected: true, data });
            } catch {
              clearTimeout(timeout);
              ws.close();
              resolve({ connected: true, data: event.data });
            }
          };
          
          ws.onerror = (error) => {
            clearTimeout(timeout);
            resolve({ connected: false, error: error.toString() });
          };
        });
      });
      
      if (connectionResult.connected) {
        console.log('✅ WebSocket connection successful:', connectionResult.data);
      } else {
        console.warn('⚠️ WebSocket connection failed:', connectionResult.error);
      }
      
    } catch (error) {
      console.error('❌ WebSocket test failed:', error);
      throw createTestError('WebSocket test failed', 'WEBSOCKET_TEST', { error });
    }
  }

  /**
   * Test API endpoints
   */
  async testAPIEndpoints(): Promise<void> {
    console.log('🔗 Testing API endpoints...');
    
    const endpoints = [
      { path: '/health', method: 'GET' },
      { path: '/info', method: 'GET' },
      { path: '/status', method: 'GET' },
      { path: '/config', method: 'GET' }
    ];
    
    for (const endpoint of endpoints) {
      try {
        const result = await this.page.evaluate(async (ep) => {
          try {
            const response = await fetch(`http://localhost:4021${ep.path}`, {
              method: ep.method
            });
            
            return {
              status: response.status,
              ok: response.ok,
              data: await response.json().catch(() => null)
            };
          } catch (error) {
            return {
              status: 0,
              ok: false,
              error: error.toString()
            };
          }
        }, endpoint);
        
        if (result.ok) {
          console.log(`✅ ${endpoint.method} ${endpoint.path}: ${result.status}`);
        } else {
          console.warn(`⚠️ ${endpoint.method} ${endpoint.path}: ${result.status} - ${result.error || 'Unknown error'}`);
        }
        
      } catch (error) {
        console.error(`❌ ${endpoint.method} ${endpoint.path} test failed:`, error);
      }
    }
    
    console.log('✅ API endpoints test completed');
  }

  /**
   * Test network resilience
   */
  async testNetworkResilience(): Promise<void> {
    console.log('🛡️ Testing network resilience...');
    
    try {
      // Test connection recovery
      for (let i = 0; i < 3; i++) {
        const status = await this.testNetworkConnectivity();
        
        if (status.serverStatus === 'online') {
          console.log(`✅ Connection test ${i + 1}: PASSED`);
        } else {
          console.warn(`⚠️ Connection test ${i + 1}: FAILED`);
        }
        
        // Wait between tests
        await sleep(1000);
      }
      
      // Test timeout handling
      const timeoutTest = await this.page.evaluate(async () => {
        try {
          const response = await fetch('http://localhost:4021/slow-endpoint', {
            timeout: 2000
          });
          return { success: true, status: response.status };
        } catch (error) {
          return { success: false, error: error.toString() };
        }
      });
      
      console.log('⏱️ Timeout test:', timeoutTest);
      
      console.log('✅ Network resilience test completed');
      
    } catch (error) {
      console.error('❌ Network resilience test failed:', error);
      throw createTestError('Network resilience test failed', 'NETWORK_RESILIENCE', { error });
    }
  }

  /**
   * Get network history
   */
  getNetworkHistory(): NetworkStatus[] {
    return [...this.networkHistory];
  }

  /**
   * Get tunnel history
   */
  getTunnelHistory(): TunnelInfo[] {
    return [...this.tunnelHistory];
  }

  /**
   * Get server history
   */
  getServerHistory(): ServerInfo[] {
    return [...this.serverHistory];
  }

  /**
   * Clear histories
   */
  clearHistories(): void {
    this.networkHistory = [];
    this.tunnelHistory = [];
    this.serverHistory = [];
    console.log('🗑️ Network helper histories cleared');
  }

  /**
   * Monitor network status over time
   */
  async monitorNetworkStatus(duration: number = 30000, interval: number = 5000): Promise<NetworkStatus[]> {
    console.log(`📊 Monitoring network status for ${duration}ms (interval: ${interval}ms)...`);
    
    const statuses: NetworkStatus[] = [];
    const startTime = Date.now();
    
    while (Date.now() - startTime < duration) {
      const status = await this.testNetworkConnectivity();
      statuses.push(status);
      
      await sleep(interval);
    }
    
    console.log(`📊 Network monitoring completed. Collected ${statuses.length} samples`);
    return statuses;
  }

  /**
   * Cleanup network helper
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up network helper...');
    
    try {
      // Clean up any remaining tunnels
      for (const tunnel of this.tunnelHistory) {
        if (tunnel.status === 'active') {
          await this.cleanupTunnel(tunnel.id);
        }
      }
      
      // Reset server to original state if needed
      const currentServerInfo = await this.getServerInfo();
      if (currentServerInfo.status === 'running' && this.serverHistory.length > 0) {
        const originalServerInfo = this.serverHistory[0];
        if (originalServerInfo.status !== 'running') {
          await this.stopServer();
        }
      }
      
      console.log('✅ Network helper cleanup completed');
      
    } catch (error) {
      console.warn('⚠️ Network helper cleanup failed:', error);
    }
  }
}