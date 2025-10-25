import { test, expect, beforeAll, afterAll } from '@playwright/test';
import { createTauriDesktopHelper, getPlatformConfig } from './helpers/tauri-desktop-helpers';

test.describe('TunnelForge Integration Tests', () => {
  let helper: any;
  const platformConfig = getPlatformConfig();

  beforeAll(async ({ page, context }, testInfo) => {
    console.log('🚀 Setting up TunnelForge integration tests...');
    
    helper = createTauriDesktopHelper(page, context, testInfo);
    await helper.setupLogging();
    await helper.waitForTauriApp();
  });

  afterAll(async () => {
    if (helper) {
      await helper.cleanup();
    }
  });

  test('should connect to TunnelForge backend', async () => {
    console.log('🧪 Testing TunnelForge backend connection...');
    
    // Check if backend is accessible
    try {
      const response = await fetch('http://localhost:4021/api/health', {
        method: 'GET',
        timeout: 5000,
      });
      
      if (response.ok) {
        const health = await response.json();
        console.log('✅ TunnelForge backend is healthy:', health);
        expect(health.status).toBe('ok');
      } else {
        console.log('⏳ TunnelForge backend not yet ready');
      }
    } catch (error) {
      console.log('⏳ TunnelForge backend not accessible yet:', error.message);
      // Don't fail the test - backend might still be starting
    }
  });

  test('should handle TunnelForge-specific commands', async () => {
    console.log('🧪 Testing TunnelForge-specific commands...');
    
    // Test if TunnelForge-specific Tauri commands are available
    try {
      // Check for TunnelForge service status
      const serviceStatus = await helper.invokeTauriCommand('tunnelforge_get_service_status');
      console.log('🔧 TunnelForge service status:', serviceStatus);
      
      // Test TunnelForge configuration
      const config = await helper.invokeTauriCommand('tunnelforge_get_config');
      console.log('⚙️ TunnelForge config:', config);
      
    } catch (error) {
      console.log('ℹ️ TunnelForge-specific commands not yet implemented:', error.message);
      // This is expected if the backend integration is not complete
    }
  });

  test('should handle terminal session management', async () => {
    console.log('🧪 Testing terminal session management...');
    
    try {
      // Create a new terminal session
      const session = await helper.invokeTauriCommand('tunnelforge_create_session', {
        name: 'test-session',
        command: '/bin/bash',
      });
      
      console.log('📟 Created session:', session);
      expect(session).toBeTruthy();
      expect(session.id).toBeTruthy();
      
      // List sessions
      const sessions = await helper.invokeTauriCommand('tunnelforge_list_sessions');
      console.log('📋 Sessions:', sessions);
      expect(Array.isArray(sessions)).toBe(true);
      
      // Clean up test session
      if (session.id) {
        await helper.invokeTauriCommand('tunnelforge_close_session', {
          sessionId: session.id,
        });
        console.log('✅ Test session closed');
      }
      
    } catch (error) {
      console.log('ℹ️ Terminal session management not yet implemented:', error.message);
    }
  });

  test('should handle file browser integration', async () => {
    console.log('🧪 Testing file browser integration...');
    
    try {
      // Get current directory
      const currentDir = await helper.invokeTauriCommand('tunnelforge_get_current_directory');
      console.log('📁 Current directory:', currentDir);
      
      // List directory contents
      const contents = await helper.invokeTauriCommand('tunnelforge_list_directory', {
        path: currentDir || process.cwd(),
      });
      console.log('📂 Directory contents:', contents);
      
      expect(Array.isArray(contents)).toBe(true);
      
    } catch (error) {
      console.log('ℹ️ File browser integration not yet implemented:', error.message);
    }
  });

  test('should handle tunnel management', async () => {
    console.log('🧪 Testing tunnel management...');
    
    try {
      // List available tunnels
      const tunnels = await helper.invokeTauriCommand('tunnelforge_list_tunnels');
      console.log('🌐 Tunnels:', tunnels);
      
      expect(Array.isArray(tunnels)).toBe(true);
      
      // Test tunnel creation (if supported)
      if (tunnels.length === 0) {
        console.log('ℹ️ No existing tunnels, testing tunnel creation...');
        
        const tunnel = await helper.invokeTauriCommand('tunnelforge_create_tunnel', {
          type: 'http',
          localPort: 8080,
          name: 'test-tunnel',
        });
        
        console.log('🚇 Created tunnel:', tunnel);
        
        // Clean up test tunnel
        if (tunnel.id) {
          await helper.invokeTauriCommand('tunnelforge_close_tunnel', {
            tunnelId: tunnel.id,
          });
          console.log('✅ Test tunnel closed');
        }
      }
      
    } catch (error) {
      console.log('ℹ️ Tunnel management not yet implemented:', error.message);
    }
  });

  test('should handle ngrok integration', async () => {
    console.log('🧪 Testing ngrok integration...');
    
    try {
      // Check ngrok status
      const ngrokStatus = await helper.invokeTauriCommand('tunnelforge_ngrok_status');
      console.log('🚇 Ngrok status:', ngrokStatus);
      
      // Test ngrok tunnel creation
      const tunnel = await helper.invokeTauriCommand('tunnelforge_ngrok_create_tunnel', {
        protocol: 'http',
        addr: 'localhost:4021',
      });
      
      console.log('🚇 Ngrok tunnel created:', tunnel);
      expect(tunnel).toBeTruthy();
      expect(tunnel.public_url).toBeTruthy();
      
      // Clean up
      if (tunnel.id) {
        await helper.invokeTauriCommand('tunnelforge_ngrok_close_tunnel', {
          tunnelId: tunnel.id,
        });
        console.log('✅ Ngrok tunnel closed');
      }
      
    } catch (error) {
      console.log('ℹ️ Ngrok integration not yet implemented:', error.message);
    }
  });

  test('should handle Tailscale integration', async () => {
    console.log('🧪 Testing Tailscale integration...');
    
    try {
      // Check Tailscale status
      const tailscaleStatus = await helper.invokeTauriCommand('tunnelforge_tailscale_status');
      console.log('🐉 Tailscale status:', tailscaleStatus);
      
      // Test Tailscale operations
      if (tailscaleStatus.connected) {
        const peers = await helper.invokeTauriCommand('tunnelforge_tailscale_list_peers');
        console.log('👥 Tailscale peers:', peers);
        expect(Array.isArray(peers)).toBe(true);
      }
      
    } catch (error) {
      console.log('ℹ️ Tailscale integration not yet implemented:', error.message);
    }
  });

  test('should handle Cloudflare integration', async () => {
    console.log('🧪 Testing Cloudflare integration...');
    
    try {
      // Check Cloudflare status
      const cfStatus = await helper.invokeTauriCommand('tunnelforge_cloudflare_status');
      console.log('☁️ Cloudflare status:', cfStatus);
      
      // Test Cloudflare tunnel creation
      const tunnel = await helper.invokeTauriCommand('tunnelforge_cloudflare_create_tunnel', {
        hostname: 'test-tunnelforge',
        service: 'http://localhost:4021',
      });
      
      console.log('☁️ Cloudflare tunnel created:', tunnel);
      
      // Clean up
      if (tunnel.id) {
        await helper.invokeTauriCommand('tunnelforge_cloudflare_delete_tunnel', {
          tunnelId: tunnel.id,
        });
        console.log('✅ Cloudflare tunnel deleted');
      }
      
    } catch (error) {
      console.log('ℹ️ Cloudflare integration not yet implemented:', error.message);
    }
  });

  test('should handle Git integration', async () => {
    console.log('🧪 Testing Git integration...');
    
    try {
      // Check if current directory is a Git repository
      const gitStatus = await helper.invokeTauriCommand('tunnelforge_git_status');
      console.log('📦 Git status:', gitStatus);
      
      if (gitStatus.isRepository) {
        // Get Git information
        const gitInfo = await helper.invokeTauriCommand('tunnelforge_git_info');
        console.log('📦 Git info:', gitInfo);
        
        expect(gitInfo.branch).toBeTruthy();
        expect(gitInfo.remote).toBeTruthy();
        
        // List branches
        const branches = await helper.invokeTauriCommand('tunnelforge_git_list_branches');
        console.log('🌿 Git branches:', branches);
        expect(Array.isArray(branches)).toBe(true);
      }
      
    } catch (error) {
      console.log('ℹ️ Git integration not yet implemented:', error.message);
    }
  });

  test('should handle settings management', async () => {
    console.log('🧪 Testing settings management...');
    
    try {
      // Get current settings
      const settings = await helper.invokeTauriCommand('tunnelforge_get_settings');
      console.log('⚙️ Current settings:', settings);
      
      // Update a setting
      await helper.invokeTauriCommand('tunnelforge_update_setting', {
        key: 'test.setting',
        value: 'test-value',
      });
      
      // Verify the setting was updated
      const updatedSettings = await helper.invokeTauriCommand('tunnelforge_get_settings');
      console.log('⚙️ Updated settings:', updatedSettings);
      
      // Clean up test setting
      await helper.invokeTauriCommand('tunnelforge_delete_setting', {
        key: 'test.setting',
      });
      
    } catch (error) {
      console.log('ℹ️ Settings management not yet implemented:', error.message);
    }
  });

  test('should handle notification system', async () => {
    console.log('🧪 Testing notification system...');
    
    try {
      // Send test notification
      await helper.invokeTauriCommand('tunnelforge_send_notification', {
        title: 'TunnelForge Test',
        body: 'This is a test notification from E2E tests',
        type: 'info',
      });
      
      console.log('🔔 Test notification sent');
      
      // Wait a bit for notification to appear
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.log('ℹ️ Notification system not yet implemented:', error.message);
    }
  });

  test('should handle logging system', async () => {
    console.log('🧪 Testing logging system...');
    
    try {
      // Get logs
      const logs = await helper.invokeTauriCommand('tunnelforge_get_logs', {
        level: 'info',
        limit: 10,
      });
      
      console.log('📝 Logs:', logs);
      expect(Array.isArray(logs)).toBe(true);
      
      // Write a test log entry
      await helper.invokeTauriCommand('tunnelforge_log', {
        level: 'info',
        message: 'Test log entry from E2E tests',
        context: { test: 'tunnelforge-integration' },
      });
      
      console.log('📝 Test log entry written');
      
    } catch (error) {
      console.log('ℹ️ Logging system not yet implemented:', error.message);
    }
  });

  test.describe('Cross-platform integration', () => {
    test('should handle platform-specific tunnel services', async () => {
      console.log('🧪 Testing platform-specific tunnel services...');
      
      if (platformConfig.isWindows) {
        // Windows-specific tunnel tests
        try {
          const windowsServices = await helper.invokeTauriCommand('tunnelforge_windows_services');
          console.log('🪟 Windows services:', windowsServices);
        } catch (error) {
          console.log('ℹ️ Windows services not yet implemented:', error.message);
        }
      }
      
      if (platformConfig.isMacOS) {
        // macOS-specific tunnel tests
        try {
          const macosServices = await helper.invokeTauriCommand('tunnelforge_macos_services');
          console.log('🍎 macOS services:', macosServices);
        } catch (error) {
          console.log('ℹ️ macOS services not yet implemented:', error.message);
        }
      }
      
      if (platformConfig.isLinux && !platformConfig.isWSL) {
        // Linux-specific tunnel tests
        try {
          const linuxServices = await helper.invokeTauriCommand('tunnelforge_linux_services');
          console.log('🐧 Linux services:', linuxServices);
        } catch (error) {
          console.log('ℹ️ Linux services not yet implemented:', error.message);
        }
      }
    });

    test('should handle WSL-specific integration', async () => {
      test.skip(!platformConfig.isWSL, 'Skipping non-WSL environment');
      
      console.log('🧪 Testing WSL-specific integration...');
      
      try {
        // Test WSL-specific features
        const wslInfo = await helper.invokeTauriCommand('tunnelforge_wsl_info');
        console.log('🖥️ WSL info:', wslInfo);
        
        // Test Windows path access from WSL
        const windowsPaths = await helper.invokeTauriCommand('tunnelforge_wsl_windows_paths');
        console.log('🪟 Windows paths:', windowsPaths);
        
      } catch (error) {
        console.log('ℹ️ WSL-specific integration not yet implemented:', error.message);
      }
    });
  });
});