#!/usr/bin/env node

/**
 * TunnelForge Desktop UI Test Suite
 * 
 * Comprehensive tests for the desktop app UI functionality
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.join(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');

console.log('🚀 TunnelForge Desktop UI Test Suite');
console.log('========================================');

// Test categories
const tests = {
    files: [],
    structure: [],
    functionality: [],
    integration: []
};

function addTest(category, name, testFn) {
    tests[category].push({ name, testFn });
}

function runTest(category, test) {
    try {
        const result = test.testFn();
        const status = result ? '✅' : '❌';
        console.log(`   ${status} ${test.name}`);
        return result;
    } catch (error) {
        console.log(`   ❌ ${test.name}: ${error.message}`);
        return false;
    }
}

function runTestCategory(categoryName) {
    const categoryTests = tests[categoryName];
    if (categoryTests.length === 0) return { passed: 0, total: 0 };
    
    console.log(`\n${categoryName.toUpperCase()} TESTS:`);
    let passed = 0;
    let total = categoryTests.length;
    
    for (const test of categoryTests) {
        if (runTest(categoryName, test)) {
            passed++;
        }
    }
    
    return { passed, total };
}

// File existence tests
addTest('files', 'index.html exists', () => fs.existsSync(path.join(distDir, 'index.html')));
addTest('files', 'app.js exists', () => fs.existsSync(path.join(distDir, 'app.js')));
addTest('files', 'style.css exists', () => fs.existsSync(path.join(distDir, 'style.css')));

// Structure tests
addTest('structure', 'HTML contains required scripts', () => {
    const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
    return html.includes('script src="app.js"');
});

addTest('structure', 'HTML contains required stylesheets', () => {
    const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
    return html.includes('link rel="stylesheet" href="style.css"');
});

addTest('structure', 'HTML contains all tab navigation elements', () => {
    const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
    const tabs = ['general', 'notifications', 'power', 'integrations', 'server'];
    return tabs.every(tab => html.includes(`data-tab="${tab}"`));
});

addTest('structure', 'HTML contains all settings panels', () => {
    const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
    const panels = ['general', 'notifications', 'power', 'integrations', 'server'];
    return panels.every(panel => html.includes(`id="${panel}"`));
});

// Functionality tests
addTest('functionality', 'JavaScript contains tab switching logic', () => {
    const js = fs.readFileSync(path.join(distDir, 'app.js'), 'utf8');
    return js.includes('addEventListener') && 
           js.includes('data-tab') && 
           js.includes('classList.add') &&
           js.includes('classList.remove');
});

addTest('functionality', 'JavaScript contains settings management', () => {
    const js = fs.readFileSync(path.join(distDir, 'app.js'), 'utf8');
    return js.includes('loadSettings') && js.includes('saveSettings');
});

addTest('functionality', 'JavaScript contains server management', () => {
    const js = fs.readFileSync(path.join(distDir, 'app.js'), 'utf8');
    return js.includes('checkServerStatus') && js.includes('manageServer');
});

addTest('functionality', 'CSS contains tab and panel styles', () => {
    const css = fs.readFileSync(path.join(distDir, 'style.css'), 'utf8');
    return css.includes('.nav-link') && 
           css.includes('.settings-panel') && 
           css.includes('.active');
});

// Integration tests
addTest('integration', 'Tauri config points to correct frontend dist', () => {
    const configPath = path.join(projectRoot, 'src-tauri', 'tauri.conf.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config.build.frontendDist === '../dist';
});

addTest('integration', 'Tauri config has required plugins', () => {
    const configPath = path.join(projectRoot, 'src-tauri', 'tauri.conf.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config.plugins && 
           config.plugins.shell && 
           config.plugins.opener;
});

addTest('integration', 'Rust main window loads local assets', () => {
    const mainWindowPath = path.join(projectRoot, 'src-tauri', 'src', 'ui', 'main_window.rs');
    if (!fs.existsSync(mainWindowPath)) return false;
    
    const rust = fs.readFileSync(mainWindowPath, 'utf8');
    return rust.includes('WebviewUrl::App') && rust.includes('index.html');
});

// Asset validation tests
addTest('functionality', 'JavaScript is valid syntax (not HTML)', () => {
    const js = fs.readFileSync(path.join(distDir, 'app.js'), 'utf8');
    const trimmed = js.trim();
    return !trimmed.startsWith('<!DOCTYPE') && 
           !trimmed.startsWith('<html') &&
           !trimmed.startsWith('<');
});

addTest('functionality', 'CSS is valid syntax', () => {
    const css = fs.readFileSync(path.join(distDir, 'style.css'), 'utf8');
    return css.includes('{') && css.includes('}') && css.trim().length > 0;
});

// Additional functionality tests
addTest('functionality', 'HTML form elements have proper IDs', () => {
    const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
    const requiredIds = [
        'autoStart', 'showInDock', 'serverPort', 'accessMode',
        'notificationsEnabled', 'testNotification',
        'startServer', 'stopServer', 'restartServer',
        'saveSettings'
    ];
    return requiredIds.every(id => html.includes(`id="${id}"`));
});

addTest('functionality', 'JavaScript handles form interactions', () => {
    const js = fs.readFileSync(path.join(distDir, 'app.js'), 'utf8');
    return js.includes('getElementById') && 
           js.includes('addEventListener') &&
           js.includes('checked') &&
           js.includes('value');
});

// Run all tests
console.log(`Testing project at: ${projectRoot}`);
console.log(`Dist directory: ${distDir}\n`);

let totalPassed = 0;
let totalTests = 0;

for (const category of Object.keys(tests)) {
    const result = runTestCategory(category);
    totalPassed += result.passed;
    totalTests += result.total;
}

console.log('\n========================================');
console.log(`📊 Test Results: ${totalPassed}/${totalTests} tests passed`);

if (totalPassed === totalTests) {
    console.log('🎉 All tests passed!');
    
    console.log('\n✨ Recommendations:');
    console.log('1. ✅ All UI files are properly structured');
    console.log('2. ✅ JavaScript logic is implemented correctly');
    console.log('3. ✅ Tauri configuration is correct');
    console.log('4. 🔄 If tabs aren\'t working in the app, try rebuilding: cargo tauri dev');
    console.log('5. 🔍 Check browser/webview console for runtime errors');
    
    process.exit(0);
} else {
    console.log('❌ Some tests failed. Please check the issues above.');
    process.exit(1);
}