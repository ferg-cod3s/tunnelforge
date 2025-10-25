import { FullConfig } from '@playwright/test';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { getTestContext } from './global-setup.enhanced.js';

const sleep = promisify(setTimeout);

/**
 * Enhanced global teardown for Tauri desktop app testing
 * 
 * This teardown provides comprehensive cleanup:
 * - Process termination (graceful and force)
 * - Virtual display cleanup
 * - Browser and context cleanup
 * - Test artifact collection
 * - Error reporting and diagnostics
 */

interface TeardownReport {
  success: boolean;
  duration: number;
  errors: string[];
  warnings: string[];
  artifacts: string[];
  processes: {
    tauri: boolean;
    displayServer: boolean;
    tunnelForgeServer: boolean;
    browser: boolean;
  };
}

/**
 * Gracefully terminate a process
 */
async function terminateProcess(
  process: any, 
  name: string, 
  timeout: number = 5000
): Promise<{ success: boolean; error?: string }> {
  if (!process || process.killed) {
    return { success: true };
  }

  try {
    console.log(`🛑 Terminating ${name} process...`);
    
    // Try graceful shutdown first
    process.kill('SIGTERM');
    
    // Wait for graceful shutdown
    await sleep(timeout);
    
    // Check if process is still running
    if (!process.killed) {
      console.warn(`⚠️ ${name} did not terminate gracefully, forcing...`);
      process.kill('SIGKILL');
      await sleep(2000);
    }
    
    const success = process.killed;
    if (success) {
      console.log(`✅ ${name} terminated successfully`);
    } else {
      console.error(`❌ Failed to terminate ${name}`);
    }
    
    return { success };
  } catch (error) {
    const errorMsg = `Failed to terminate ${name}: ${error.message}`;
    console.error(`❌ ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

/**
 * Cleanup virtual display
 */
async function cleanupVirtualDisplay(): Promise<{ success: boolean; error?: string }> {
  const context = getTestContext();
  
  if (!context.displayServer) {
    return { success: true };
  }

  try {
    console.log('🖥️ Cleaning up virtual display...');
    
    const result = await terminateProcess(context.displayServer, 'Xvfb', 3000);
    
    // Additional cleanup for X11
    if (context.platformInfo.isWSL || context.platformInfo.isCI) {
      try {
        const { exec } = require('child_process');
        await promisify(exec)('pkill -f Xvfb || true');
        await sleep(1000);
      } catch (error) {
        console.warn('⚠️ Failed to cleanup Xvfb processes:', error.message);
      }
    }
    
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Cleanup browser and context
 */
async function cleanupBrowser(): Promise<{ success: boolean; error?: string }> {
  const context = getTestContext();
  
  if (!context.browser) {
    return { success: true };
  }

  try {
    console.log('🌐 Cleaning up browser...');
    
    // Close context first
    if (context.context) {
      await context.context.close();
    }
    
    // Then close browser
    await context.browser.close();
    
    console.log('✅ Browser cleaned up successfully');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Collect test artifacts
 */
async function collectArtifacts(): Promise<string[]> {
  console.log('📦 Collecting test artifacts...');
  
  const artifacts: string[] = [];
  const artifactDirs = [
    'test-results/tauri-output',
    'test-results/tauri-screenshots',
    'test-results/tauri-videos',
    'test-results/tauri-traces',
    'test-results/tauri-logs',
  ];

  for (const dir of artifactDirs) {
    try {
      const files = await fs.readdir(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = await fs.stat(fullPath);
        
        if (stat.isFile()) {
          artifacts.push(fullPath);
        }
      }
    } catch (error) {
      // Directory might not exist
    }
  }

  // Collect log files
  const logPatterns = [
    '/tmp/tauri-*.log',
    '/tmp/tunnelforge-*.log',
    '/tmp/playwright-*.log',
  ];

  for (const pattern of logPatterns) {
    try {
      const { exec } = require('child_process');
      const { stdout } = await promisify(exec)(`ls ${pattern} 2>/dev/null || true`);
      if (stdout.trim()) {
        artifacts.push(...stdout.trim().split('\n'));
      }
    } catch (error) {
      // No files found
    }
  }

  console.log(`📦 Collected ${artifacts.length} artifacts`);
  return artifacts;
}

/**
 * Generate teardown report
 */
async function generateTeardownReport(
  report: TeardownReport
): Promise<void> {
  console.log('📊 Generating teardown report...');
  
  const reportData = {
    timestamp: new Date().toISOString(),
    duration: report.duration,
    success: report.success,
    errors: report.errors,
    warnings: report.warnings,
    artifacts: report.artifacts,
    processes: report.processes,
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
    },
  };

  try {
    const reportPath = 'test-results/tauri-teardown-report.json';
    await fs.writeFile(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`📊 Teardown report saved to ${reportPath}`);
  } catch (error) {
    console.error('❌ Failed to save teardown report:', error.message);
  }

  // Print summary
  console.log('\n📊 Teardown Summary:');
  console.log(`   Duration: ${report.duration}ms`);
  console.log(`   Success: ${report.success ? '✅' : '❌'}`);
  console.log(`   Errors: ${report.errors.length}`);
  console.log(`   Warnings: ${report.warnings.length}`);
  console.log(`   Artifacts: ${report.artifacts.length}`);
  
  if (report.errors.length > 0) {
    console.log('\n❌ Errors:');
    report.errors.forEach(error => console.log(`   - ${error}`));
  }
  
  if (report.warnings.length > 0) {
    console.log('\n⚠️ Warnings:');
    report.warnings.forEach(warning => console.log(`   - ${warning}`));
  }
}

/**
 * Check for orphaned processes
 */
async function checkOrphanedProcesses(): Promise<string[]> {
  console.log('🔍 Checking for orphaned processes...');
  
  const orphaned: string[] = [];
  
  try {
    const { exec } = require('child_process');
    
    // Check for Tauri processes
    const { stdout: tauriProcs } = await promisify(exec)(
      'ps aux | grep -i tauri | grep -v grep || true'
    );
    
    if (tauriProcs.trim()) {
      orphaned.push(...tauriProcs.trim().split('\n'));
    }
    
    // Check for TunnelForge processes
    const { stdout: tunnelProcs } = await promisify(exec)(
      'ps aux | grep -i tunnelforge | grep -v grep || true'
    );
    
    if (tunnelProcs.trim()) {
      orphaned.push(...tunnelProcs.trim().split('\n'));
    }
    
    // Check for Xvfb processes
    const { stdout: xvfbProcs } = await promisify(exec)(
      'ps aux | grep Xvfb | grep -v grep || true'
    );
    
    if (xvfbProcs.trim()) {
      orphaned.push(...xvfbProcs.trim().split('\n'));
    }
    
  } catch (error) {
    console.warn('⚠️ Failed to check for orphaned processes:', error.message);
  }
  
  if (orphaned.length > 0) {
    console.log(`🔍 Found ${orphaned.length} potentially orphaned processes`);
  }
  
  return orphaned;
}

/**
 * Main global teardown function
 */
export default async function globalTeardown(config: FullConfig): Promise<void> {
  console.log('🧹 Starting enhanced Tauri desktop app test teardown...');
  
  const teardownStartTime = Date.now();
  const report: TeardownReport = {
    success: true,
    duration: 0,
    errors: [],
    warnings: [],
    artifacts: [],
    processes: {
      tauri: false,
      displayServer: false,
      tunnelForgeServer: false,
      browser: false,
    },
  };

  try {
    const context = getTestContext();
    
    // Terminate Tauri process
    if (context.tauriProcess) {
      const result = await terminateProcess(context.tauriProcess, 'Tauri');
      report.processes.tauri = result.success;
      if (!result.success) {
        report.errors.push(result.error!);
      }
    }
    
    // Cleanup virtual display
    const displayResult = await cleanupVirtualDisplay();
    report.processes.displayServer = displayResult.success;
    if (!displayResult.success) {
      report.errors.push(displayResult.error!);
    }
    
    // Terminate TunnelForge server
    if (context.tunnelForgeServer) {
      const result = await terminateProcess(context.tunnelForgeServer, 'TunnelForge Server');
      report.processes.tunnelForgeServer = result.success;
      if (!result.success) {
        report.errors.push(result.error!);
      }
    }
    
    // Cleanup browser
    const browserResult = await cleanupBrowser();
    report.processes.browser = browserResult.success;
    if (!browserResult.success) {
      report.errors.push(browserResult.error!);
    }
    
    // Collect artifacts
    report.artifacts = await collectArtifacts();
    
    // Check for orphaned processes
    const orphaned = await checkOrphanedProcesses();
    if (orphaned.length > 0) {
      report.warnings.push(`Found ${orphaned.length} orphaned processes`);
    }
    
    // Calculate duration
    report.duration = Date.now() - teardownStartTime;
    
    // Generate report
    await generateTeardownReport(report);
    
    console.log('✅ Enhanced Tauri test teardown completed successfully');
    
  } catch (error) {
    console.error('❌ Enhanced Tauri test teardown failed:', error);
    report.success = false;
    report.errors.push(`Teardown failed: ${error.message}`);
    
    // Still try to generate report
    report.duration = Date.now() - teardownStartTime;
    await generateTeardownReport(report);
    
    throw error;
  }
}

/**
 * Manual cleanup function for emergency use
 */
export async function emergencyCleanup(): Promise<void> {
  console.log('🚨 Emergency cleanup initiated...');
  
  try {
    const { exec } = require('child_process');
    
    // Kill all Tauri processes
    await promisify(exec)('pkill -f tauri || true');
    
    // Kill all TunnelForge processes
    await promisify(exec)('pkill -f tunnelforge || true');
    
    // Kill all Xvfb processes
    await promisify(exec)('pkill Xvfb || true');
    
    // Wait for processes to die
    await sleep(3000);
    
    console.log('✅ Emergency cleanup completed');
  } catch (error) {
    console.error('❌ Emergency cleanup failed:', error);
  }
}