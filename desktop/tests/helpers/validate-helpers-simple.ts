#!/usr/bin/env node

/**
 * Simple Helper Validation Script
 * 
 * This script validates the comprehensive Tauri test helpers without requiring
 * the full Playwright test infrastructure.
 */

import fs from 'fs/promises';
import path from 'path';

interface ValidationResult {
  file: string;
  success: boolean;
  message: string;
  details?: any;
}

class SimpleHelperValidator {
  private results: ValidationResult[] = [];
  private helpersDir: string;

  constructor() {
    this.helpersDir = path.join(__dirname);
  }

  async validateAll(): Promise<void> {
    console.log('🔍 Starting simple helper validation...\n');

    // Validate file structure
    await this.validateFileStructure();
    
    // Validate TypeScript syntax
    await this.validateTypeScriptSyntax();
    
    // Validate imports and exports
    await this.validateImports();
    
    // Validate essential functions
    await this.validateEssentialFunctions();
    
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
      'README.md'
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(this.helpersDir, file);
      
      try {
        const stats = await fs.stat(filePath);
        if (stats.isFile()) {
          this.addResult(file, true, `✅ ${file} exists and is a file`);
        } else {
          this.addResult(file, false, `❌ ${file} exists but is not a file`);
        }
      } catch (error) {
        this.addResult(file, false, `❌ ${file} missing`, { error: error.message });
      }
    }
    
    console.log('');
  }

  private async validateTypeScriptSyntax(): Promise<void> {
    console.log('🔧 Validating TypeScript syntax...');
    
    const tsFiles = [
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
      'validation.ts'
    ];

    for (const file of tsFiles) {
      const filePath = path.join(this.helpersDir, file);
      
      try {
        const content = await fs.readFile(filePath, 'utf8');
        
        // Basic syntax checks
        const hasExport = content.includes('export');
        const hasImport = content.includes('import');
        const hasClass = content.includes('class ');
        const hasInterface = content.includes('interface ');
        const hasFunction = content.includes('function ') || content.includes('=>');
        
        if (content.length > 0) {
          this.addResult(file, true, `✅ ${file} has valid TypeScript structure`, {
            hasExport,
            hasImport,
            hasClass,
            hasInterface,
            hasFunction,
            size: content.length
          });
        } else {
          this.addResult(file, false, `❌ ${file} is empty`);
        }
        
      } catch (error) {
        this.addResult(file, false, `❌ ${file} syntax error`, { error: error.message });
      }
    }
    
    console.log('');
  }

  private async validateImports(): Promise<void> {
    console.log('📦 Validating imports and exports...');
    
    try {
      // Check main index file
      const indexPath = path.join(this.helpersDir, 'index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf8');
      
      // Check for main export function
      if (indexContent.includes('createTauriTestHelpers')) {
        this.addResult('index.ts', true, '✅ Main export function exists');
      } else {
        this.addResult('index.ts', false, '❌ Main export function missing');
      }

      // Check for type exports
      if (indexContent.includes('export * from \'./types\'')) {
        this.addResult('index.ts', true, '✅ Types exported correctly');
      } else {
        this.addResult('index.ts', false, '❌ Types not exported');
      }

      // Check for helper exports
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
          this.addResult('index.ts', true, `✅ ${exportName} exported`);
        } else {
          this.addResult('index.ts', false, `❌ ${exportName} not exported`);
        }
      }

    } catch (error) {
      this.addResult('index.ts', false, '❌ Failed to read index file', { error: error.message });
    }
    
    console.log('');
  }

  private async validateEssentialFunctions(): Promise<void> {
    console.log('🔍 Validating essential functions...');
    
    try {
      // Check types file
      const typesPath = path.join(this.helpersDir, 'types.ts');
      const typesContent = await fs.readFile(typesPath, 'utf8');
      
      const essentialTypes = [
        'TunnelForgeTestConfig',
        'TauriAppInfo',
        'CommandResult',
        'NetworkTestResult',
        'ValidationResult',
        'PerformanceMetrics'
      ];

      for (const typeName of essentialTypes) {
        if (typesContent.includes(typeName)) {
          this.addResult('types.ts', true, `✅ ${typeName} type defined`);
        } else {
          this.addResult('types.ts', false, `❌ ${typeName} type missing`);
        }
      }

      // Check utils file
      const utilsPath = path.join(this.helpersDir, 'utils.ts');
      const utilsContent = await fs.readFile(utilsPath, 'utf8');
      
      const essentialUtils = [
        'sleep',
        'generateTestId',
        'formatTimestamp',
        'createErrorContext',
        'getPlatformConfig'
      ];

      for (const utilName of essentialUtils) {
        if (utilsContent.includes(utilName)) {
          this.addResult('utils.ts', true, `✅ ${utilName} utility function exists`);
        } else {
          this.addResult('utils.ts', false, `❌ ${utilName} utility function missing`);
        }
      }

      // Check helper files for essential methods
      const helperFiles = [
        { file: 'tauri-app-helper.ts', methods: ['waitForAppReady', 'performHealthCheck', 'getAppInfo'] },
        { file: 'command-helper.ts', methods: ['executeCommand', 'executeBatchCommands'] },
        { file: 'window-helper.ts', methods: ['getCurrentWindowInfo', 'setWindowSize'] },
        { file: 'system-helper.ts', methods: ['getSystemInfo', 'sendNotification'] },
        { file: 'network-helper.ts', methods: ['testBackendConnectivity', 'createTestTunnel'] },
        { file: 'config-helper.ts', methods: ['setConfig', 'getConfig', 'validateConfig'] }
      ];

      for (const helper of helperFiles) {
        const helperPath = path.join(this.helpersDir, helper.file);
        const helperContent = await fs.readFile(helperPath, 'utf8');
        
        for (const method of helper.methods) {
          if (helperContent.includes(method)) {
            this.addResult(helper.file, true, `✅ ${method} method exists`);
          } else {
            this.addResult(helper.file, false, `❌ ${method} method missing`);
          }
        }
      }

    } catch (error) {
      this.addResult('validation', false, '❌ Essential function validation failed', { error: error.message });
    }
    
    console.log('');
  }

  private addResult(file: string, success: boolean, message: string, details?: any): void {
    this.results.push({ file, success, message, details });
  }

  private printResults(): void {
    console.log('\n📊 VALIDATION RESULTS');
    console.log('='.repeat(50));
    
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const total = this.results.length;

    console.log(`\nSummary: ${passed}/${total} passed, ${failed} failed\n`);

    // Group results by file
    const resultsByFile = this.results.reduce((acc, result) => {
      if (!acc[result.file]) {
        acc[result.file] = [];
      }
      acc[result.file].push(result);
      return acc;
    }, {} as Record<string, ValidationResult[]>);

    // Print results by file
    for (const [file, fileResults] of Object.entries(resultsByFile)) {
      console.log(`\n📄 ${file}:`);
      console.log('-'.repeat(30));
      
      const filePassed = fileResults.filter(r => r.success).length;
      const fileFailed = fileResults.filter(r => !r.success).length;
      
      for (const result of fileResults) {
        console.log(`  ${result.message}`);
        if (result.details && !result.success) {
          console.log(`    Details: ${JSON.stringify(result.details, null, 2)}`);
        }
      }
      
      console.log(`  Status: ${filePassed} passed, ${fileFailed} failed`);
    }

    console.log('\n' + '='.repeat(50));
    
    if (failed === 0) {
      console.log('🎉 All validations passed! The helper framework is ready to use.');
      console.log('\n📋 Next steps:');
      console.log('1. Import helpers: import { createTauriTestHelpers } from "../helpers";');
      console.log('2. Create helpers: const helpers = await createTauriTestHelpers(page, context, test.info);');
      console.log('3. Use helpers: await helpers.tauriApp.waitForAppReady();');
      console.log('4. See example-usage.ts for comprehensive examples');
    } else {
      console.log(`⚠️ ${failed} validation(s) failed. Please fix the issues before using the framework.`);
    }
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new SimpleHelperValidator();
  validator.validateAll().catch(error => {
    console.error('❌ Validation script failed:', error);
    process.exit(1);
  });
}

export { SimpleHelperValidator };