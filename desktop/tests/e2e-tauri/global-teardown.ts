import { FullConfig } from '@playwright/test';
import { promisify } from 'util';
import fs from 'fs/promises';

const sleep = promisify(setTimeout);

/**
 * Global teardown for Tauri desktop app testing
 * 
 * This teardown handles:
 * - Tauri app process cleanup
 * - Virtual display cleanup
 * - Test artifact collection
 * - Environment cleanup
 */

interface GlobalSetupContext {
  tauriProcess?: any;
  displayServer?: any;
  debugPort: number;
  appUrl: string;
}

export default async function globalTeardown(config: FullConfig): Promise<void> {
  console.log('🛑 Starting Tauri desktop app test teardown...');
  
  const context: GlobalSetupContext = (global as any).__TAURI_TEST_CONTEXT__ || {};
  
  try {
    // Collect test artifacts before cleanup
    await collectTestArtifacts();
    
    // Cleanup Tauri process (if manually started)
    if (context.tauriProcess) {
      console.log('🔄 Terminating Tauri process...');
      context.tauriProcess.kill('SIGTERM');
      await sleep(2000);
      context.tauriProcess.kill('SIGKILL');
    }
    
    // Cleanup virtual display
    if (context.displayServer) {
      console.log('🖥️ Terminating virtual display...');
      context.displayServer.kill('SIGTERM');
      await sleep(1000);
      context.displayServer.kill('SIGKILL');
    }
    
    // Final cleanup
    await finalCleanup();
    
    console.log('✅ Tauri test teardown completed successfully');
    
  } catch (error) {
    console.error('❌ Tauri test teardown failed:', error);
    // Don't throw here to avoid failing the entire test suite
  }
}

async function collectTestArtifacts(): Promise<void> {
  console.log('📦 Collecting test artifacts...');
  
  const artifactDirs = [
    'test-results/tauri-output',
    'test-results/tauri-screenshots', 
    'test-results/tauri-videos',
    'test-results/tauri-traces',
  ];
  
  for (const dir of artifactDirs) {
    try {
      const stats = await fs.stat(dir);
      console.log(`📁 ${dir}: ${stats.isDirectory() ? 'directory' : 'file'}`);
    } catch (error) {
      // Directory might not exist
    }
  }
  
  // Collect any diagnostic files
  const diagnosticFiles = [
    '/tmp/tauri-*.json',
    '/tmp/tunnelforge-*.log',
    '/tmp/playwright-*.log',
  ];
  
  for (const pattern of diagnosticFiles) {
    try {
      const { exec } = require('child_process');
      const { stdout } = await promisify(exec)(`ls -la ${pattern} 2>/dev/null || echo "No files found"`);
      if (stdout && !stdout.includes('No files found')) {
        console.log(`📄 Diagnostic files: ${stdout.trim()}`);
      }
    } catch (error) {
      // No files found
    }
  }
}

async function finalCleanup(): Promise<void> {
  console.log('🧹 Performing final cleanup...');
  
  // Clean up temporary files
  const tempFiles = [
    '/tmp/tauri-test-*.tmp',
    '/tmp/tunnelforge-test-*.tmp',
  ];
  
  for (const pattern of tempFiles) {
    try {
      const { exec } = require('child_process');
      await promisify(exec)(`rm -f ${pattern}`);
    } catch (error) {
      // Files might not exist
    }
  }
  
  // Reset environment variables
  delete process.env.TUNNELFORGE_TEST_MODE;
  delete process.env.TAURI_DEBUG;
  delete process.env.RUST_BACKTRACE;
  
  console.log('✅ Final cleanup completed');
}