# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VibeTunnel is a macOS application that allows users to access their terminal sessions through any web browser. It consists of:
- Native macOS app (Swift/SwiftUI) in `mac/`
- iOS companion app in `ios/`
- Web frontend (TypeScript/LitElement) and Node.js/Bun server for terminal session management in `web/`

## Critical Development Rules

### Release Process
When the user says "release" or asks to create a release, ALWAYS read and follow `mac/docs/release.md` for the complete release process.

### ABSOLUTE CARDINAL RULES - VIOLATION MEANS IMMEDIATE FAILURE

1. **NEVER, EVER, UNDER ANY CIRCUMSTANCES CREATE A NEW BRANCH WITHOUT EXPLICIT USER PERMISSION**
   - If you are on a branch (not main), you MUST stay on that branch
   - The user will tell you when to create a new branch with commands like "create a new branch" or "switch to a new branch"
   - Creating branches without permission causes massive frustration and cleanup work
   - Even if changes seem unrelated to the current branch, STAY ON THE CURRENT BRANCH

2. **NEVER commit and/or push before the user has tested your changes!**
   - Always wait for user confirmation before committing
   - The user needs to verify changes work correctly first

3. **ABSOLUTELY FORBIDDEN: NEVER USE `git rebase --skip` EVER**
   - This command can cause data loss and repository corruption
   - If you encounter rebase conflicts, ask the user for help

4. **NEVER create duplicate files with version numbers or suffixes**
   - When refactoring or improving code, directly modify the existing files
   - DO NOT create new versions with different file names (e.g., file_v2.ts, file_new.ts)
   - Users hate having to manually clean up duplicate files

5. **Web Development Workflow - Development vs Production Mode**
   - **Production Mode**: Mac app embeds a pre-built web server during Xcode build
     - Every web change requires: clean → build → run (rebuilds embedded server)
     - Simply restarting serves STALE, CACHED version
   - **Development Mode** (recommended for web development):
     - Enable "Use Development Server" in VibeTunnel Settings → Debug
     - Mac app runs `pnpm run dev` instead of embedded server
     - Provides hot reload - web changes automatically rebuild without Mac app rebuild
     - Restart VibeTunnel server (not full rebuild) to pick up web changes
6. **Never kill all sessions**
   - You are running inside a session yourself; killing all sessions would terminate your own process

### Git Workflow Reminders
- Our workflow: start from main → create branch → make PR → merge → return to main
- PRs sometimes contain multiple different features and that's okay
- Always check current branch with `git branch` before making changes
- If unsure about branching, ASK THE USER FIRST

### Terminal Title Management with VT

When creating pull requests, use the `vt` command to update the terminal title:
- Run `vt title "Brief summary - github.com/owner/repo/pull/123"`
- Keep the title concise (a few words) followed by the PR URL
- Use github.com URL format (not https://) for easy identification
- Update the title periodically as work progresses
- If `vt` command fails (only works inside VibeTunnel), simply ignore the error and continue

## Web Development Commands

**DEVELOPMENT MODES**:
- **Standalone Development**: `pnpm run dev` runs independently on port 4020
- **Mac App Integration**: Enable "Development Server" in VibeTunnel settings (recommended)
  - Mac app automatically runs `pnpm run dev` and manages the process
  - Provides seamless integration with Mac app features
  - Hot reload works with full VibeTunnel functionality

In the `web/` directory:

```bash
# Development
pnpm run dev                   # Standalone development server (port 4020)
pnpm run dev --port 4021       # Alternative port for external device testing

# Code quality (MUST run before commit)
pnpm run lint          # Check for linting errors
pnpm run lint:fix      # Auto-fix linting errors
pnpm run format        # Format with Prettier
pnpm run typecheck     # Check TypeScript types

# Testing (only when requested)
pnpm run test
pnpm run test:coverage
pnpm run test:e2e
```

## macOS Development Commands

In the `mac/` directory:

```bash
# Build commands
./scripts/build.sh                    # Build release
./scripts/build.sh --configuration Debug  # Build debug
./scripts/build.sh --sign            # Build with code signing

# Other scripts
./scripts/clean.sh                   # Clean build artifacts
./scripts/lint.sh                    # Run linting
./scripts/create-dmg.sh             # Create installer
```

## Architecture Overview

### Terminal Sharing Protocol
1. **Session Creation**: `POST /api/sessions` spawns new terminal
2. **Input**: `POST /api/sessions/:id/input` sends keyboard/mouse input
3. **Output**:
   - SSE stream at `/api/sessions/:id/stream` (text)
   - WebSocket at `/buffers` (binary, efficient rendering)
4. **Resize**: `POST /api/sessions/:id/resize` (missing in some implementations)

### Key Entry Points
- **Mac App**: `mac/VibeTunnel/VibeTunnelApp.swift`
- **Web Frontend**: `web/src/client/app.ts`
- **Server**: `web/src/server/server.ts`
- **Process spawning and forwarding tool**:  `web/src/server/fwd.ts`
- **Server Management**: `mac/VibeTunnel/Core/Services/ServerManager.swift`

## Testing

- **Never run tests unless explicitly asked**
- Mac tests: Swift Testing framework in `VibeTunnelTests/`
- Web tests: Vitest in `web/src/test/`

## CI Pipeline

The CI workflow automatically runs both Node.js and Mac builds:
- **Node.js CI**: Runs for web OR Mac file changes to ensure web artifacts are always available
- **Mac CI**: Downloads web artifacts from Node.js CI, with fallback to build locally if missing
- **Cross-dependency**: Mac builds require web artifacts, so Node.js CI must complete first

## Testing on External Devices (iPad, Safari, etc.)

When the user reports issues on external devices, use the development server method for testing:

```bash
# Run dev server accessible from external devices
cd web
pnpm run dev --port 4021 --bind 0.0.0.0
```

Then access from the external device using `http://[mac-ip]:4021`

**Important**: The production server runs on port 4020, so use 4021 for development to avoid conflicts.

For detailed instructions, see `docs/TESTING_EXTERNAL_DEVICES.md`

## MCP (Model Context Protocol) Servers

MCP servers extend Claude Code's capabilities with additional tools. Here's how to add them:

### Installing MCP Servers for Claude Code

**Important**: MCP server configuration for Claude Code is different from Claude Desktop. Claude Code uses CLI commands, not JSON configuration files.

#### Quick Installation Steps:

1. **Open a terminal** (outside of Claude Code)
2. **Run the add command** with the MCP server you want:
   ```bash
   # For Playwright (web testing)
   claude mcp add playwright -- npx -y @playwright/mcp@latest
   
   # For XcodeBuildMCP (iOS/macOS development)
   claude mcp add XcodeBuildMCP -- npx -y xcodebuildmcp@latest
   ```
3. **Restart Claude Code** to load the new MCP servers
4. **Verify installation** by running `/mcp` in Claude Code

### Adding MCP Servers to Claude Code

```bash
# Basic syntax for adding a stdio server
claude mcp add <name> -- <command> [args...]

# Examples:
# Add playwright MCP (highly recommended for web testing)
claude mcp add playwright -- npx -y @playwright/mcp@latest

# Add XcodeBuildMCP for macOS development
claude mcp add XcodeBuildMCP -- npx -y xcodebuildmcp@latest

# Add with environment variables
claude mcp add my-server -e API_KEY=value -- /path/to/server

# List all configured servers
claude mcp list

# Remove a server
claude mcp remove <name>
```

### Recommended MCP Servers for This Project

1. **Playwright MCP** - Web testing and browser automation
   - Browser control, screenshots, automated testing
   - Install: `claude mcp add playwright -- npx -y @playwright/mcp@latest`

2. **XcodeBuildMCP** - macOS/iOS development (Mac only)
   - Xcode build, test, project management
   - Install: `claude mcp add XcodeBuildMCP -- npx -y xcodebuildmcp@latest`

3. **Peekaboo MCP** - Visual analysis and screenshots (Mac only)
   - Take screenshots, analyze visual content with AI
   - Install: `claude mcp add peekaboo -- npx -y @steipete/peekaboo-mcp`

4. **macOS Automator MCP** - System automation (Mac only)
   - Control macOS UI, automate system tasks
   - Install: `claude mcp add macos-automator -- npx -y macos-automator-mcp`

5. **RepoPrompt** - Repository context management
   - Generate comprehensive codebase summaries
   - Install: `claude mcp add RepoPrompt -- /path/to/repoprompt_cli`

6. **Zen MCP Server** - Advanced AI reasoning
   - Multi-model consensus, deep analysis, code review
   - Install: See setup instructions in zen-mcp-server repository

### Configuration Scopes

- **local** (default): Project-specific, private to you
- **project**: Shared via `.mcp.json` file in project root
- **user**: Available across all projects

Use `-s` or `--scope` flag to specify scope:
```bash
claude mcp add -s project playwright -- npx -y @playwright/mcp@latest
```

## Alternative Tools for Complex Tasks

### Gemini CLI

For tasks requiring massive context windows (up to 2M tokens) or full codebase analysis:
- Analyze entire repositories with `@` syntax for file inclusion
- Useful for architecture reviews, finding implementations, security audits
- Example: `gemini -p "@src/ @tests/ Is authentication properly implemented?"`
- See `docs/gemini.md` for detailed usage and examples

## Key Files Quick Reference

- Architecture Details: `docs/ARCHITECTURE.md`
- API Specifications: `docs/spec.md`
- Server Implementation Guide: `web/spec.md`
- Build Configuration: `web/package.json`, `mac/Package.swift`
- External Device Testing: `docs/TESTING_EXTERNAL_DEVICES.md`
- Gemini CLI Instructions: `docs/gemini.md`
