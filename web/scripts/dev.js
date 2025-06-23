const { spawn } = require('child_process');
const path = require('path');
const esbuild = require('esbuild');
const { devOptions } = require('./esbuild-config.js');

console.log('Starting development mode...');

// Determine what to watch based on arguments
const watchServer = !process.argv.includes('--client-only');

// Initial build of assets and CSS
console.log('Initial build...');
require('child_process').execSync('node scripts/ensure-dirs.js', { stdio: 'inherit' });
require('child_process').execSync('node scripts/copy-assets.js', { stdio: 'inherit' });
require('child_process').execSync('npx tailwindcss -i ./src/client/styles.css -o ./public/bundle/styles.css', { stdio: 'inherit' });

// Build the command parts
const commands = [
  // Watch CSS
  ['npx', ['tailwindcss', '-i', './src/client/styles.css', '-o', './public/bundle/styles.css', '--watch']],
  // Watch assets
  ['npx', ['chokidar', 'src/client/assets/**/*', '-c', 'node scripts/copy-assets.js']],
];

// Add server watching if not client-only
if (watchServer) {
  commands.push(['npx', ['tsx', 'watch', 'src/cli.ts']]);
}

// Set up esbuild contexts for watching
async function startBuilding() {
  try {
    // Create esbuild contexts
    const clientContext = await esbuild.context({
      ...devOptions,
      entryPoints: ['src/client/app-entry.ts'],
      outfile: 'public/bundle/client-bundle.js',
    });

    const testContext = await esbuild.context({
      ...devOptions,
      entryPoints: ['src/client/test-entry.ts'],
      outfile: 'public/bundle/test.js',
    });

    const swContext = await esbuild.context({
      ...devOptions,
      entryPoints: ['src/client/sw.ts'],
      outfile: 'public/sw.js',
      format: 'iife', // Service workers need IIFE format
    });

    // Start watching
    await clientContext.watch();
    await testContext.watch();
    await swContext.watch();
    console.log('ESBuild watching client bundles...');

    // Start other processes
    const processes = commands.map(([cmd, args], index) => {
      const proc = spawn(cmd, args, { 
        stdio: 'inherit',
        shell: process.platform === 'win32'
      });
      
      proc.on('error', (err) => {
        console.error(`Process ${index} error:`, err);
      });
      
      return proc;
    });

    // Handle exit
    process.on('SIGINT', async () => {
      console.log('\nStopping all processes...');
      await clientContext.dispose();
      await testContext.dispose();
      await swContext.dispose();
      processes.forEach(proc => proc.kill());
      process.exit(0);
    });

    console.log(`Development mode started (${watchServer ? 'full' : 'client only'})`);
  } catch (error) {
    console.error('Failed to start build:', error);
    process.exit(1);
  }
}

startBuilding();