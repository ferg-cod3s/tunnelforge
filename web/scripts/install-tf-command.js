#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Helper function to detect global installation
const detectGlobalInstall = () => {
  if (process.env.npm_config_global === 'true') return true;
  if (process.env.npm_config_global === 'false') return false;
  
  try {
    const globalPrefix = execSync('npm config get prefix', { encoding: 'utf8' }).trim();
    const globalModules = path.join(globalPrefix, process.platform === 'win32' ? 'node_modules' : 'lib/node_modules');
    const packagePath = path.resolve(__dirname, '..');
    return packagePath.startsWith(globalModules);
  } catch {
    return false; // Default to local install
  }
};

// Helper function to get npm global bin directory
const getNpmBinDir = () => {
  try {
    // Try npm config first (more reliable)
    const npmPrefix = execSync('npm config get prefix', { encoding: 'utf8' }).trim();
    return path.join(npmPrefix, 'bin');
  } catch (e) {
    console.warn('⚠️  Could not determine npm global bin directory');
    return null;
  }
};

// Helper function to install tf globally
const installGlobalTf = (tfSource, npmBinDir) => {
  const tfTarget = path.join(npmBinDir, 'tf');
  const isWindows = process.platform === 'win32';

  // Check if tf already exists
  if (fs.existsSync(tfTarget) || (isWindows && fs.existsSync(tfTarget + '.cmd'))) {
    console.log('⚠️  A "tf" command already exists in your system');
    console.log('   TunnelForge\'s tf wrapper was not installed to avoid conflicts');
    console.log('   You can still use "npx tf" or the full path to run TunnelForge\'s tf');
    return true;
  }
  
   try {
     if (isWindows) {
       // On Windows, create a .cmd wrapper
       const cmdContent = `@echo off\r\nnode "%~dp0\\tf" %*\r\n`;
       fs.writeFileSync(tfTarget + '.cmd', cmdContent);
       // Also copy the actual script
       fs.copyFileSync(tfSource, tfTarget);
       console.log('✓ tf command installed globally (Windows)');
     } else {
       // On Unix-like systems, create symlink
       fs.symlinkSync(tfSource, tfTarget);
       console.log('✓ tf command installed globally');
     }
     console.log('  You can now use "tf" to wrap commands with TunnelForge');
     return true;
   } catch (symlinkError) {
     // If symlink fails on Unix, try copying the file
     if (!isWindows) {
       try {
         fs.copyFileSync(tfSource, tfTarget);
         fs.chmodSync(tfTarget, '755');
         console.log('✓ tf command installed globally (copied)');
         console.log('  You can now use "tf" to wrap commands with TunnelForge');
         return true;
       } catch (copyError) {
        console.warn('⚠️  Could not install tf command globally:', copyError.message);
        console.log('   Use "npx tf" or "tunnelforge fwd" instead');
        return false;
      }
    } else {
      console.warn('⚠️  Could not install tf command on Windows:', symlinkError.message);
      console.log('   Use "npx tf" or "tunnelforge fwd" instead');
      return false;
    }
  }
};

// Install tf command handler
const installTfCommand = (tfSource, isGlobalInstall) => {
  if (!fs.existsSync(tfSource)) {
    console.warn('⚠️  tf command script not found in package');
    console.log('   Use "tunnelforge" command instead');
    return false;
  }

  try {
    // Make tf script executable (Unix-like systems only)
    if (process.platform !== 'win32') {
      fs.chmodSync(tfSource, '755');
    }
    
    if (!isGlobalInstall) {
      console.log('✓ tf command configured for local use');
      console.log('  Use "npx tf" to run the tf wrapper');
      return true;
    }

    const npmBinDir = getNpmBinDir();
    if (!npmBinDir) {
      return false;
    }

    return installGlobalTf(tfSource, npmBinDir);
  } catch (error) {
    console.warn('⚠️  Could not configure tf command:', error.message);
    console.log('   Use "tunnelforge" command instead');
    return false;
  }
};

module.exports = {
  detectGlobalInstall,
  getNpmBinDir,
  installGlobalVt,
  installVtCommand
};