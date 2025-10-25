import { FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const sleep = promisify(setTimeout);

/**
 * Global teardown for Tauri desktop E2E tests
 * 
 * This teardown handles:
 * - Tauri app shutdown
 * - Virtual display cleanup
 * - Test artifact collection
 * - Environment cleanup
 * - Report generation
 */

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting Tauri E2E test global teardown...');
  
  const isWSL = process.platform === 'linux' && process.env.WSL_DISTRO_NAME;
  const isCI = !!process.env.CI;
  
  try {
    // 1. Collect test artifacts
    await collectTestArtifacts();
    
    // 2. Shutdown Tauri app gracefully
    await shutdownTauriApp();
    
    // 3. Cleanup virtual display
    if (isWSL || isCI) {
      await cleanupVirtualDisplay();
    }
    
    // 4. Generate summary report
    await generateSummaryReport();
    
    // 5. Cleanup temporary files
    await cleanupTempFiles();
    
    console.log('✅ Tauri E2E test global teardown completed successfully');
    
  } catch (error) {
    console.error('❌ Tauri E2E test global teardown failed:', error);
    // Don't throw error in teardown to avoid masking test failures
  }
}

/**
 * Collect test artifacts and organize them
 */
async function collectTestArtifacts() {
  console.log('📦 Collecting test artifacts...');
  
  const artifactsDir = 'test-results/artifacts';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  try {
    await fs.mkdir(artifactsDir, { recursive: true });
    
    // Create artifact summary
    const artifactSummary = {
      timestamp,
      testRun: process.env.TAURI_SETUP_TIME,
      platform: process.platform,
      isWSL: !!process.env.WSL_DISTRO_NAME,
      isCI: !!process.env.CI,
      artifacts: {
        screenshots: await collectFiles('test-results/tauri-screenshots', '.png'),
        videos: await collectFiles('test-results/tauri-videos', '.webm'),
        traces: await collectFiles('test-results/tauri-traces', '.zip'),
        reports: await collectFiles('test-results/tauri-html-report', '.html'),
      },
    };
    
    await fs.writeFile(
      path.join(artifactsDir, `artifact-summary-${timestamp}.json`),
      JSON.stringify(artifactSummary, null, 2)
    );
    
    console.log(`✅ Artifacts collected in ${artifactsDir}`);
    
  } catch (error) {
    console.warn('⚠️ Failed to collect some artifacts:', error.message);
  }
}

/**
 * Collect files from a directory
 */
async function collectFiles(dir: string, extension: string): Promise<string[]> {
  try {
    const files = await fs.readdir(dir);
    return files
      .filter(file => file.endsWith(extension))
      .map(file => path.join(dir, file));
  } catch {
    return [];
  }
}

/**
 * Shutdown Tauri app gracefully
 */
async function shutdownTauriApp() {
  console.log('🛑 Shutting down Tauri app...');
  
  try {
    // Try graceful shutdown first
    try {
      const response = await fetch('http://localhost:1420/__tauri__/shutdown', {
        method: 'POST',
        timeout: 5000,
      });
      if (response.ok) {
        console.log('✅ Tauri app shutdown gracefully');
        await sleep(2000);
        return;
      }
    } catch {
      // Graceful shutdown not available, force shutdown
    }
    
    // Force shutdown processes
    const processes = [
      'tauri dev',
      'src-tauri/target/debug/tunnelforge',
      'src-tauri/target/release/tunnelforge',
    ];
    
    for (const process of processes) {
      try {
        execSync(`pkill -f "${process}"`, { stdio: 'pipe' });
        console.log(`✅ Terminated process: ${process}`);
      } catch {
        // Process not found
      }
    }
    
    // Wait for processes to terminate
    await sleep(3000);
    
    // Final check
    try {
      execSync('pgrep -f "tauri\\|tunnelforge"', { stdio: 'pipe' });
      console.warn('⚠️ Some Tauri processes may still be running');
    } catch {
      console.log('✅ All Tauri processes terminated');
    }
    
  } catch (error) {
    console.warn('⚠️ Error during Tauri app shutdown:', error.message);
  }
}

/**
 * Cleanup virtual display
 */
async function cleanupVirtualDisplay() {
  console.log('🖥️ Cleaning up virtual display...');
  
  try {
    // Kill Xvfb if we started it
    if (process.env.XVFB_PID) {
      try {
        process.kill(parseInt(process.env.XVFB_PID), 'SIGTERM');
        await sleep(1000);
        console.log('✅ Xvfb process terminated');
      } catch (error) {
        console.warn('⚠️ Failed to terminate Xvfb:', error.message);
      }
    }
    
    // Kill any remaining Xvfb processes
    try {
      execSync('pkill -f "Xvfb :99"', { stdio: 'pipe' });
      console.log('✅ Cleaned up remaining Xvfb processes');
    } catch {
      // No processes to kill
    }
    
  } catch (error) {
    console.warn('⚠️ Error during virtual display cleanup:', error.message);
  }
}

/**
 * Generate summary report
 */
async function generateSummaryReport() {
  console.log('📊 Generating summary report...');
  
  try {
    const reportData = {
      timestamp: new Date().toISOString(),
      testRun: process.env.TAURI_SETUP_TIME,
      environment: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        isWSL: !!process.env.WSL_DISTRO_NAME,
        isCI: !!process.env.CI,
        display: process.env.DISPLAY,
      },
      configuration: {
        tauriPort: 1420,
        tunnelForgePort: 4021,
        debugPort: 9222,
        headless: process.env.HEADED !== 'true',
      },
      artifacts: {
        totalScreenshots: await countFiles('test-results/tauri-screenshots'),
        totalVideos: await countFiles('test-results/tauri-videos'),
        totalTraces: await countFiles('test-results/tauri-traces'),
      },
    };
    
    const reportPath = 'test-results/tauri-summary-report.json';
    await fs.writeFile(reportPath, JSON.stringify(reportData, null, 2));
    
    console.log(`✅ Summary report generated: ${reportPath}`);
    
  } catch (error) {
    console.warn('⚠️ Failed to generate summary report:', error.message);
  }
}

/**
 * Count files in a directory
 */
async function countFiles(dir: string): Promise<number> {
  try {
    const files = await fs.readdir(dir);
    return files.length;
  } catch {
    return 0;
  }
}

/**
 * Cleanup temporary files
 */
async function cleanupTempFiles() {
  console.log('🗑️ Cleaning up temporary files...');
  
  const tempPatterns = [
    'test-results/temp-*',
    'test-results/.tmp-*',
    '/tmp/tunnelforge-test-*',
    '/tmp/tauri-test-*',
  ];
  
  for (const pattern of tempPatterns) {
    try {
      execSync(`rm -rf ${pattern}`, { stdio: 'pipe' });
    } catch {
      // No files to clean
    }
  }
  
  console.log('✅ Temporary files cleaned up');
}

export default globalTeardown;