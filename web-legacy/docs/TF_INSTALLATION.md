# TF Command Installation Guide

The `tf` command is TunnelForge's convenient wrapper that allows you to run any command with terminal sharing enabled. This guide explains how the installation works and how to manage it.

## Installation Behavior

When you install TunnelForge via npm, the `tf` command installation follows these rules:

### Global Installation (`npm install -g tunnelforge`)
- **Checks for existing `tf` command** to avoid conflicts with other tools
- If no `tf` command exists, creates it globally
- If `tf` already exists, skips installation and shows a warning
- You can still use `npx tf` or `tunnelforge fwd` as alternatives

### Local Installation (`npm install tunnelforge`)
- Configures `tf` for local use only
- Access via `npx tf` within your project

## Platform Support

### macOS and Linux
 - Creates a symlink to the `tf` script
- Falls back to copying if symlink creation fails
- Script is made executable automatically

### Windows
- Creates a `.cmd` wrapper for proper command execution
- Copies the actual script alongside the wrapper
- Works with Command Prompt, PowerShell, and Git Bash

## Common Scenarios

### Existing TF Command
If you already have a `tf` command from another tool:
```bash
# You'll see this warning during installation:
⚠️  A "tf" command already exists in your system
    TunnelForge's tf wrapper was not installed to avoid conflicts
    You can still use "npx tf" or the full path to run TunnelForge's tf
```

**Alternatives:**
 - Use `npx tf` (works globally if installed with -g)
- Use `tunnelforge fwd` directly
- Manually install to a different name (see below)

### Manual Installation
If automatic installation fails or you want to customize:

```bash
# Find where npm installs global packages
npm config get prefix

# On macOS/Linux, create symlink manually
ln -s $(npm root -g)/tunnelforge/bin/tf /usr/local/bin/tf

# Or copy and rename to avoid conflicts
cp $(npm root -g)/tunnelforge/bin/tf /usr/local/bin/tunnelforge-tf
chmod +x /usr/local/bin/tunnelforge-tf
```

### Force Reinstallation
To force TunnelForge to overwrite an existing `tf` command:

```bash
# Remove existing tf first
rm -f $(which tf)

# Then reinstall TunnelForge
npm install -g tunnelforge
```

## Troubleshooting

### Permission Denied
If you get permission errors during global installation:
```bash
# Option 1: Use a Node version manager (recommended)
# With nvm: https://github.com/nvm-sh/nvm
# With fnm: https://github.com/Schniz/fnm

# Option 2: Change npm's default directory
# See: https://docs.npmjs.com/resolving-eacces-permissions-errors
```

### Command Not Found
If `tf` is installed but not found:
```bash
# Check if npm bin directory is in PATH
echo $PATH
npm config get prefix

# Add to your shell profile (.bashrc, .zshrc, etc.)
export PATH="$(npm config get prefix)/bin:$PATH"
```

### Windows Specific Issues
- Ensure Node.js is in your system PATH
- Restart your terminal after installation
- Try using `tf.cmd` explicitly if `tf` doesn't work

## Uninstallation

The `tf` command is removed automatically when you uninstall TunnelForge:
```bash
npm uninstall -g tunnelforge
```

If it persists, remove manually:
```bash
rm -f $(which tf)
# On Windows: del "%APPDATA%\npm\tf.cmd"
```