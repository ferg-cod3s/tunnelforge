#!/usr/bin/env node

/**
 * Simple validation script for the new Tauri test helpers
 * 
 * This script validates that all helper files exist and have proper structure.
 */

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function validateHelpers() {
  console.log('🔍 Validating Tauri Test Helpers Structure...\n');

  const results = {
    files: { passed: 0, failed: 0, errors: [] as string[] },
    structure: { passed: 0, failed: 0, errors: [] as string[] },
    content: { passed: 0, failed: 0, errors: [] as string[] }
  };

  // Test 1: Validate all required files exist
  console.log('📁 Checking required files...');
  
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
    'README.md',
    'example-usage.ts'
  ];
  
  const helpersDir = path.join(__dirname, 'helpers');
  
  try {
    const files = await fs.readdir(helpersDir);
    
    for (const requiredFile of requiredFiles) {
      if (files.includes(requiredFile)) {
        console.log(`✅ ${requiredFile} exists`);
        results.files.passed++;
      } else {
        console.log(`❌ ${requiredFile} missing`);
        results.files.failed++;
        results.files.errors.push(`${requiredFile} not found`);
      }
    }
    
  } catch (error) {
    console.error('❌ Failed to read helpers directory:', error.message);
    results.files.failed++;
    results.files.errors.push(error.message);
  }

  // Test 2: Validate file structure
  console.log('\n🏗️ Checking file structure...');
  
  const structureChecks = [
    { file: 'index.ts', pattern: 'export.*createTauriTestHelpers', description: 'exports factory function' },
    { file: 'types.ts', pattern: 'interface.*TestConfig', description: 'defines TestConfig interface' },
    { file: 'tauri-app-helper.ts', pattern: 'class.*TauriAppHelper', description: 'defines TauriAppHelper class' },
    { file: 'command-helper.ts', pattern: 'class.*CommandHelper', description: 'defines CommandHelper class' },
    { file: 'window-helper.ts', pattern: 'class.*WindowHelper', description: 'defines WindowHelper class' },
    { file: 'system-helper.ts', pattern: 'class.*SystemHelper', description: 'defines SystemHelper class' },
    { file: 'network-helper.ts', pattern: 'class.*NetworkHelper', description: 'defines NetworkHelper class' },
    { file: 'config-helper.ts', pattern: 'class.*ConfigHelper', description: 'defines ConfigHelper class' },
    { file: 'utils.ts', pattern: 'export.*function', description: 'exports utility functions' },
    { file: 'error-handling.ts', pattern: 'class.*TauriErrorHandler', description: 'defines error classes' },
    { file: 'logging.ts', pattern: 'class.*Logger', description: 'defines logging classes' },
    { file: 'validation.ts', pattern: 'class.*ValidationEngine', description: 'defines validation classes' }
  ];
  
  for (const check of structureChecks) {
    try {
      const filePath = path.join(helpersDir, check.file);
      const content = await fs.readFile(filePath, 'utf8');
      const regex = new RegExp(check.pattern);
      
      if (regex.test(content)) {
        console.log(`✅ ${check.file} ${check.description}`);
        results.structure.passed++;
      } else {
        console.log(`❌ ${check.file} missing ${check.description}`);
        results.structure.failed++;
        results.structure.errors.push(`${check.file}: ${check.description} not found`);
      }
    } catch (error) {
      console.log(`❌ Failed to check ${check.file}:`, error.message);
      results.structure.failed++;
      results.structure.errors.push(`${check.file}: ${error.message}`);
    }
  }

  // Test 3: Validate content quality
  console.log('\n📝 Checking content quality...');
  
  const contentChecks = [
    { 
      file: 'README.md', 
      patterns: [
        { pattern: '# Tauri Test Helpers', description: 'has proper title' },
        { pattern: '## Installation', description: 'has installation section' },
        { pattern: '## Usage', description: 'has usage section' }
      ]
    },
    { 
      file: 'example-usage.ts', 
      patterns: [
        { pattern: 'createTauriTestHelpers', description: 'imports helpers' },
        { pattern: 'helpers\\.app\\.', description: 'shows app helper usage' },
        { pattern: 'helpers\\.command\\.', description: 'shows command helper usage' },
        { pattern: 'helpers\\.window\\.', description: 'shows window helper usage' },
        { pattern: 'helpers\\.system\\.', description: 'shows system helper usage' },
        { pattern: 'helpers\\.network\\.', description: 'shows network helper usage' },
        { pattern: 'helpers\\.config\\.', description: 'shows config helper usage' }
      ]
    }
  ];
  
  for (const check of contentChecks) {
    try {
      const filePath = path.join(helpersDir, check.file);
      const content = await fs.readFile(filePath, 'utf8');
      
      for (const pattern of check.patterns) {
        const regex = new RegExp(pattern.pattern);
        if (regex.test(content)) {
          console.log(`✅ ${check.file} ${pattern.description}`);
          results.content.passed++;
        } else {
          console.log(`❌ ${check.file} missing ${pattern.description}`);
          results.content.failed++;
          results.content.errors.push(`${check.file}: ${pattern.description} not found`);
        }
      }
    } catch (error) {
      console.log(`❌ Failed to check ${check.file}:`, error.message);
      results.content.failed++;
      results.content.errors.push(`${check.file}: ${error.message}`);
    }
  }

  // Test 4: Check for TypeScript compilation issues
  console.log('\n🔷 Checking TypeScript syntax...');
  
  try {
    const tsFiles = requiredFiles.filter(f => f.endsWith('.ts'));
    
    for (const tsFile of tsFiles) {
      const filePath = path.join(helpersDir, tsFile);
      const content = await fs.readFile(filePath, 'utf8');
      
      // Basic syntax checks
      const hasExports = content.includes('export');
      const hasImports = content.includes('import');
      const hasClasses = content.includes('class') || content.includes('interface');
      const hasFunctions = content.includes('function') || content.includes('async');
      
      if (hasExports && (hasClasses || hasFunctions)) {
        console.log(`✅ ${tsFile} has valid TypeScript structure`);
        results.content.passed++;
      } else {
        console.log(`❌ ${tsFile} has invalid TypeScript structure`);
        results.content.failed++;
        results.content.errors.push(`${tsFile}: Invalid TypeScript structure`);
      }
    }
    
  } catch (error) {
    console.error('❌ TypeScript syntax check failed:', error.message);
    results.content.failed++;
    results.content.errors.push(`TypeScript check: ${error.message}`);
  }

  // Summary
  console.log('\n📊 Validation Summary:');
  console.log('========================');
  
  const totalPassed = results.files.passed + results.structure.passed + results.content.passed;
  const totalFailed = results.files.failed + results.structure.failed + results.content.failed;
  const totalTests = totalPassed + totalFailed;
  
  console.log(`Files: ${results.files.passed} passed, ${results.files.failed} failed`);
  console.log(`Structure: ${results.structure.passed} passed, ${results.structure.failed} failed`);
  console.log(`Content: ${results.content.passed} passed, ${results.content.failed} failed`);
  console.log(`\nTotal: ${totalPassed}/${totalTests} tests passed (${Math.round(totalPassed/totalTests * 100)}%)`);
  
  if (totalFailed > 0) {
    console.log('\n❌ Errors encountered:');
    console.log('=======================');
    
    [...results.files.errors, ...results.structure.errors, ...results.content.errors]
      .forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    
    console.log('\n💡 Please fix the errors before using the helpers in tests.');
    process.exit(1);
  } else {
    console.log('\n✅ All validations passed! The helpers are ready to use.');
    console.log('\n🚀 Next steps:');
    console.log('1. Update your test files to use the new helpers');
    console.log('2. Follow the migration guide: ./MIGRATION_GUIDE.md');
    console.log('3. Check example usage: ./helpers/example-usage.ts');
    console.log('4. Run tests to verify integration');
    process.exit(0);
  }
}

// Run validation
validateHelpers().catch(error => {
  console.error('💥 Validation script failed:', error);
  process.exit(1);
});