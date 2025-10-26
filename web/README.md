# TunnelForge Web UI

Modern web frontend for TunnelForge built with **Astro** and **Svelte 5**.

## Architecture

- **Framework**: Astro 5 (Static Site Generator)
- **UI Components**: Svelte 5 with runes mode (interactive islands)
- **Terminal**: xterm.js with Canvas/WebGL addons
- **Editor**: Monaco Editor
- **Testing**: Playwright E2E tests

## Project Structure

```text
web/
├── public/          # Static assets
├── src/
│   ├── layouts/     # Astro layouts
│   ├── pages/       # Astro pages (routes)
│   ├── lib/
│   │   ├── components/  # Svelte 5 components
│   │   ├── stores/      # Svelte stores
│   │   ├── services/    # API services
│   │   ├── types/       # TypeScript types
│   │   └── utils/       # Utilities
│   └── styles/      # Global styles
├── e2e/             # Playwright tests
└── package.json
```

## Commands

All commands use **Bun** as the package manager:

| Command | Action |
| :--- | :--- |
| `bun install` | Install dependencies |
| `bun run dev` | Start dev server at `localhost:3000` |
| `bun run build` | Build for production to `./dist/` |
| `bun run preview` | Preview production build |
| `bun run test:e2e` | Run E2E tests with Playwright |
| `bun run test:e2e:ui` | Run E2E tests with UI |
| `bun run test:e2e:debug` | Debug E2E tests |

## Development

The web UI connects to the Go server backend running on port 4021:
- API: `http://localhost:4021/api/*`
- WebSocket: `ws://localhost:4021/ws/sessions/:id`

Start both servers for development:
```bash
# Terminal 1: Go server
cd server && make dev

# Terminal 2: Web UI
cd web && bun run dev
```

## Key Features

- **Terminal Sessions**: Interactive xterm.js terminals with WebSocket streaming
- **File Browser**: Browse and manage files with Monaco editor integration
- **Git Integration**: Repository management and worktree support
- **Settings**: Comprehensive settings management with persistence
- **Authentication**: JWT-based auth with guest mode support
- **Responsive**: Mobile-friendly responsive design

## Testing

E2E tests verify critical user flows:
- Session creation and management
- Terminal interaction
- File operations
- Authentication flows

Run tests:
```bash
# All tests
bun run test:e2e

# With browser UI
bun run test:e2e:ui

# Debug mode
bun run test:e2e:debug
```

## Learn More

- [Astro Documentation](https://docs.astro.build)
- [Svelte 5 Documentation](https://svelte.dev/docs/svelte/overview)
- [xterm.js Documentation](https://xtermjs.org/)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/)
