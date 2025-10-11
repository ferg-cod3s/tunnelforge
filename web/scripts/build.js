const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const { prodOptions } = require('./esbuild-config.js');
const { nodePtyPlugin } = require('./node-pty-plugin.js');

async function build() {
  console.log('Starting build process...');
  
  // Validate version sync
  console.log('Validating version sync...');
  execSync('bun run scripts/validate-version-sync.js', { stdio: 'inherit' });

  // Ensure directories exist
  console.log('Creating directories...');
  execSync('bun run scripts/ensure-dirs.js', { stdio: 'inherit' });

  // Copy assets
  console.log('Copying assets...');
  execSync('bun run scripts/copy-assets.js', { stdio: 'inherit' });

  // Build CSS
  console.log('Building CSS...');
  execSync('pnpm exec postcss ./src/client/styles.css -o ./public/bundle/styles.css', { stdio: 'inherit' });

  // Bundle client JavaScript
  console.log('Bundling client JavaScript...');

  try {
    // Build main app bundle
    await esbuild.build({
      ...prodOptions,
      entryPoints: ['src/client/app-entry.ts'],
      outfile: 'public/bundle/client-bundle.js',
    });

    // Build test bundle
    await esbuild.build({
      ...prodOptions,
      entryPoints: ['src/client/test-entry.ts'],
      outfile: 'public/bundle/test.js',
    });


    // Build service worker
    await esbuild.build({
      ...prodOptions,
      entryPoints: ['src/client/sw.ts'],
      outfile: 'public/sw.js',
      format: 'iife', // Service workers need IIFE format
    });

    console.log('Client bundles built successfully');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }

  // Build server TypeScript
  console.log('Building server...');
  execSync('bunx tsc -p tsconfig.server.json', { stdio: 'inherit' });

  // Bundle CLI
  console.log('Bundling CLI...');
  try {
    await esbuild.build({
      entryPoints: ['src/cli.ts'],
      bundle: true,
      platform: 'node',
      target: 'node18',
      format: 'cjs',
      outfile: 'dist/tunnelforge-cli',
      plugins: [nodePtyPlugin],
      external: [
        'node-pty', // Bun-optimized PTY (replaces node-pty)
        'bun:ffi', // Bun FFI module (used by node-pty)
        'authenticate-pam',
        'compression',
        'helmet',
        'express',
        'ws',
        'jsonwebtoken',
        'web-push',
        'bonjour-service',
        'signal-exit',
        'http-proxy-middleware',
        'multer',
        'mime-types',
        '@xterm/headless',
      ],
      minify: true,
      sourcemap: false,
      loader: {
        '.ts': 'ts',
        '.js': 'js',
      },
    });
    
    // Read the file and ensure it has exactly one shebang
    let content = fs.readFileSync('dist/tunnelforge-cli', 'utf8');
    
    // Remove any existing shebangs
    content = content.replace(/^#!.*\n/gm, '');
    
    // Add a single shebang at the beginning
    content = '#!/usr/bin/env node\n' + content;
    
    // Write the fixed content back
    fs.writeFileSync('dist/tunnelforge-cli', content);
    
    // Make the CLI executable
    fs.chmodSync('dist/tunnelforge-cli', '755');
    console.log('CLI bundle created successfully');
  } catch (error) {
    console.error('CLI bundling failed:', error);
    process.exit(1);
  }


  // Build native executable
  console.log('Building native executable...');

  // Check if native binaries already exist (skip build for development)
  const nativeDir = path.join(__dirname, '..', 'native');
  const tunnelforgePath = path.join(nativeDir, 'tunnelforge');
  const ptyNodePath = path.join(nativeDir, 'pty.node');
  const spawnHelperPath = path.join(nativeDir, 'spawn-helper');

  // Note: Skipped when using node-pty (no native compilation needed)
  console.log('✅ Using node-pty - no native compilation needed');
  console.log('Native build step skipped (node-pty is pure Rust FFI)');

  console.log('Build completed successfully!');
}

// Run the build
build().catch(error => {
  console.error('Build failed:', error);
  process.exit(1);
});