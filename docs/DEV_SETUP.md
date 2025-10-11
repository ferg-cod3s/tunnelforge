# TunnelForge Development Setup

Quick guide for running TunnelForge in development mode.

## Quick Start

### Option 1: Run Everything (Recommended)

Start both the Go backend server and Bun web frontend/proxy in one command:

```bash
# From project root
./scripts/dev-full.sh

# Or from web directory
cd web && bun run dev:full
```

This will:
1. ✅ Load environment from `.env.development`
2. ✅ Start Go server on port 4021
3. ✅ Start Bun web server on port 3001
4. ✅ Wait for both servers to be ready
5. ✅ Display access URLs

**Access Points:**
- 🌐 **Web Interface**: http://localhost:3001
- 📡 **Go API**: http://localhost:4021
- 📊 **Sentry**: https://sentry.fergify.work

Press `Ctrl+C` to stop all servers.

### Option 2: Run Servers Separately

#### Go Server Only
```bash
cd server
make dev              # With air (hot reload)
make dev-simple       # Direct go run
```

#### Bun Web Server Only
```bash
cd web
bun run dev:bun      # Bun server with hot reload
bun run start:bun    # Bun server (no hot reload)
```

## Environment Configuration

The development environment is configured via `.env.development` in the project root:

- **Go Server Port**: `4021`
- **Bun Server Port**: `3001`
- **Sentry DSN**: Configured for error tracking
- **Authentication**: Disabled for development
- **Debug Mode**: Enabled

## Port Reference

| Service | Port | Purpose |
|---------|------|---------|
| Go Server | 4021 | Backend API and WebSocket |
| Bun Server | 3001 | Frontend + API proxy |
| VibeTunnel (legacy) | 4020 | Old npm package (not used) |

## Common Issues

### Port Already in Use
```bash
# Check what's using the port
lsof -i :4021
lsof -i :3001

# Kill the process
lsof -ti:4021 | xargs kill
lsof -ti:3001 | xargs kill
```

### Go Server Not Starting
```bash
cd server
go mod tidy
make clean
make dev
```

### Bun Server Errors
```bash
cd web
bun install
bun run dev:bun
```

## Monitoring

### View Sentry Errors
- Web UI: https://sentry.fergify.work
- Projects:
  - `tunnelforge-webserver` - Bun server errors
  - `tunnelforge-web` - Frontend errors
  - `go` - Go server errors

### View Logs
```bash
# Go server logs
cd server && go run cmd/server/main.go

# Bun server logs
cd web && bun run dev:bun
```

## Development Workflow

1. **Start servers**: `./scripts/dev-full.sh`
2. **Make changes**: Edit TypeScript/Go files
3. **See changes**: Both servers have hot reload enabled
4. **Check errors**: View in Sentry or console
5. **Stop servers**: Press `Ctrl+C`

## Testing

### Run Tests
```bash
# Go server tests
cd server && make test

# Web tests (only when requested)
cd web && bun run test
```

### Code Quality Checks
```bash
cd web

# Run all checks
bun run check

# Auto-fix issues
bun run check:fix
```

## Next Steps

- See [ARCHITECTURE.md](ARCHITECTURE.md) for system design
- See [API.md](API.md) for API documentation
- See [DEBUGGING_SESSIONS.md](DEBUGGING_SESSIONS.md) for debugging tips
