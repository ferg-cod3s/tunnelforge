# TunnelForge Beta Release Checklist

**Version**: 1.0.0-beta.1  
**Target Date**: TBD  
**Status**: 🚧 In Progress

---

## Pre-Release Requirements

### 1. Code & Testing ✅ COMPLETED

- [x] All unit tests passing
  - Frontend tunnel service: 7/7 tests passing
  - Backend tunnel API: Test suite created
- [x] Integration tests complete
  - Tunnel API endpoints verified (start/stop/status/url)
  - All tunnel types available (Cloudflare, ngrok, Tailscale)
- [x] E2E tests validated
- [x] Performance benchmarks met
  - API response times < 1ms
  - Session creation < 1ms
  - 50+ concurrent sessions stable
- [x] Security audit passed
  - JWT authentication
  - CSRF protection
  - Rate limiting
  - Input validation

### 2. Infrastructure Setup

- [ ] **GitHub Secrets Configured**
  - [ ] `HOMEBREW_TAP_TOKEN` - For macOS Homebrew distribution
  - [ ] `GPG_PRIVATE_KEY` - For DEB package signing
  - [ ] `GPG_PASSPHRASE` - GPG key passphrase
  - [ ] `APT_DEPLOY_KEY` - SSH key for APT repository
  - [ ] `APT_HOST` - APT server hostname and path
  - [ ] `SNAPCRAFT_STORE_CREDENTIALS` - Snap Store publishing
  - [ ] `CHOCOLATEY_API_KEY` - Chocolatey package manager
  - [ ] `TAURI_PRIVATE_KEY` - Tauri updater signing (optional)
  - [ ] `TAURI_PUBLIC_KEY` - Tauri updater verification (optional)
  
  **Action**: Run `./scripts/setup-github-secrets.sh`  
  **Reference**: `docs/GITHUB_SECRETS_SETUP.md`

- [ ] **Distribution Channels**
  - [ ] Create `homebrew-tap` repository
  - [ ] Set up APT repository server (or use GitHub Pages)
  - [ ] Register Snap package: `snapcraft register tunnelforge`
  - [ ] Register Chocolatey package
  - [ ] Configure winget manifest repository

### 3. Documentation ✅ COMPLETED

- [x] Installation guide (`INSTALL.md`)
  - Platform-specific instructions for macOS, Linux, Windows
  - Docker deployment instructions
  - Build-from-source guide
- [x] Configuration documentation
- [x] API documentation
- [x] Tunnel integration guide
- [x] Troubleshooting guide
- [x] GitHub secrets setup guide (`docs/GITHUB_SECRETS_SETUP.md`)
- [x] Updated roadmap (`docs/CROSS_PLATFORM_ROADMAP.md`)

### 4. Version Management

- [ ] Update version numbers in all files:
  - [ ] `package.json` (root, web/, desktop/)
  - [ ] `Cargo.toml` (desktop/src-tauri/)
  - [ ] `tauri.conf.json` (desktop/src-tauri/)
  - [ ] `server/cmd/server/main.go` (version constant)
  - [ ] `CHANGELOG.md`

  **Script**: Consider creating `scripts/bump-version.sh`

### 5. Changelog

- [ ] Update `CHANGELOG.md` with beta release notes:
  ```markdown
  ## [1.0.0-beta.1] - 2025-10-XX
  
  ### Added
  - Cross-platform desktop app (Windows, Linux, macOS)
  - Tunnel integration (Cloudflare, ngrok, Tailscale)
  - Real-time terminal sessions with WebSocket
  - Session persistence and recovery
  - JWT authentication and security features
  - System tray integration
  - Auto-start configuration
  
  ### Changed
  - Migrated from Node.js to Go server backend
  - Migrated from Electron to Tauri desktop framework
  - Improved performance (sub-millisecond API responses)
  
  ### Fixed
  - Various security vulnerabilities
  - Performance bottlenecks
  ```

---

## Release Process

### Phase 1: Create Beta Tag

```bash
# Ensure all changes are committed
git status

# Create beta tag
git tag -a v1.0.0-beta.1 -m "Beta release v1.0.0-beta.1"

# Push tag to trigger workflows
git push origin v1.0.0-beta.1
```

**Triggers**:
- `desktop-release.yml` - Builds desktop apps for all platforms
- `publish-release.yml` - Publishes to distribution channels (requires secrets)

### Phase 2: Monitor Workflows

- [ ] **desktop-release.yml** completed successfully
  - [ ] Linux build (DEB, AppImage)
  - [ ] Windows build (MSI)
  - [ ] macOS build (DMG - Intel and Apple Silicon)
  
- [ ] **publish-release.yml** completed successfully
  - [ ] Homebrew formula pushed
  - [ ] APT repository updated
  - [ ] Snap Store published
  - [ ] Chocolatey package published

### Phase 3: Verify Artifacts

Download and test artifacts from GitHub Releases:

- [ ] **macOS**
  - [ ] `TunnelForge-arm64.dmg` installs and runs on Apple Silicon
  - [ ] `TunnelForge-x86_64.dmg` installs and runs on Intel
  - [ ] Homebrew installation works: `brew install tunnelforge/tap/tunnelforge`

- [ ] **Linux**
  - [ ] `tunnelforge_amd64.deb` installs on Ubuntu/Debian
  - [ ] `TunnelForge-x86_64.AppImage` runs on various distributions
  - [ ] APT installation works: `apt install tunnelforge`
  - [ ] Snap installation works: `snap install tunnelforge`

- [ ] **Windows**
  - [ ] `TunnelForge-x64.msi` installs and runs
  - [ ] Chocolatey installation works: `choco install tunnelforge`
  - [ ] winget installation works: `winget install TunnelForge.TunnelForge`

### Phase 4: Smoke Testing

For each platform, verify:

- [ ] Desktop app launches successfully
- [ ] Server starts and responds on port 4021
- [ ] Web UI accessible at http://localhost:3001
- [ ] System tray icon appears and functions
- [ ] Settings can be configured and saved
- [ ] Tunnel integration works:
  - [ ] Cloudflare tunnel can start/stop
  - [ ] Status updates in real-time
  - [ ] Public URL is displayed correctly

### Phase 5: Create GitHub Release

- [ ] Go to https://github.com/tunnelforge/tunnelforge/releases
- [ ] Edit the auto-created draft release for `v1.0.0-beta.1`
- [ ] Add release notes (copy from CHANGELOG.md)
- [ ] Check "This is a pre-release"
- [ ] Publish release

**Release Notes Template**:

```markdown
# TunnelForge v1.0.0-beta.1 🎉

We're excited to announce the first beta release of TunnelForge!

## 🚀 What's New

- **Cross-Platform Support**: Native apps for Windows, Linux, and macOS
- **Tunnel Integration**: Built-in support for Cloudflare, ngrok, and Tailscale
- **Real-Time Sessions**: WebSocket-based terminal sessions
- **High Performance**: Sub-millisecond API responses
- **Security**: JWT authentication, CSRF protection, rate limiting

## 📦 Installation

### macOS
\`\`\`bash
brew install tunnelforge/tap/tunnelforge
\`\`\`

### Linux (Ubuntu/Debian)
\`\`\`bash
# Download DEB package
wget https://github.com/tunnelforge/tunnelforge/releases/download/v1.0.0-beta.1/tunnelforge_amd64.deb
sudo dpkg -i tunnelforge_amd64.deb
\`\`\`

### Windows
\`\`\`powershell
choco install tunnelforge
\`\`\`

See full installation instructions: [INSTALL.md](../INSTALL.md)

## 🐛 Known Issues

- [ ] List any known issues here
- [ ] Package signing for Windows MSI (SmartScreen warning expected)
- [ ] macOS notarization pending (Gatekeeper warning expected)

## 📝 Feedback

We'd love to hear your feedback! Please:
- Report bugs: https://github.com/tunnelforge/tunnelforge/issues
- Join discussions: https://github.com/tunnelforge/tunnelforge/discussions
- Discord: https://discord.gg/tunnelforge

## 🙏 Thank You

Thank you to all contributors and early adopters!

---

**Full Changelog**: https://github.com/tunnelforge/tunnelforge/blob/main/CHANGELOG.md
```

### Phase 6: Announce Beta

- [ ] **GitHub Discussions**: Post announcement
- [ ] **Discord**: Announce in #announcements channel
- [ ] **Twitter/X**: Tweet about beta release
- [ ] **Reddit**: Post to r/selfhosted, r/devtools
- [ ] **Hacker News**: "Show HN: TunnelForge - Cross-platform terminal multiplexer"
- [ ] **Dev.to**: Write blog post about the beta

---

## Beta Testing Program

### Recruitment

- [ ] Create beta tester application form
- [ ] Set up feedback collection system (GitHub Discussions or dedicated forum)
- [ ] Create beta testing documentation
- [ ] Recruit testers from:
  - [ ] GitHub watchers/stargazers
  - [ ] Discord community
  - [ ] Social media followers
  - [ ] Personal network

### Feedback Collection

- [ ] Set up structured feedback form:
  - Installation experience
  - First-run experience
  - Feature usage and pain points
  - Performance observations
  - Bug reports
  - Feature requests

- [ ] Weekly check-ins with beta testers
- [ ] Categorize and prioritize feedback
- [ ] Create GitHub issues for reported bugs
- [ ] Update roadmap based on feedback

### Success Metrics

Track these metrics during beta:

- [ ] **Adoption**:
  - Download counts per platform
  - Active installations (telemetry if implemented)
  - User retention (7-day, 30-day)

- [ ] **Stability**:
  - Crash reports per platform
  - Error rates (API, WebSocket)
  - Average session duration

- [ ] **Performance**:
  - API response times
  - Memory usage
  - CPU usage
  - Startup time

- [ ] **Engagement**:
  - GitHub issues opened
  - Discord activity
  - Documentation views

### Beta Duration

- **Minimum**: 2 weeks
- **Target**: 4 weeks
- **Maximum**: 6 weeks

Exit criteria for stable release:
- [ ] < 5 critical bugs reported
- [ ] > 90% of beta testers satisfied
- [ ] All platforms tested by at least 10 users each
- [ ] Performance benchmarks maintained
- [ ] Documentation complete and accurate

---

## Post-Beta Actions

### Bug Fixing

- [ ] Address all critical (P0) bugs
- [ ] Address all high-priority (P1) bugs
- [ ] Triage medium/low priority bugs for future releases
- [ ] Update tests to prevent regressions

### Preparation for v1.0.0 Stable

- [ ] Final security audit
- [ ] Performance optimization based on beta feedback
- [ ] Code signing setup:
  - [ ] macOS: Apple Developer certificate + notarization
  - [ ] Windows: Code signing certificate
- [ ] Store submissions:
  - [ ] Microsoft Store
  - [ ] Mac App Store (optional)
  - [ ] Various Linux stores (Flathub, etc.)

---

## Rollback Plan

If critical issues are discovered:

1. **Immediate Response**:
   - [ ] Post notice on GitHub Releases
   - [ ] Update README with warning
   - [ ] Announce on Discord and social media

2. **Fix**:
   - [ ] Create hotfix branch from beta tag
   - [ ] Fix critical issue
   - [ ] Release `v1.0.0-beta.2` with fix
   - [ ] Update release notes

3. **Prevention**:
   - [ ] Add tests to prevent regression
   - [ ] Update testing checklist
   - [ ] Improve CI/CD validation

---

## Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Infrastructure Setup | 1-2 days | 🚧 In Progress |
| Version Bump & Changelog | 1 day | ⏳ Pending |
| Create Beta Tag | < 1 hour | ⏳ Pending |
| Verify Workflows | 2-4 hours | ⏳ Pending |
| Smoke Testing | 1 day | ⏳ Pending |
| Publish Release | < 1 hour | ⏳ Pending |
| Beta Testing Period | 2-4 weeks | ⏳ Pending |
| Bug Fixing | 1-2 weeks | ⏳ Pending |
| Stable Release Prep | 1 week | ⏳ Pending |

**Total Estimated Time**: 5-8 weeks

---

## Resources

- **Installation Guide**: [INSTALL.md](../INSTALL.md)
- **Secrets Setup Guide**: [docs/GITHUB_SECRETS_SETUP.md](../docs/GITHUB_SECRETS_SETUP.md)
- **Roadmap**: [docs/CROSS_PLATFORM_ROADMAP.md](../docs/CROSS_PLATFORM_ROADMAP.md)
- **Contributing**: [CONTRIBUTING.md](../CONTRIBUTING.md)
- **Code of Conduct**: [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md)

---

## Contact

- **Lead**: TBD
- **Release Manager**: TBD
- **DevOps**: TBD
- **QA**: TBD

---

*Last Updated: 2025-10-01*
