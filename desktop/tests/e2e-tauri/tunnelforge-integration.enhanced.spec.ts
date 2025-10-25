import { test, expect, Page, BrowserContext } from '@playwright/test';
import { createTauriTestHelpers, getPlatformConfig } from '../helpers';
import { TunnelForgeTestConfig, TunnelForgeConfig } from '../helpers/types';

/**
 * Enhanced TunnelForge Integration Tests
 * 
 * These tests demonstrate the full integration capabilities of the Tauri test helper framework:
 * - Complete user workflows from start to finish
 * - Real-world usage scenarios
 * - Cross-platform compatibility testing
 * - Performance and reliability validation
 * - Error handling and recovery scenarios
 */

test.describe('Enhanced TunnelForge Integration', () => {
  let page: Page;
  let context: BrowserContext;
  let helpers: any;
  let config: TunnelForgeTestConfig;

  test.beforeAll(async ({ browser }) => {
    // Enhanced configuration for integration tests
    config = {
      timeouts: {
        default: 45000,
        network: 20000,
        command: 15000,
        ui: 10000
      },
      retries: {
        default: 3,
        network: 5,
        command: 3
      },
      performance: {
        enableMetrics: true,
        screenshotOnFailure: true,
        videoRecording: true
      },
      network: {
        baseUrl: 'http://localhost:1420',
        apiEndpoint: 'http://localhost:4021',
        timeout: 20000
      },
      platform: getPlatformConfig(),
      wsl: {
        enabled: getPlatformConfig().isWSL,
        displayServer: 'x11',
        audioSupport: false
      }
    };

    context = await browser.newContext({
      recordVideo: { dir: 'test-results/integration-videos/' },
      viewport: { width: 1200, height: 800 }
    });
    
    page = await context.newPage();
    helpers = await createTauriTestHelpers(page, context, test.info, config);
    
    console.log('🚀 Enhanced TunnelForge integration test setup complete');
  });

  test.afterAll(async () => {
    if (helpers) {
      await helpers.cleanup();
    }
    await context.close();
  });

  test.beforeEach(async () => {
    await helpers.tauriApp.navigateToApp();
    await helpers.tauriApp.waitForAppReady();
    await helpers.logging.startPerformanceLogging();
  });

  test.afterEach(async () => {
    const metrics = await helpers.logging.getPerformanceMetrics();
    console.log('📊 Integration Test Metrics:', metrics);
    
    if (test.info().status !== 'passed') {
      await helpers.tauriApp.takeScreenshot(`integration-failure-${test.info().title}`);
    }
    
    await helpers.logging.stopPerformanceLogging();
  });

  test('should complete full user onboarding workflow', async () => {
    console.log('🧪 Testing complete user onboarding workflow...');
    
    // Step 1: App initialization and welcome
    const healthCheck = await helpers.tauriApp.performHealthCheck();
    expect(healthCheck.healthy).toBe(true);
    
    // Step 2: First-time setup and configuration
    const initialConfig = {
      isFirstRun: true,
      theme: 'system',
      autoStart: false,
      serverPort: 4021,
      enableNotifications: true,
      enableSystemTray: true
    };
    
    const configResult = await helpers.config.setConfig('user-preferences', initialConfig);
    expect(configResult.success).toBe(true);
    
    // Step 3: Server startup and validation
    const serverStartResult = await helpers.command.executeCommand('start_server', {
      port: initialConfig.serverPort,
      enableAuth: true
    });
    
    expect(serverStartResult.success).toBe(true);
    
    // Step 4: Verify server connectivity
    const connectivityResult = await helpers.network.testBackendConnectivity({
      timeout: 10000,
      retries: 3
    });
    
    expect(connectivityResult.connected).toBe(true);
    
    // Step 5: Create first tunnel
    const tunnelResult = await helpers.network.createTestTunnel({
      type: 'http',
      localPort: initialConfig.serverPort,
      subdomain: `test-${Date.now()}`,
      timeout: 15000
    });
    
    if (tunnelResult.success) {
      console.log('🚇 First tunnel created:', tunnelResult.data.url);
      
      // Step 6: Test tunnel functionality
      const tunnelTestResult = await helpers.network.testTunnel(tunnelResult.data.url);
      expect(tunnelTestResult.success).toBe(true);
      
      // Step 7: Clean up tunnel
      await helpers.network.closeTunnel(tunnelResult.data.id);
    }
    
    // Step 8: Update configuration to mark onboarding complete
    const updatedConfig = { ...initialConfig, isFirstRun: false };
    const updateResult = await helpers.config.setConfig('user-preferences', updatedConfig);
    expect(updateResult.success).toBe(true);
    
    console.log('✅ Complete onboarding workflow successful');
  });

  test('should handle server management lifecycle', async () => {
    console.log('🧪 Testing server management lifecycle...');
    
    // Start server
    const startResult = await helpers.command.executeCommand('start_server', {
      port: 4021,
      enableAuth: true,
      logLevel: 'info'
    });
    
    expect(startResult.success).toBe(true);
    
    // Wait for server to be ready
    await helpers.network.waitForBackendReady(15000);
    
    // Check server status
    const statusResult = await helpers.command.executeCommand('get_server_status');
    expect(statusResult.success).toBe(true);
    expect(statusResult.data.running).toBe(true);
    
    // Test server endpoints
    const endpointsResult = await helpers.network.testServerEndpoints([
      '/health',
      '/api/status',
      '/api/version'
    ]);
    
    expect(endpointsResult.healthy).toBe(true);
    expect(endpointsResult.results['/health'].success).toBe(true);
    
    // Test WebSocket connection
    const wsResult = await helpers.network.testWebSocketConnection();
    expect(wsResult.connected).toBe(true);
    
    // Restart server
    const restartResult = await helpers.command.executeCommand('restart_server');
    expect(restartResult.success).toBe(true);
    
    // Wait for server to be ready again
    await helpers.network.waitForBackendReady(15000);
    
    // Verify server is still functional
    const postRestartStatus = await helpers.command.executeCommand('get_server_status');
    expect(postRestartStatus.success).toBe(true);
    expect(postRestartStatus.data.running).toBe(true);
    
    // Stop server
    const stopResult = await helpers.command.executeCommand('stop_server');
    expect(stopResult.success).toBe(true);
    
    console.log('✅ Server management lifecycle completed successfully');
  });

  test('should handle multiple concurrent tunnels', async () => {
    console.log('🧪 Testing multiple concurrent tunnels...');
    
    // Ensure server is running
    await helpers.command.executeCommand('start_server', { port: 4021 });
    await helpers.network.waitForBackendReady(10000);
    
    // Create multiple tunnels
    const tunnelConfigs = [
      { type: 'http', localPort: 4021, subdomain: 'tunnel-1' },
      { type: 'http', localPort: 4021, subdomain: 'tunnel-2' },
      { type: 'http', localPort: 4021, subdomain: 'tunnel-3' }
    ];
    
    const tunnelResults = [];
    
    for (const config of tunnelConfigs) {
      const result = await helpers.network.createTestTunnel({
        ...config,
        timeout: 10000
      });
      
      if (result.success) {
        tunnelResults.push(result.data);
        console.log(`🚇 Created tunnel: ${result.data.url}`);
      }
    }
    
    expect(tunnelResults.length).toBeGreaterThan(0);
    
    // Test all tunnels concurrently
    const tunnelTests = tunnelResults.map(tunnel => 
      helpers.network.testTunnel(tunnel.url)
    );
    
    const testResults = await Promise.all(tunnelTests);
    const successfulTests = testResults.filter(r => r.success).length;
    
    expect(successfulTests).toBe(tunnelResults.length);
    
    // Get tunnel status for all
    const statusChecks = tunnelResults.map(tunnel => 
      helpers.network.getTunnelStatus(tunnel.id)
    );
    
    const statusResults = await Promise.all(statusChecks);
    const activeTunnels = statusResults.filter(r => r.success && r.data.active).length;
    
    expect(activeTunnels).toBe(tunnelResults.length);
    
    // Clean up all tunnels
    const cleanupTasks = tunnelResults.map(tunnel => 
      helpers.network.closeTunnel(tunnel.id)
    );
    
    const cleanupResults = await Promise.all(cleanupTasks);
    const successfulCleanup = cleanupResults.filter(r => r.success).length;
    
    expect(successfulCleanup).toBe(tunnelResults.length);
    
    console.log(`✅ Successfully managed ${tunnelResults.length} concurrent tunnels`);
  });

  test('should handle configuration persistence and migration', async () => {
    console.log('🧪 Testing configuration persistence and migration...');
    
    // Create test configuration with various data types
    const testConfig = {
      userPreferences: {
        theme: 'dark',
        language: 'en',
        autoStart: true,
        notifications: {
          enabled: true,
          sound: false,
          desktop: true
        }
      },
      serverSettings: {
        port: 4021,
        host: 'localhost',
        ssl: false,
        maxConnections: 100
      },
      tunnelHistory: [
        { id: '1', name: 'Test Tunnel 1', created: new Date().toISOString() },
        { id: '2', name: 'Test Tunnel 2', created: new Date().toISOString() }
      ],
      performanceMetrics: {
        startupTime: 1500,
        memoryUsage: 50000000,
        lastUpdated: new Date().toISOString()
      }
    };
    
    // Save configuration
    const saveResult = await helpers.config.setConfig('full-config', testConfig);
    expect(saveResult.success).toBe(true);
    
    // Retrieve and validate configuration
    const retrieveResult = await helpers.config.getConfig('full-config');
    expect(retrieveResult.success).toBe(true);
    expect(retrieveResult.data).toEqual(testConfig);
    
    // Test configuration validation
    const validationResult = await helpers.config.validateConfig(testConfig);
    expect(validationResult.valid).toBe(true);
    
    // Test configuration backup
    const backupResult = await helpers.config.backupConfig('full-config');
    expect(backupResult.success).toBe(true);
    
    // Test configuration restoration
    const restoreResult = await helpers.config.restoreConfig('full-config', backupResult.data.backupId);
    expect(restoreResult.success).toBe(true);
    
    // Test configuration migration (simulate version upgrade)
    const migrationConfig = {
      oldVersion: '1.0.0',
      newVersion: '2.0.0',
      migrations: [
        {
          version: '1.1.0',
          migrate: (config: any) => ({ ...config, newFeature: true })
        },
        {
          version: '2.0.0',
          migrate: (config: any) => ({ ...config, anotherFeature: 'enabled' })
        }
      ]
    };
    
    const migrationResult = await helpers.config.migrateConfig('full-config', migrationConfig);
    expect(migrationResult.success).toBe(true);
    
    // Verify migrated configuration
    const migratedConfig = await helpers.config.getConfig('full-config');
    expect(migratedConfig.success).toBe(true);
    expect(migratedConfig.data.newFeature).toBe(true);
    expect(migratedConfig.data.anotherFeature).toBe('enabled');
    
    // Clean up
    await helpers.config.deleteConfig('full-config');
    
    console.log('✅ Configuration persistence and migration completed successfully');
  });

  test('should handle cross-platform file operations', async () => {
    console.log('🧪 Testing cross-platform file operations...');
    
    // Get platform-specific paths
    const paths = await helpers.system.getPlatformPaths();
    console.log('📁 Platform paths:', paths);
    
    // Create test directory structure
    const testDir = `tunnelforge-test-${Date.now()}`;
    const subDir = `${testDir}/subdir`;
    
    const createDirResult = await helpers.system.createDirectory(subDir, { recursive: true });
    expect(createDirResult.success).toBe(true);
    
    // Create test files with different content types
    const textFile = `${testDir}/test.txt`;
    const jsonFile = `${testDir}/config.json`;
    const binaryFile = `${testDir}/binary.dat`;
    
    // Text file
    const textContent = `TunnelForge test file\nCreated: ${new Date().toISOString()}\nPlatform: ${config.platform.platform}`;
    await helpers.system.writeTextFile(textFile, textContent);
    
    // JSON file
    const jsonContent = {
      name: 'TunnelForge Test Config',
      version: '2.0.0',
      settings: {
        theme: 'dark',
        autoStart: true
      },
      metadata: {
        created: new Date().toISOString(),
        platform: config.platform.platform
      }
    };
    await helpers.system.writeJsonFile(jsonFile, jsonContent);
    
    // Binary file (simulate)
    const binaryContent = new ArrayBuffer(1024);
    await helpers.system.writeBinaryFile(binaryFile, binaryContent);
    
    // Verify files exist
    expect(await helpers.system.fileExists(textFile)).toBe(true);
    expect(await helpers.system.fileExists(jsonFile)).toBe(true);
    expect(await helpers.system.fileExists(binaryFile)).toBe(true);
    
    // Read and validate content
    const readText = await helpers.system.readTextFile(textFile);
    expect(readText.success).toBe(true);
    expect(readText.data).toBe(textContent);
    
    const readJson = await helpers.system.readJsonFile(jsonFile);
    expect(readJson.success).toBe(true);
    expect(readJson.data).toEqual(jsonContent);
    
    // Test directory listing
    const dirList = await helpers.system.listDirectory(testDir);
    expect(dirList.success).toBe(true);
    expect(dirList.data.length).toBe(3);
    
    // Test file permissions
    const permissions = await helpers.system.getFilePermissions(textFile);
    expect(permissions.success).toBe(true);
    
    // Test file metadata
    const metadata = await helpers.system.getFileMetadata(textFile);
    expect(metadata.success).toBe(true);
    expect(metadata.data.size).toBeGreaterThan(0);
    
    // Clean up
    const cleanupResult = await helpers.system.deleteDirectory(testDir, { recursive: true });
    expect(cleanupResult.success).toBe(true);
    
    console.log('✅ Cross-platform file operations completed successfully');
  });

  test('should handle system integration and notifications', async () => {
    console.log('🧪 Testing system integration and notifications...');
    
    // Test system info
    const systemInfo = await helpers.system.getSystemInfo();
    console.log('💻 System Info:', systemInfo);
    
    expect(systemInfo.platform).toBeDefined();
    expect(systemInfo.arch).toBeDefined();
    expect(systemInfo.version).toBeDefined();
    
    // Test system tray
    const trayStatus = await helpers.system.getSystemTrayStatus();
    console.log('🔌 System Tray Status:', trayStatus);
    
    // Test various notification types
    const notifications = [
      {
        title: 'TunnelForge Started',
        body: 'TunnelForge server has started successfully',
        icon: 'success'
      },
      {
        title: 'Tunnel Created',
        body: 'New tunnel has been created and is active',
        icon: 'info'
      },
      {
        title: 'Warning',
        body: 'This is a warning notification',
        icon: 'warning'
      },
      {
        title: 'Error',
        body: 'This is an error notification',
        icon: 'error'
      }
    ];
    
    for (const notification of notifications) {
      const result = await helpers.system.sendNotification(notification);
      expect(result.success).toBe(true);
      
      // Small delay between notifications
      await helpers.utils.sleep(500);
    }
    
    // Test platform-specific integrations
    if (config.platform.isWindows) {
      console.log('🪟 Testing Windows integration...');
      
      // Test Windows features
      const windowsFeatures = await helpers.system.getWindowsFeatures();
      console.log('Windows Features:', windowsFeatures);
      
      // Test Windows registry operations (if available)
      try {
        const registryResult = await helpers.system.testWindowsRegistry();
        console.log('Windows Registry Test:', registryResult);
      } catch (error) {
        console.log('Windows Registry not available:', error.message);
      }
    } else if (config.platform.isMacOS) {
      console.log('🍎 Testing macOS integration...');
      
      // Test macOS features
      const macFeatures = await helpers.system.getMacFeatures();
      console.log('macOS Features:', macFeatures);
      
      // Test macOS notifications
      const macNotification = await helpers.system.sendMacNotification({
        title: 'TunnelForge macOS Test',
        subtitle: 'Platform-specific notification',
        body: 'This is a macOS-specific notification',
        sound: 'default'
      });
      
      expect(macNotification.success).toBe(true);
    } else if (config.platform.isLinux) {
      console.log('🐧 Testing Linux integration...');
      
      // Test Linux features
      const linuxFeatures = await helpers.system.getLinuxFeatures();
      console.log('Linux Features:', linuxFeatures);
      
      // Test desktop environment detection
      const desktopEnv = await helpers.system.getLinuxDesktopEnvironment();
      console.log('Desktop Environment:', desktopEnv);
    }
    
    console.log('✅ System integration and notifications completed successfully');
  });

  test('should handle error recovery and resilience', async () => {
    console.log('🧪 Testing error recovery and resilience...');
    
    // Test network failure recovery
    console.log('🌐 Testing network failure recovery...');
    
    // Simulate network failure by testing invalid endpoint
    const networkFailure = await helpers.network.testEndpoint('http://localhost:99999', {
      timeout: 5000,
      retries: 2
    });
    
    expect(networkFailure.success).toBe(false);
    
    // Test recovery by checking valid endpoint
    const recoveryTest = await helpers.network.testBackendConnectivity({
      timeout: 10000,
      retries: 3
    });
    
    if (recoveryTest.connected) {
      console.log('✅ Network recovery successful');
    }
    
    // Test command failure recovery
    console.log('🔧 Testing command failure recovery...');
    
    // Execute invalid command
    const commandFailure = await helpers.command.executeCommand('invalid_command', {}, {
      retries: 1,
      timeout: 5000
    });
    
    expect(commandFailure.success).toBe(false);
    
    // Test recovery with valid command
    const commandRecovery = await helpers.command.executeCommand('get_app_version', {}, {
      retries: 2,
      timeout: 10000
    });
    
    expect(commandRecovery.success).toBe(true);
    
    // Test file system error recovery
    console.log('📁 Testing file system error recovery...');
    
    // Try to read non-existent file
    const fileFailure = await helpers.system.readTextFile('non-existent-file.txt');
    expect(fileFailure.success).toBe(false);
    
    // Test recovery by creating and reading file
    const testFile = `recovery-test-${Date.now()}.txt`;
    const testContent = 'Recovery test content';
    
    await helpers.system.writeTextFile(testFile, testContent);
    const fileRecovery = await helpers.system.readTextFile(testFile);
    
    expect(fileRecovery.success).toBe(true);
    expect(fileRecovery.data).toBe(testContent);
    
    // Clean up
    await helpers.system.deleteFile(testFile);
    
    // Test configuration error recovery
    console.log('⚙️ Testing configuration error recovery...');
    
    // Try to get non-existent config
    const configFailure = await helpers.config.getConfig('non-existent-config');
    expect(configFailure.success).toBe(false);
    
    // Test recovery by creating and retrieving config
    const testConfig = { recoveryTest: true, timestamp: Date.now() };
    await helpers.config.setConfig('recovery-test', testConfig);
    
    const configRecovery = await helpers.config.getConfig('recovery-test');
    expect(configRecovery.success).toBe(true);
    expect(configRecovery.data).toEqual(testConfig);
    
    // Clean up
    await helpers.config.deleteConfig('recovery-test');
    
    // Test comprehensive system recovery
    console.log('🔄 Testing comprehensive system recovery...');
    
    const recoveryReport = await helpers.tauriApp.performSystemRecovery();
    console.log('📋 System Recovery Report:', recoveryReport);
    
    expect(recoveryReport.recovered).toBe(true);
    expect(recoveryReport.components).toBeDefined();
    
    console.log('✅ Error recovery and resilience testing completed successfully');
  });

  test('should maintain performance under load', async () => {
    console.log('🧪 Testing performance under load...');
    
    // Baseline performance metrics
    const baselineMetrics = await helpers.tauriApp.getPerformanceMetrics();
    console.log('📊 Baseline Performance:', baselineMetrics);
    
    // Load test: Execute many commands rapidly
    console.log('⚡ Testing command execution performance...');
    
    const commandCount = 100;
    const startTime = Date.now();
    
    const commandPromises = Array.from({ length: commandCount }, () =>
      helpers.command.executeCommand('get_app_version', {}, { timeout: 5000 })
    );
    
    const commandResults = await Promise.all(commandPromises);
    const commandDuration = Date.now() - startTime;
    
    const successfulCommands = commandResults.filter(r => r.success).length;
    const averageCommandTime = commandDuration / commandCount;
    
    console.log(`📈 Command Performance: ${successfulCommands}/${commandCount} successful, avg ${averageCommandTime.toFixed(2)}ms`);
    
    expect(successfulCommands).toBe(commandCount);
    expect(averageCommandTime).toBeLessThan(100); // Average should be under 100ms
    
    // Load test: File operations
    console.log('📁 Testing file operation performance...');
    
    const fileCount = 50;
    const fileStartTime = Date.now();
    
    const filePromises = Array.from({ length: fileCount }, (_, i) => {
      const fileName = `perf-test-${i}.txt`;
      const content = `Performance test file ${i}`;
      
      return helpers.system.writeTextFile(fileName, content)
        .then(() => helpers.system.readTextFile(fileName))
        .then(() => helpers.system.deleteFile(fileName));
    });
    
    const fileResults = await Promise.all(filePromises);
    const fileDuration = Date.now() - fileStartTime;
    const averageFileTime = fileDuration / fileCount;
    
    const successfulFiles = fileResults.filter(r => r.success).length;
    console.log(`📈 File Performance: ${successfulFiles}/${fileCount} successful, avg ${averageFileTime.toFixed(2)}ms`);
    
    expect(successfulFiles).toBe(fileCount);
    expect(averageFileTime).toBeLessThan(200); // Average should be under 200ms
    
    // Load test: Network operations
    console.log('🌐 Testing network operation performance...');
    
    const networkCount = 20;
    const networkStartTime = Date.now();
    
    const networkPromises = Array.from({ length: networkCount }, () =>
      helpers.network.testBackendConnectivity({ timeout: 5000 })
    );
    
    const networkResults = await Promise.all(networkPromises);
    const networkDuration = Date.now() - networkStartTime;
    const averageNetworkTime = networkDuration / networkCount;
    
    const successfulNetwork = networkResults.filter(r => r.connected).length;
    console.log(`📈 Network Performance: ${successfulNetwork}/${networkCount} successful, avg ${averageNetworkTime.toFixed(2)}ms`);
    
    // Final performance metrics
    const finalMetrics = await helpers.tauriApp.getPerformanceMetrics();
    console.log('📊 Final Performance:', finalMetrics);
    
    // Performance degradation should be minimal
    const memoryGrowth = finalMetrics.memoryUsage - baselineMetrics.memoryUsage;
    const memoryGrowthPercentage = (memoryGrowth / baselineMetrics.memoryUsage) * 100;
    
    console.log(`📈 Memory growth: ${memoryGrowthPercentage.toFixed(2)}%`);
    expect(memoryGrowthPercentage).toBeLessThan(100); // Allow up to 2x memory growth
    
    console.log('✅ Performance under load testing completed successfully');
  });
});