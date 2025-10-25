import { test, expect, Page, BrowserContext } from '@playwright/test';
import { createWebViewHelper, WebViewHelper } from '../helpers/webview-helpers';

test.describe('Performance and Stability Tests', () => {
  let webViewHelper: WebViewHelper;
  let page: Page;
  let context: BrowserContext;

  test.beforeAll(async ({ browser }, testInfo) => {
    console.log('🚀 Setting up Performance and Stability tests...');
    
    context = await browser.newContext({
      viewport: { width: 1200, height: 800 }
    });
    
    page = await context.newPage();
    await page.goto('http://localhost:4021', { waitUntil: 'networkidle' });
    
    webViewHelper = createWebViewHelper(page, context, testInfo, {
      captureScreenshots: true,
      timeout: 30000
    });
    
    await webViewHelper.initialize();
  });

  test.afterAll(async () => {
    if (webViewHelper) {
      await webViewHelper.cleanup();
    }
    if (context) {
      await context.close();
    }
  });

  test.describe('Command Execution Performance', () => {
    test('should execute commands within acceptable time limits', async () => {
      console.log('⏱️ Testing command execution performance...');

      const commands = [
        'get_app_info',
        'get_settings',
        'get_server_status',
        'get_platform_info',
        'get_terminal_sessions'
      ];

      const results: Array<{ command: string; time: number; success: boolean }> = [];

      for (const command of commands) {
        const startTime = Date.now();
        const result = await webViewHelper.executeCommand(command);
        const executionTime = Date.now() - startTime;

        results.push({
          command,
          time: executionTime,
          success: result.success
        });

        expect(result.success).toBe(true);
        expect(executionTime).toBeLessThan(5000); // 5 second max per command
      }

      // Calculate statistics
      const totalTime = results.reduce((sum, r) => sum + r.time, 0);
      const avgTime = totalTime / results.length;
      const maxTime = Math.max(...results.map(r => r.time));
      const minTime = Math.min(...results.map(r => r.time));

      console.log(`✅ Command performance stats:`);
      console.log(`   Total: ${totalTime}ms`);
      console.log(`   Average: ${avgTime.toFixed(2)}ms`);
      console.log(`   Min: ${minTime}ms`);
      console.log(`   Max: ${maxTime}ms`);

      // Performance should be reasonable
      expect(avgTime).toBeLessThan(2000); // 2 second average
      expect(maxTime).toBeLessThan(5000); // 5 second max

      // Log detailed results
      results.forEach(result => {
        console.log(`   ${result.command}: ${result.time}ms`);
      });
    });

    test('should handle concurrent command execution efficiently', async () => {
      console.log('🔄 Testing concurrent command execution...');

      const commandCount = 20;
      const startTime = Date.now();

      // Execute commands concurrently
      const promises = Array.from({ length: commandCount }, () =>
        webViewHelper.executeCommand('get_app_info')
      );

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / commandCount;

      // All commands should succeed
      for (const result of results) {
        expect(result.success).toBe(true);
      }

      // Results should be consistent
      const firstResult = results[0].data;
      for (const result of results) {
        expect(result.data).toEqual(firstResult);
      }

      console.log(`✅ Concurrent execution: ${commandCount} commands in ${totalTime}ms (avg: ${avgTime.toFixed(2)}ms per command)`);
      
      // Concurrent execution should be faster than sequential
      expect(avgTime).toBeLessThan(1000); // 1 second average for concurrent
    });

    test('should maintain performance under load', async () => {
      console.log('📊 Testing performance under load...');

      const loadTestDuration = 10000; // 10 seconds
      const commandInterval = 100; // Every 100ms
      const startTime = Date.now();
      const executionTimes: number[] = [];
      let commandCount = 0;

      while (Date.now() - startTime < loadTestDuration) {
        const commandStart = Date.now();
        const result = await webViewHelper.executeCommand('get_server_status');
        const commandTime = Date.now() - commandStart;

        expect(result.success).toBe(true);
        executionTimes.push(commandTime);
        commandCount++;

        await page.waitForTimeout(commandInterval);
      }

      // Calculate performance statistics
      const totalTime = Date.now() - startTime;
      const avgTime = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;
      const maxTime = Math.max(...executionTimes);
      const minTime = Math.min(...executionTimes);
      const p95 = executionTimes.sort((a, b) => a - b)[Math.floor(executionTimes.length * 0.95)];

      console.log(`✅ Load test results:`);
      console.log(`   Duration: ${totalTime}ms`);
      console.log(`   Commands: ${commandCount}`);
      console.log(`   Average: ${avgTime.toFixed(2)}ms`);
      console.log(`   Min: ${minTime}ms`);
      console.log(`   Max: ${maxTime}ms`);
      console.log(`   95th percentile: ${p95}ms`);

      // Performance should remain stable under load
      expect(avgTime).toBeLessThan(2000); // 2 second average under load
      expect(p95).toBeLessThan(5000); // 95th percentile under 5 seconds
    });
  });

  test.describe('Memory Usage and Management', () => {
    test('should maintain reasonable memory usage', async () => {
      console.log('🧠 Testing memory usage...');

      const initialMemory = await webViewHelper.executeCommand('get_memory_usage');
      expect(initialMemory.success).toBe(true);

      console.log(`Initial memory: ${initialMemory.data.usedMB}MB`);

      // Perform memory-intensive operations
      const operations = [
        () => webViewHelper.executeCommand('get_terminal_sessions'),
        () => webViewHelper.executeCommand('get_server_logs', [{ limit: 1000 }]),
        () => webViewHelper.executeCommand('get_performance_metrics'),
        () => webViewHelper.executeCommand('get_platform_info')
      ];

      // Execute operations multiple times
      for (let i = 0; i < 10; i++) {
        for (const operation of operations) {
          await operation();
        }
      }

      // Check memory after operations
      const finalMemory = await webViewHelper.executeCommand('get_memory_usage');
      expect(finalMemory.success).toBe(true);

      const memoryIncrease = finalMemory.data.usedMB - initialMemory.data.usedMB;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.data.usedMB) * 100;

      console.log(`Final memory: ${finalMemory.data.usedMB}MB`);
      console.log(`Memory increase: ${memoryIncrease}MB (${memoryIncreasePercent.toFixed(2)}%)`);

      // Memory increase should be reasonable (< 50MB or 20%)
      expect(memoryIncrease).toBeLessThan(50);
      expect(memoryIncreasePercent).toBeLessThan(20);
    });

    test('should handle memory cleanup properly', async () => {
      console.log('🧹 Testing memory cleanup...');

      // Get baseline memory
      const baselineMemory = await webViewHelper.executeCommand('get_memory_usage');
      expect(baselineMemory.success).toBe(true);

      // Create and cleanup multiple terminal sessions
      const sessionIds: string[] = [];

      for (let i = 0; i < 5; i++) {
        const createResult = await webViewHelper.executeCommand('create_terminal_session', [{
          title: `Memory Test Session ${i}`
        }]);
        expect(createResult.success).toBe(true);
        sessionIds.push(createResult.data.sessionId);
      }

      // Check memory with sessions
      const memoryWithSessions = await webViewHelper.executeCommand('get_memory_usage');
      expect(memoryWithSessions.success).toBe(true);

      // Cleanup all sessions
      for (const sessionId of sessionIds) {
        const cleanupResult = await webViewHelper.executeCommand('cleanup_terminal_session', [sessionId]);
        expect(cleanupResult.success).toBe(true);
      }

      // Wait for garbage collection
      await page.waitForTimeout(2000);

      // Check memory after cleanup
      const memoryAfterCleanup = await webViewHelper.executeCommand('get_memory_usage');
      expect(memoryAfterCleanup.success).toBe(true);

      const memoryAfterCleanupIncrease = memoryAfterCleanup.data.usedMB - baselineMemory.data.usedMB;

      console.log(`Memory after cleanup increase: ${memoryAfterCleanupIncrease}MB`);

      // Memory should be close to baseline after cleanup
      expect(memoryAfterCleanupIncrease).toBeLessThan(10); // Within 10MB of baseline
    });

    test('should detect memory leaks', async () => {
      console.log('🔍 Testing for memory leaks...');

      const measurements: number[] = [];
      const iterations = 5;

      for (let i = 0; i < iterations; i++) {
        // Perform memory-intensive operations
        await webViewHelper.executeCommand('create_terminal_session', [{
          title: `Leak Test Session ${i}`
        }]);

        await webViewHelper.executeCommand('get_server_logs', [{ limit: 500 }]);

        // Measure memory
        const memoryResult = await webViewHelper.executeCommand('get_memory_usage');
        expect(memoryResult.success).toBe(true);
        measurements.push(memoryResult.data.usedMB);

        // Cleanup
        const sessionsResult = await webViewHelper.executeCommand('get_terminal_sessions');
        if (sessionsResult.data.length > 0) {
          for (const session of sessionsResult.data) {
            await webViewHelper.executeCommand('cleanup_terminal_session', [session.id]);
          }
        }

        await page.waitForTimeout(1000);
      }

      // Analyze memory growth
      const initialMemory = measurements[0];
      const finalMemory = measurements[measurements.length - 1];
      const memoryGrowth = finalMemory - initialMemory;
      const avgGrowthPerIteration = memoryGrowth / (iterations - 1);

      console.log(`Memory growth analysis:`);
      console.log(`   Initial: ${initialMemory}MB`);
      console.log(`   Final: ${finalMemory}MB`);
      console.log(`   Total growth: ${memoryGrowth}MB`);
      console.log(`   Avg growth per iteration: ${avgGrowthPerIteration.toFixed(2)}MB`);

      // Memory growth should be minimal (< 5MB per iteration)
      expect(avgGrowthPerIteration).toBeLessThan(5);
    });
  });

  test.describe('Stability Under Stress', () => {
    test('should handle rapid command execution without crashing', async () => {
      console.log('⚡ Testing rapid command execution...');

      const rapidCommands = [
        'get_app_info',
        'get_settings',
        'get_server_status',
        'get_platform_info'
      ];

      const errors: Array<{ command: string; error: string; time: number }> = [];
      const successes: Array<{ command: string; time: number }> = [];

      // Execute commands rapidly for 30 seconds
      const startTime = Date.now();
      const testDuration = 30000;

      while (Date.now() - startTime < testDuration) {
        const command = rapidCommands[Math.floor(Math.random() * rapidCommands.length)];
        const commandStart = Date.now();

        try {
          const result = await webViewHelper.executeCommand(command);
          const commandTime = Date.now() - commandStart;

          if (result.success) {
            successes.push({ command, time: commandTime });
          } else {
            errors.push({ command, error: result.error || 'Unknown error', time: commandTime });
          }
        } catch (error) {
          errors.push({ 
            command, 
            error: error instanceof Error ? error.message : String(error), 
            time: Date.now() - commandStart 
          });
        }

        // Small delay to prevent overwhelming
        await page.waitForTimeout(10);
      }

      const totalTime = Date.now() - startTime;
      const totalCommands = successes.length + errors.length;
      const errorRate = (errors.length / totalCommands) * 100;
      const avgSuccessTime = successes.length > 0 ? 
        successes.reduce((sum, s) => sum + s.time, 0) / successes.length : 0;

      console.log(`✅ Rapid execution results:`);
      console.log(`   Duration: ${totalTime}ms`);
      console.log(`   Total commands: ${totalCommands}`);
      console.log(`   Successes: ${successes.length}`);
      console.log(`   Errors: ${errors.length}`);
      console.log(`   Error rate: ${errorRate.toFixed(2)}%`);
      console.log(`   Avg success time: ${avgSuccessTime.toFixed(2)}ms`);

      // Error rate should be very low (< 5%)
      expect(errorRate).toBeLessThan(5);
      expect(totalCommands).toBeGreaterThan(100); // Should execute many commands
    });

    test('should recover from errors gracefully', async () => {
      console.log('🔄 Testing error recovery...');

      // Test various error conditions
      const errorTests = [
        {
          name: 'Invalid command',
          test: () => webViewHelper.executeCommand('nonexistent_command')
        },
        {
          name: 'Invalid arguments',
          test: () => webViewHelper.executeCommand('set_settings', [{ invalid: 'data' }])
        },
        {
          name: 'Invalid session ID',
          test: () => webViewHelper.executeCommand('get_terminal_session_details', ['invalid-session'])
        }
      ];

      for (const errorTest of errorTests) {
        console.log(`Testing ${errorTest.name}...`);

        // Execute error-inducing command
        const errorResult = await errorTest.test();
        expect(errorResult.success).toBe(false);

        // Verify app is still responsive
        const recoveryResult = await webViewHelper.executeCommand('get_app_info');
        expect(recoveryResult.success).toBe(true);

        // Verify normal operations still work
        const normalResult = await webViewHelper.executeCommand('get_settings');
        expect(normalResult.success).toBe(true);

        console.log(`✅ Recovered from ${errorTest.name}`);
      }
    });

    test('should handle resource exhaustion gracefully', async () => {
      console.log('💾 Testing resource exhaustion handling...');

      // Try to exhaust terminal sessions
      const sessionIds: string[] = [];
      let sessionCreationFailed = false;

      try {
        // Create as many sessions as possible
        for (let i = 0; i < 100; i++) {
          const result = await webViewHelper.executeCommand('create_terminal_session', [{
            title: `Exhaustion Test ${i}`
          }]);

          if (result.success) {
            sessionIds.push(result.data.sessionId);
          } else {
            sessionCreationFailed = true;
            console.log(`Session creation failed at ${i}: ${result.error}`);
            break;
          }
        }
      } catch (error) {
        sessionCreationFailed = true;
        console.log(`Session creation threw error: ${error}`);
      }

      // Verify app is still responsive
      const responsiveResult = await webViewHelper.executeCommand('get_app_info');
      expect(responsiveResult.success).toBe(true);

      // Cleanup sessions
      for (const sessionId of sessionIds) {
        try {
          await webViewHelper.executeCommand('cleanup_terminal_session', [sessionId]);
        } catch (error) {
          console.warn(`Failed to cleanup session ${sessionId}: ${error}`);
        }
      }

      console.log(`✅ Created ${sessionIds.length} sessions before exhaustion`);
      console.log(`✅ App remained responsive after resource pressure`);

      // Should have created at least some sessions
      expect(sessionIds.length).toBeGreaterThan(0);
    });
  });

  test.describe('Long-Running Stability', () => {
    test('should maintain stability over extended periods', async () => {
      console.log('⏰ Testing long-running stability...');

      const testDuration = 60000; // 1 minute
      const checkInterval = 5000; // Every 5 seconds
      const startTime = Date.now();
      const healthChecks: Array<{ timestamp: number; healthy: boolean; responseTime: number }> = [];

      while (Date.now() - startTime < testDuration) {
        const checkStart = Date.now();
        
        try {
          const result = await webViewHelper.executeCommand('get_server_health');
          const responseTime = Date.now() - checkStart;
          
          healthChecks.push({
            timestamp: Date.now(),
            healthy: result.success && result.data.status === 'healthy',
            responseTime
          });

          if (!result.success) {
            console.warn(`Health check failed: ${result.error}`);
          }

        } catch (error) {
          healthChecks.push({
            timestamp: Date.now(),
            healthy: false,
            responseTime: Date.now() - checkStart
          });
          console.warn(`Health check threw error: ${error}`);
        }

        await page.waitForTimeout(checkInterval);
      }

      // Analyze health checks
      const healthyChecks = healthChecks.filter(check => check.healthy);
      const unhealthyChecks = healthChecks.filter(check => !check.healthy);
      const healthRate = (healthyChecks.length / healthChecks.length) * 100;
      const avgResponseTime = healthChecks.reduce((sum, check) => sum + check.responseTime, 0) / healthChecks.length;

      console.log(`✅ Long-running stability results:`);
      console.log(`   Duration: ${testDuration}ms`);
      console.log(`   Health checks: ${healthChecks.length}`);
      console.log(`   Healthy: ${healthyChecks.length}`);
      console.log(`   Unhealthy: ${unhealthyChecks.length}`);
      console.log(`   Health rate: ${healthRate.toFixed(2)}%`);
      console.log(`   Avg response time: ${avgResponseTime.toFixed(2)}ms`);

      // Health rate should be high (> 95%)
      expect(healthRate).toBeGreaterThan(95);
      expect(avgResponseTime).toBeLessThan(2000); // 2 second average response time
    });

    test('should handle session lifecycle management over time', async () => {
      console.log('🔄 Testing session lifecycle management...');

      const testDuration = 30000; // 30 seconds
      const sessionLifecycles: Array<{ created: number; destroyed: number; duration: number }> = [];
      const startTime = Date.now();

      while (Date.now() - startTime < testDuration) {
        const sessionStart = Date.now();

        // Create session
        const createResult = await webViewHelper.executeCommand('create_terminal_session', [{
          title: `Lifecycle Test ${Date.now()}`
        }]);
        expect(createResult.success).toBe(true);

        const sessionId = createResult.data.sessionId;

        // Use session briefly
        await webViewHelper.executeCommand('send_terminal_input', [{
          sessionId,
          input: 'echo "Lifecycle test"\n'
        }]);

        await page.waitForTimeout(1000);

        // Cleanup session
        const cleanupResult = await webViewHelper.executeCommand('cleanup_terminal_session', [sessionId]);
        expect(cleanupResult.success).toBe(true);

        const sessionEnd = Date.now();
        const sessionDuration = sessionEnd - sessionStart;

        sessionLifecycles.push({
          created: sessionStart,
          destroyed: sessionEnd,
          duration: sessionDuration
        });

        await page.waitForTimeout(2000);
      }

      // Analyze session lifecycles
      const avgDuration = sessionLifecycles.reduce((sum, lifecycle) => sum + lifecycle.duration, 0) / sessionLifecycles.length;
      const maxDuration = Math.max(...sessionLifecycles.map(l => l.duration));
      const minDuration = Math.min(...sessionLifecycles.map(l => l.duration));

      console.log(`✅ Session lifecycle results:`);
      console.log(`   Sessions managed: ${sessionLifecycles.length}`);
      console.log(`   Avg duration: ${avgDuration.toFixed(2)}ms`);
      console.log(`   Min duration: ${minDuration}ms`);
      console.log(`   Max duration: ${maxDuration}ms`);

      // Should have managed multiple sessions
      expect(sessionLifecycles.length).toBeGreaterThan(5);
      expect(avgDuration).toBeLessThan(10000); // 10 second average session duration
    });
  });

  test.describe('Performance Regression Detection', () => {
    test('should detect performance regressions in command execution', async () => {
      console.log('📉 Testing performance regression detection...');

      const baselineCommands = [
        'get_app_info',
        'get_settings',
        'get_server_status'
      ];

      const baselineMeasurements: Array<{ command: string; times: number[] }> = [];

      // Collect baseline measurements
      for (const command of baselineCommands) {
        const times: number[] = [];
        
        for (let i = 0; i < 10; i++) {
          const start = Date.now();
          const result = await webViewHelper.executeCommand(command);
          const time = Date.now() - start;
          
          expect(result.success).toBe(true);
          times.push(time);
        }

        baselineMeasurements.push({ command, times });
      }

      // Simulate load that might cause regression
      console.log('Applying load to test for regressions...');
      
      for (let i = 0; i < 50; i++) {
        await webViewHelper.executeCommand('get_server_logs', [{ limit: 100 }]);
        await page.waitForTimeout(10);
      }

      // Collect post-load measurements
      const postLoadMeasurements: Array<{ command: string; times: number[] }> = [];

      for (const command of baselineCommands) {
        const times: number[] = [];
        
        for (let i = 0; i < 10; i++) {
          const start = Date.now();
          const result = await webViewHelper.executeCommand(command);
          const time = Date.now() - start;
          
          expect(result.success).toBe(true);
          times.push(time);
        }

        postLoadMeasurements.push({ command, times });
      }

      // Compare measurements
      for (let i = 0; i < baselineCommands.length; i++) {
        const baseline = baselineMeasurements[i];
        const postLoad = postLoadMeasurements[i];
        
        const baselineAvg = baseline.times.reduce((sum, time) => sum + time, 0) / baseline.times.length;
        const postLoadAvg = postLoad.times.reduce((sum, time) => sum + time, 0) / postLoad.times.length;
        const regressionPercent = ((postLoadAvg - baselineAvg) / baselineAvg) * 100;

        console.log(`${baseline.command}:`);
        console.log(`   Baseline avg: ${baselineAvg.toFixed(2)}ms`);
        console.log(`   Post-load avg: ${postLoadAvg.toFixed(2)}ms`);
        console.log(`   Regression: ${regressionPercent.toFixed(2)}%`);

        // Performance regression should be minimal (< 50%)
        expect(regressionPercent).toBeLessThan(50);
      }
    });
  });
});