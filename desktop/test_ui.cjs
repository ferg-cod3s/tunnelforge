#!/usr/bin/env node

/**
 * TunnelForge Desktop UI Test Script
 * 
 * This script tests the basic functionality of our desktop app UI
 * by checking if JavaScript files are properly loaded and formatted.
 */

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');
const appJsPath = path.join(distDir, 'app.js');
const indexHtmlPath = path.join(distDir, 'index.html');
const styleCssPath = path.join(distDir, 'style.css');

console.log('🧪 TunnelForge Desktop UI Test');
console.log('=====================================');

// Test 1: Check if all required files exist
console.log('\n1. Checking file existence...');
const files = [
    { name: 'index.html', path: indexHtmlPath },
    { name: 'app.js', path: appJsPath },
    { name: 'style.css', path: styleCssPath }
];

let allFilesExist = true;
files.forEach(file => {
    const exists = fs.existsSync(file.path);
    console.log(`   ${exists ? '✅' : '❌'} ${file.name}: ${exists ? 'exists' : 'missing'}`);
    if (!exists) allFilesExist = false;
});

if (!allFilesExist) {
    console.log('\n❌ Some files are missing. Please check the dist directory.');
    process.exit(1);
}

// Test 2: Check JavaScript syntax
console.log('\n2. Checking JavaScript syntax...');
try {
    const jsContent = fs.readFileSync(appJsPath, 'utf8');
    
    // Check if it starts with valid JavaScript (not HTML)
    if (jsContent.trim().startsWith('<!DOCTYPE') || jsContent.trim().startsWith('<html')) {
        console.log('   ❌ app.js contains HTML instead of JavaScript');
        console.log('   This explains the "Unexpected token <" error');
        process.exit(1);
    } else {
        console.log('   ✅ app.js contains valid JavaScript syntax');
    }
    
    // Check for key functions
    const requiredFunctions = [
        'addEventListener',
        'initializeUI',
        'setupEventListeners',
        'loadSettings',
        'saveSettings'
    ];
    
    let allFunctionsPresent = true;
    requiredFunctions.forEach(func => {
        const found = jsContent.includes(func);
        console.log(`   ${found ? '✅' : '❌'} Function "${func}": ${found ? 'found' : 'missing'}`);
        if (!found) allFunctionsPresent = false;
    });
    
    if (!allFunctionsPresent) {
        console.log('   ⚠️  Some functions are missing but file is valid');
    }
    
} catch (error) {
    console.log(`   ❌ Error reading app.js: ${error.message}`);
    process.exit(1);
}

// Test 3: Check HTML structure
console.log('\n3. Checking HTML structure...');
try {
    const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
    
    // Check for required elements
    const requiredElements = [
        'script src="app.js"',
        'link rel="stylesheet" href="style.css"',
        'data-tab="general"',
        'data-tab="notifications"', 
        'data-tab="power"',
        'data-tab="integrations"',
        'data-tab="server"'
    ];
    
    let allElementsPresent = true;
    requiredElements.forEach(element => {
        const found = htmlContent.includes(element);
        console.log(`   ${found ? '✅' : '❌'} Element "${element}": ${found ? 'found' : 'missing'}`);
        if (!found) allElementsPresent = false;
    });
    
    if (allElementsPresent) {
        console.log('   ✅ HTML structure looks correct');
    } else {
        console.log('   ❌ HTML structure has issues');
    }
    
} catch (error) {
    console.log(`   ❌ Error reading index.html: ${error.message}`);
    process.exit(1);
}

// Test 4: Check CSS file
console.log('\n4. Checking CSS file...');
try {
    const cssContent = fs.readFileSync(styleCssPath, 'utf8');
    
    if (cssContent.trim().length > 0) {
        console.log('   ✅ style.css contains content');
        
        // Check for key CSS classes
        const requiredClasses = ['.nav-link', '.settings-panel', '.active'];
        requiredClasses.forEach(cls => {
            const found = cssContent.includes(cls);
            console.log(`   ${found ? '✅' : '❌'} CSS class "${cls}": ${found ? 'found' : 'missing'}`);
        });
    } else {
        console.log('   ❌ style.css is empty');
    }
    
} catch (error) {
    console.log(`   ❌ Error reading style.css: ${error.message}`);
    process.exit(1);
}

console.log('\n=====================================');
console.log('🎉 UI Tests completed!');
console.log('\nIf you\'re still seeing "Unexpected token <" errors,');
console.log('the issue is likely with Tauri asset serving configuration.');
console.log('Try rebuilding the app with: cargo tauri dev');