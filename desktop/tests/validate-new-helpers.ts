#!/usr/bin/env node

/**
 * Validation script for the new Tauri test helpers
 * 
 * This script validates that all helpers are properly implemented
 * and can be imported without errors.
 */

import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs/promises';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function validateHelpers() {
  console.log('🔍 Validating Tauri Test Helpers...\n');

  const results = {
    imports: { passed: 0, failed: 0, errors: [] as string[] },
    types: { passed: 0, failed: 0, errors: [] as string[] },
    structure: { passed: 0, failed: 0, errors: [] as string[] }
  };

  // Test 1: Validate imports
  console.log('📦 Testing imports...');
  
  try {
    const helpersModule = await import('./helpers/index.ts');
    console.log('✅ Main helpers module imported successfully');
    results.imports.passed++;
    
    // Check if factory function exists
    if (typeof helpersModule.createTauriTestHelpers === 'function') {
      console.log('✅ createTauriTestHelpers factory function exists');
      results.imports.passed++;
    } else {
      throw new Error('createTauriTestHelpers function not found');
    }
    
    // Check if all expected exports are present
    const expectedExports = [
      'createTauriTestHelpers',
      'TauriAppHelper',
      'CommandHelper', 
      'WindowHelper',
      'SystemHelper',
      'NetworkHelper',
      'ConfigHelper'
    ];
    
    for (const exportName of expectedExports) {
      if (helpersModule[exportName]) {
        console.log(`✅ ${exportName} exported successfully`);
        results.imports.passed++;
      } else {
        throw new Error(`${exportName} not exported`);
      }
    }
    
  } catch (error) {
    console.error('❌ Import validation failed:', error.message);
    results.imports.failed++;
    results.imports.errors.push(error.message);
  }

  // Test 2: Validate types
  console.log('\n🔷 Testing types...');
  
  try {
    const typesModule = await import('./helpers/types.ts');
    console.log('✅ Types module imported successfully');
    results.types.passed++;
    
    // Check essential types
    const essentialTypes = [
      'TestConfig',
      'TauriAppInfo', 
      'CommandResult',
      'WindowState',
      'SystemInfo',
      'NetworkStatus',
      'ConfigData'
    ];
    
    for (const typeName of essentialTypes) {
      if (typesModule[typeName]) {
        console.log(`✅ ${typeName} type exists`);
        results.types.passed++;
      } else {
        throw new Error(`${typeName} type not found`);
      }
    }
    
  } catch (error) {
    console.error('❌ Type validation failed:', error.message);
    results.types.failed++;
    results.types.errors.push(error.message);
  }

  // Test 3: Validate helper structure
  console.log('\n🏗️ Testing helper structure...');
  
  try {
    const helpersDir = path.join(__dirname, 'helpers');
    const files = await fs.readdir(helpersDir);
    
    const expectedFiles = [
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
    
    for (const expectedFile of expectedFiles) {
      if (files.includes(expectedFile)) {
        console.log(`✅ ${expectedFile} exists`);
        results.structure.passed++;
      } else {
        throw new Error(`${expectedFile} not found in helpers directory`);
      }
    }
    
    // Check file contents for key patterns
    for (const file of expectedFiles.filter(f => f.endsWith('.ts'))) {
      const filePath = path.join(helpersDir, file);
      const content = await fs.readFile(filePath, 'utf8');
      
      // Basic TypeScript syntax check
      if (content.includes('export') && content.includes('class')) {
        console.log(`✅ ${file} has proper TypeScript structure`);
        results.structure.passed++;
      } else if (file === 'types.ts' && content.includes('interface')) {
        console.log(`✅ ${file} has proper TypeScript interfaces`);
        results.structure.passed++;
      } else if (file === 'index.ts' && content.includes('export')) {
        console.log(`✅ ${file} has proper exports`);
        results.structure.passed++;
      }
    }
    
  } catch (error) {
    console.error('❌ Structure validation failed:', error.message);
    results.structure.failed++;
    results.structure.errors.push(error.message);
  }

  // Test 4: Validate example usage
  console.log('\n📚 Testing example usage...');
  
  try {
    const examplePath = path.join(__dirname, 'helpers', 'example-usage.ts');
    const exampleContent = await fs.readFile(examplePath, 'utf8');
    
    // Check if example contains key usage patterns
    const patterns = [
      'createTauriTestHelpers',
      'helpers.app.',
      'helpers.command.',
      'helpers.window.',
      'helpers.system.',
      'helpers.network.',
      'helpers.config.'
    ];
    
    for (const pattern of patterns) {
      if (exampleContent.includes(pattern)) {
        console.log(`✅ Example contains ${pattern}`);
        results.structure.passed++;
      } else {
        throw new Error(`Example missing ${pattern}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Example usage validation failed:', error.message);
    results.structure.failed++;
    results.structure.errors.push(error.message);
  }

  // Summary
  console.log('\n📊 Validation Summary:');
  console.log('========================');
  
  const totalPassed = results.imports.passed + results.types.passed + results.structure.passed;
  const totalFailed = results.imports.failed + results.types.failed + results.structure.failed;
  const totalTests = totalPassed + totalFailed;
  
  console.log(`Imports: ${results.imports.passed} passed, ${results.imports.failed} failed`);
  console.log(`Types: ${results.types.passed} passed, ${results.types.failed} failed`);
  console.log(`Structure: ${results.structure.passed} passed, ${results.structure.failed} failed`);
  console.log(`\nTotal: ${totalPassed}/${totalTests} tests passed (${Math.round(totalPassed/totalTests * 100)}%)`);
  
  if (totalFailed > 0) {
    console.log('\n❌ Errors encountered:');
    console.log('=======================');
    
    [...results.imports.errors, ...results.types.errors, ...results.structure.errors]
      .forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    
    console.log('\n💡 Please fix the errors before using the helpers in tests.');
    process.exit(1);
  } else {
    console.log('\n✅ All validations passed! The helpers are ready to use.');
    console.log('\n🚀 Next steps:');
    console.log('1. Update your test files to use the new helpers');
    console.log('2. Run the migration guide: ./MIGRATION_GUIDE.md');
    console.log('3. Check example usage: ./helpers/example-usage.ts');
    process.exit(0);
  }
}

// Run validation
validateHelpers().catch(error => {
  console.error('💥 Validation script failed:', error);
  process.exit(1);
});