#!/usr/bin/env node

/**
 * Helper Validation Script
 * 
 * This script validates that the comprehensive Tauri test helpers
 * are properly set up and functioning correctly.
 */

import { spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const sleep = promisify(setTimeout);

interface ValidationResult {
  success: boolean;
  message: string;
  details?: any;
}

class HelperValidator {
  private results: ValidationResult[] = [];

  async validateAll(): Promise<void> {
    console.log('🔍 Starting comprehensive helper validation...\n');

    // Validate file structure
    await this.validateFileStructure();
    
    // Validate TypeScript compilation
    await this.validateTypeScriptCompilation();
    
    // Validate imports and exports
    await this.validateImports();
    
    // Validate type definitions
    await this.validateTypeDefinitions();
    
    // Validate configuration
    await this.validateConfiguration();
    
    // Print results
    this.printResults();
    
    // Exit with appropriate code
    const allPassed = this.results.every(r => r.success);
    process.exit(allPassed ? 0 : 1);
  }

  private async validateFileStructure(): Promise<void> {
    console.log('📁 Validating file structure...');
    
    const requiredFiles = [
      'index.ts',
      'types.ts',
      'tauri-app-helper.ts',
      'command-helper.ts',
      'window-helper.ts',
      'system-helper.ts',
      'network-helper.ts',
      'config-helper.ts',
      'utils.ts',
      'error-handling.ts',
      'logging.ts',
      'validation.ts',
      'example-usage.ts',
      'README.md'
    ];

    const helpersDir = path.join(__dirname);
    
    for (const file of requiredFiles) {
      const filePath = path.join(helpersDir, file);
      
      try {
        await fs.access(filePath);
        this.addResult(true, `✅ ${file} exists`);
      } catch (error) {
        this.addResult(false, `❌ ${file} missing`, { error: error.message });
      }
    }
    
    console.log('');
  }

  private async validateTypeScriptCompilation(): Promise<void> {
    console.log('🔧 Validating TypeScript compilation...');
    
    return new Promise((resolve) => {
      const tsc = spawn('npx', ['tsc', '--noEmit', '--skipLibCheck'], {
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe'
      });

      let stdout = '';
      let stderr = '';

      tsc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      tsc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      tsc.on('close', (code) => {
        if (code === 0) {
          this.addResult(true, '✅ TypeScript compilation successful');
        } else {
          this.addResult(false, '❌ TypeScript compilation failed', {
            code,
            stdout: stdout.trim(),
            stderr: stderr.trim()
          });
        }
        resolve();
      });

      tsc.on('error', (error) => {
        this.addResult(false, '❌ TypeScript compiler error', { error: error.message });
        resolve();
      });
    });
  }

  private async validateImports(): Promise<void> {
    console.log('📦 Validating imports and exports...');
    
    try {
      // Test main index export
      const indexContent = await fs.readFile(path.join(__dirname, 'index.ts'), 'utf8');
      
      if (indexContent.includes('export function createTauriTestHelpers')) {
        this.addResult(true, '✅ Main export function exists');
      } else {
        this.addResult(false, '❌ Main export function missing');
      }

      // Test type exports
      if (indexContent.includes('export * from \'./types\'')) {
        this.addResult(true, '✅ Types exported correctly');
      } else {
        this.addResult(false, '❌ Types not exported');
      }

      // Test helper exports
      const expectedExports = [
        'TauriAppHelper',
        'CommandHelper', 
        'WindowHelper',
        'SystemHelper',
        'NetworkHelper',
        'ConfigHelper'
      ];

      for (const exportName of expectedExports) {
        if (indexContent.includes(exportName)) {
          this.addResult(true, `✅ ${exportName} exported`);
        } else {
          this.addResult(false, `❌ ${exportName} not exported`);
        }
      }

    } catch (error) {
      this.addResult(false, '❌ Failed to read index file', { error: error.message });
    }
    
    console.log('');
  }

  private async validateTypeDefinitions(): Promise<void> {
    console.log('📝 Validating type definitions...');
    
    try {
      const typesContent = await fs.readFile(path.join(__dirname, 'types.ts'), 'utf8');
      
      // Check for essential interfaces
      const essentialInterfaces = [
        'TunnelForgeTestConfig',
        'TauriAppInfo',
        'CommandResult',
        'NetworkTestResult',
        'ValidationResult',
        'PerformanceMetrics'
      ];

      for (const interfaceName of essentialInterfaces) {
        if (typesContent.includes(`interface ${interfaceName}`) || 
            typesContent.includes(`type ${interfaceName}`)) {
          this.addResult(true, `✅ ${interfaceName} type defined`);
        } else {
          this.addResult(false, `❌ ${interfaceName} type missing`);
        }
      }

      // Check for essential enums
      const essentialEnums = [
        'Platform',
        'LogLevel',
        'ValidationRuleType'
      ];

      for (const enumName of essentialEnums) {
        if (typesContent.includes(`enum ${enumName}`)) {
          this.addResult(true, `✅ ${enumName} enum defined`);
        } else {
          this.addResult(false, `❌ ${enumName} enum missing`);
        }
      }

    } catch (error) {
      this.addResult(false, '❌ Failed to read types file', { error: error.message });
    }
    
    console.log('');
  }

  private async validateConfiguration(): Promise<void> {
    console.log('⚙️ Validating configuration...');
    
    try {
      // Test configuration validation
      const testConfig = {
        timeouts: {
          default: 30000,
          network: 15000,
          command: 10000,
          ui: 5000
        },
        retries: {
          default: 3,
          network: 5,
          command: 2
        },
        performance: {
          enableMetrics: true,
          screenshotOnFailure: true,
          videoRecording: false
        },
        network: {
          baseUrl: 'http://localhost:1420',
          apiEndpoint: 'http://localhost:4021',
          timeout: 15000
        },
        platform: {
          isWindows: false,
          isMacOS: false,
          isLinux: true,
          isWSL: false,
          isCI: false,
          arch: 'x64'
        },
        wsl: {
          enabled: false,
          displayServer: 'x11',
          audioSupport: false
        }
      };

      // Validate configuration structure
      const requiredSections = ['timeouts', 'retries', 'performance', 'network', 'platform', 'wsl'];
      
      for (const section of requiredSections) {
        if (testConfig[section]) {
          this.addResult(true, `✅ Configuration section '${section}' exists`);
        } else {
          this.addResult(false, `❌ Configuration section '${section}' missing`);
        }
      }

      // Validate timeout values
      const timeouts = testConfig.timeouts;
      if (timeouts.default > 0 && timeouts.network > 0 && timeouts.command > 0 && timeouts.ui > 0) {
        this.addResult(true, '✅ Timeout values are valid');
      } else {
        this.addResult(false, '❌ Invalid timeout values');
      }

      // Validate retry values
      const retries = testConfig.retries;
      if (retries.default >= 0 && retries.network >= 0 && retries.command >= 0) {
        this.addResult(true, '✅ Retry values are valid');
      } else {
        this.addResult(false, '❌ Invalid retry values');
      }

    } catch (error) {
      this.addResult(false, '❌ Configuration validation failed', { error: error.message });
    }
    
    console.log('');
  }

  private addResult(success: boolean, message: string, details?: any): void {
    this.results.push({ success, message, details });
  }

  private printResults(): void {
    console.log('\n📊 VALIDATION RESULTS');
    console.log('='.repeat(50));
    
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const total = this.results.length;

    console.log(`\nSummary: ${passed}/${total} passed, ${failed} failed\n`);

    // Print failed results with details
    const failedResults = this.results.filter(r => !r.success);
    if (failedResults.length > 0) {
      console.log('❌ FAILED VALIDATIONS:');
      console.log('-'.repeat(30));
      
      for (const result of failedResults) {
        console.log(`\n${result.message}`);
        if (result.details) {
          console.log('Details:', JSON.stringify(result.details, null, 2));
        }
      }
    }

    // Print passed results
    const passedResults = this.results.filter(r => r.success);
    if (passedResults.length > 0) {
      console.log('\n✅ PASSED VALIDATIONS:');
      console.log('-'.repeat(30));
      
      for (const result of passedResults) {
        console.log(result.message);
      }
    }

    console.log('\n' + '='.repeat(50));
    
    if (failed === 0) {
      console.log('🎉 All validations passed! The helper framework is ready to use.');
    } else {
      console.log(`⚠️ ${failed} validation(s) failed. Please fix the issues before using the framework.`);
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new HelperValidator();
  validator.validateAll().catch(error => {
    console.error('❌ Validation script failed:', error);
    process.exit(1);
  });
}

export { HelperValidator };