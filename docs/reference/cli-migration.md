# CLI Command Migration: vt → tf

**Last Updated**: 2025-09-29
**Status**: Migration Complete

## Overview

TunnelForge transitioned from the `vt` command to `tf` as the primary CLI interface in September 2025. This document provides guidance for users migrating from the legacy command.

## Current Recommendation

**Use `tf` for all new work:**

```bash
tf <command>              # Run command in TunnelForge session
tf title "Project Name"   # Update session title (inside session)
tf follow                 # Enable git worktree follow mode
tf follow main            # Switch to main branch and enable follow
tf unfollow              # Disable follow mode
tf status                # Check server status
tf --help                # Show comprehensive help
```

## Quick Reference

| Task | Command | Description |
|------|---------|-------------|
| Run command | `tf npm run dev` | Execute command with TunnelForge monitoring |
| Update title | `tf title "My Project"` | Change session title (inside session only) |
| Check status | `tf status` | View server status and follow mode state |
| Enable follow | `tf follow` | Track current branch's worktree |
| Disable follow | `tf unfollow` | Stop worktree tracking |
| Git integration | `tf git event` | Notify TunnelForge of Git changes (for hooks) |
| Launch shell | `tf --shell` or `tf -i` | Start interactive shell session |

## Legacy Compatibility

The `vt` command remains available as a **legacy alias** for backward compatibility with existing scripts and workflows. However:

- ✅ **All documentation** has been updated to use `tf`
- ✅ **All examples** show the `tf` command
- ✅ **New users** should learn and use `tf` exclusively
- ⚠️ **Legacy scripts** can continue using `vt` but should migrate when possible

### Migration Path

If you have existing scripts using `vt`, you can:

1. **Simple replacement**: Replace `vt` with `tf` in your scripts
   ```bash
   # Before
   vt npm test

   # After
   tf npm test
   ```

2. **Gradual migration**: Both commands work identically, migrate at your own pace

3. **No action required**: `vt` continues to work for backward compatibility

## Command Comparison

Both commands have **identical functionality**:

```bash
# These are equivalent:
vt title "Project Name"    ≡    tf title "Project Name"
vt status                  ≡    tf status
vt follow main             ≡    tf follow main
vt --help                  ≡    tf --help
```

## Why the Change?

The transition from `vt` to `tf` was made for several reasons:

1. **Branding Alignment**: `tf` aligns with the **TunnelForge** product name
2. **Clarity**: Single authoritative command reduces confusion
3. **Brevity**: `tf` is shorter and easier to type
4. **Convention**: Follows CLI naming conventions (e.g., `gh` for GitHub, `gcloud` for Google Cloud)

## Migration Timeline

- **2025-09-29**: Primary conversion complete, documentation updated
- **Ongoing**: `vt` remains available as legacy alias
- **Future**: No deprecation planned - both commands will continue to work

## Implementation Details

### Technical Architecture

Both `tf` and `vt` are implemented as bash wrapper scripts that:
- Detect and use the appropriate TunnelForge installation (Mac app or npm package)
- Forward commands to the underlying `tunnelforge` binary
- Provide consistent behavior across all platforms

### Script Locations

- Primary: `web/bin/tf` (639 lines, full-featured wrapper)
- Alternative: `web/bin/tunnelforge` (205 lines, simplified wrapper)
- Legacy: `vt` command (maintained for compatibility)

### Mac App Integration

On macOS, the wrapper scripts automatically:
- Search for TunnelForge.app in standard locations
- Check development builds in Xcode DerivedData
- Fall back to npm installation if app not found
- Use the app's embedded binary when available

## Getting Help

### Command Help
```bash
tf --help                  # Show comprehensive help
tf status                  # Check if server is running
```

### Additional Resources

- **Quick Start Guide**: `docs/guides/quickstart.md`
- **Development Guide**: `docs/guides/development.md`
- **Architecture Documentation**: `docs/ARCHITECTURE.md`
- **Project Instructions**: `CLAUDE.md`

## Frequently Asked Questions

### Will `vt` stop working?

No. The `vt` command will continue to work indefinitely as a legacy alias. There are no plans to remove it.

### Do I need to update my scripts?

Not immediately. Existing scripts using `vt` will continue to work. However, we recommend migrating to `tf` when convenient for consistency with current documentation.

### What if I prefer `vt`?

You can continue using `vt` - it's functionally identical to `tf`. However, all examples and documentation now use `tf`, so learning the new command will make following guides easier.

### Can I use both commands?

Yes! Both `tf` and `vt` work identically. You can use them interchangeably, though consistency is recommended for clarity.

### Is this related to the VibeTunnel → TunnelForge rename?

Yes, the CLI command change is part of the broader rebranding from VibeTunnel to TunnelForge. The new name better reflects the product's capabilities and is more memorable.

## Related Documentation

- **Branding Guidelines**: `CLAUDE.md` (Section: "Branding and CLI naming")
- **Architecture Overview**: `docs/ARCHITECTURE.md`
- **Release History**: `CHANGELOG.md`
- **Cross-Platform Roadmap**: `docs/CROSS_PLATFORM_ROADMAP.md`

---

*For questions or issues, please file an issue on GitHub or contact the TunnelForge team.*