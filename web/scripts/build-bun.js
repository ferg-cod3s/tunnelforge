const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function buildBun() {
  console.log('Starting Bun build process...');
  
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
  execSync('bunx postcss ./src/client/styles.css -o ./public/bundle/styles.css', { stdio: 'inherit' });

  // Bundle client JavaScript using Bun's bundler
  console.log('Bundling client JavaScript with Bun...');
  
  // Get version from package.json
  const pkg = require('../package.json');
  const version = pkg.version;
  const defineFlags = `--define __APP_VERSION__='"${version}"' --define process.env.NODE_ENV='"production"' --define global=globalThis`;
  
  // Build main app bundle
  execSync(`bun build src/client/app-entry.ts --outfile=public/bundle/client-bundle.js --format=esm --minify ${defineFlags}`, { stdio: 'inherit' });
  
  // Build test bundle
  execSync(`bun build src/client/test-entry.ts --outfile=public/bundle/test.js --format=esm --minify ${defineFlags}`, { stdio: 'inherit' });
  
  // Build service worker
  execSync(`bun build src/client/sw.ts --outfile=public/sw.js --format=iife --minify ${defineFlags}`, { stdio: 'inherit' });

  console.log('Client bundles built successfully with Bun');

  // Build server TypeScript
  console.log('Building server...');
  execSync('bunx tsc -p tsconfig.server.json', { stdio: 'inherit' });

  // Build native executable using Bun
  console.log('Building native Bun executable...');

  // Create native directory
  if (!fs.existsSync('native')) {
    fs.mkdirSync('native');
  }

  // Check for --custom-node flag (not applicable for Bun, but keep for compatibility)
  const useCustomNode = process.argv.includes('--custom-node');
  if (useCustomNode) {
    console.log('Note: --custom-node flag ignored for Bun builds');
  }

  // Use Bun's native bundler to create executable
  execSync('bun run build-native-bun.js', { stdio: 'inherit' });

  console.log('Bun build completed successfully!');
}

// Run the build
buildBun().catch(error => {
  console.error('Bun build failed:', error);
  process.exit(1);
});
