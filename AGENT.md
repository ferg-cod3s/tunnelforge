# AGENT.md

## Build/Test Commands
- **Web**: `cd web && pnpm run check` (format, lint, typecheck), `pnpm run dev` (port 4020), `pnpm run test` (Vitest)
- **Mac**: `cd mac && ./scripts/build.sh` (Release), `./scripts/build.sh --configuration Debug`, `./scripts/lint.sh` (SwiftFormat + SwiftLint)
- **Single test**: `cd web && pnpm run test path/to/test.spec.ts` or `xcodebuild test -project VibeTunnel-Mac.xcodeproj -scheme VibeTunnel-Mac`

## Architecture
- **Native macOS** (Swift/SwiftUI) in `mac/` - main app + terminal session management
- **iOS companion** in `ios/` - mobile interface
- **Web stack** in `web/` - TypeScript/LitElement frontend + Node.js/Bun server for terminal sessions
- **Key APIs**: `/api/sessions` (create), `/api/sessions/:id/input` (send), `/api/sessions/:id/stream` (SSE output), `/buffers` (WebSocket binary)
- **Entry points**: `mac/VibeTunnel/VibeTunnelApp.swift`, `web/src/client/app.ts`, `web/src/server/server.ts`

## Code Style
- **TypeScript**: camelCase vars/functions, PascalCase classes/interfaces, UPPER_SNAKE_CASE constants, `.js` imports, JSDoc, singleton exports
- **Swift**: PascalCase types, camelCase properties/methods, `// MARK: -` sections, `@Observable` models, `@MainActor` UI, protocol-oriented design
- **Imports**: System frameworks first (Swift), external libs first (TS), relative paths with `../`, specific imports preferred
- **Error handling**: Try-catch with logging (TS), custom error enums with `LocalizedError` (Swift)
- **No backwards compatibility** - Mac app and web server ship together, change both sides simultaneously
