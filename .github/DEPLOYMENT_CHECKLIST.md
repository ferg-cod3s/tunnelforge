# GitHub Actions Production Deployment Checklist

Quick reference checklist for deploying TunnelForge CI/CD to production.

## Pre-Deployment Checklist

### 1. Code Signing Setup

#### macOS (Required for App Store & Notarization)
- [ ] Purchase Apple Developer Account ($99/year)
- [ ] Generate Developer ID Application certificate
- [ ] Export certificate as .p12 with password
- [ ] Add `MACOS_DEVELOPER_CERT` (base64 of .p12)
- [ ] Add `MACOS_CERT_PASSWORD`
- [ ] Add `MACOS_DEVELOPER_ID`
- [ ] Add `MACOS_TEAM_ID`
- [ ] Add `MACOS_KEYCHAIN_PASSWORD`
- [ ] Test signing with: `.github/workflows/code-signing.yml`

#### Windows (Required for SmartScreen Trust)
- [ ] Purchase Code Signing Certificate ($200-400/year)
  - Recommended: DigiCert, Sectigo, SSL.com
- [ ] Download certificate as .pfx
- [ ] Add `WIN_CSC_CONTENT` (base64 of .pfx)
- [ ] Add `WIN_CSC_KEY_PASSWORD`
- [ ] Test signing with: `.github/workflows/build-windows.yml`

#### Linux (Required for Package Repository Trust)
- [ ] Generate GPG key pair
- [ ] Upload public key to keyservers
- [ ] Add `GPG_PRIVATE_KEY` (base64 of private key)
- [ ] Add `GPG_PASSPHRASE`
- [ ] Add `GPG_EMAIL`
- [ ] Add `GPG_NAME`
- [ ] Test signing with: `.github/workflows/build-linux.yml`

#### Tauri Auto-Updates (All Platforms)
- [ ] Run `tauri signer generate`
- [ ] Add public key to `tauri.conf.json`
- [ ] Add `TAURI_PRIVATE_KEY`
- [ ] Add `TAURI_KEY_PASSWORD`

---

### 2. Package Distribution Setup

#### Homebrew (macOS)
- [ ] Create `homebrew-tunnelforge` repository
- [ ] Generate GitHub PAT with `repo`, `workflow` scopes
- [ ] Add `HOMEBREW_TAP_TOKEN`
- [ ] Test with: `.github/workflows/publish-release.yml`

#### APT Repository (Debian/Ubuntu)
- [ ] Set up APT repository server
- [ ] Configure nginx/apache for hosting
- [ ] Generate SSH deploy key
- [ ] Add `APT_DEPLOY_KEY`
- [ ] Add `APT_HOST`
- [ ] Test with: `.github/workflows/publish-release.yml`

#### Snap Store (Linux)
- [ ] Register at https://snapcraft.io/
- [ ] Reserve app name: `tunnelforge`
- [ ] Run `snapcraft export-login`
- [ ] Add `SNAPCRAFT_STORE_CREDENTIALS` (base64)
- [ ] Test with: `.github/workflows/publish-release.yml`

#### Chocolatey (Windows)
- [ ] Register at https://community.chocolatey.org/
- [ ] Reserve package name: `tunnelforge`
- [ ] Generate API key
- [ ] Add `CHOCOLATEY_API_KEY`
- [ ] Test with: `.github/workflows/publish-release.yml`

#### winget (Windows)
- [ ] Fork https://github.com/microsoft/winget-pkgs
- [ ] No secrets required (PR-based submission)

---

### 3. Integration Setup (Optional but Recommended)

#### Slack Notifications
- [ ] Create Slack workspace or use existing
- [ ] Create Slack App with Incoming Webhooks
- [ ] Add `SLACK_WEBHOOK_URL`
- [ ] Test with: `.github/workflows/slack-notify.yml`

#### Discord Notifications
- [ ] Create Discord server or use existing
- [ ] Create webhook in Server Settings → Integrations
- [ ] Add `DISCORD_WEBHOOK_URL`
- [ ] Test with: `.github/workflows/slack-notify.yml`

---

## Deployment Steps

### Step 1: Verify Workflows Are Updated

```bash
# Run the upgrade script (already completed)
.github/scripts/upgrade-actions.sh

# Verify no old versions remain
grep -r "upload-artifact@v3" .github/workflows/
grep -r "download-artifact@v3" .github/workflows/
grep -r "cache@v3" .github/workflows/
grep -r "setup-bun@v1" .github/workflows/

# All should return no results
```

### Step 2: Add Secrets to GitHub

**Organization Secrets (Recommended):**
```
https://github.com/organizations/YOUR_ORG/settings/secrets/actions
```

**Repository Secrets:**
```
https://github.com/ferg-cod3s/tunnelforge/settings/secrets/actions
```

**Priority Order:**
1. Code signing secrets (required for releases)
2. Tauri signing (required for auto-updates)
3. Package distribution (required for publishing)
4. Integrations (optional, for notifications)

### Step 3: Test Each Workflow

Run workflows manually to verify secrets work:

```bash
# Test code signing
gh workflow run code-signing.yml

# Test Linux build
gh workflow run build-linux.yml

# Test Windows build  
gh workflow run build-windows.yml

# Test macOS build
gh workflow run build-macos.yml

# Test full release (don't publish yet)
gh workflow run desktop-release.yml
```

### Step 4: Create Test Release

Create a test tag to trigger full release workflow:

```bash
git tag v0.0.1-test
git push origin v0.0.1-test

# Monitor workflow
gh run watch

# If successful, delete test release
gh release delete v0.0.1-test --yes
git tag -d v0.0.1-test
git push origin :refs/tags/v0.0.1-test
```

### Step 5: Production Release

When everything works:

```bash
# Update version in all files
./scripts/sync-versions.js 1.0.0

# Commit and tag
git add .
git commit -m "Release v1.0.0"
git tag v1.0.0
git push origin main --tags

# Monitor release
gh run watch
```

---

## Post-Deployment Verification

### Verify Builds

- [ ] macOS DMG is signed and notarized
  ```bash
  spctl -a -vvv -t install TunnelForge.dmg
  # Should say: accepted
  ```

- [ ] Windows EXE is signed
  ```powershell
  Get-AuthenticodeSignature TunnelForge-Setup.exe
  # Should show valid signature
  ```

- [ ] Linux packages are signed
  ```bash
  # DEB signature
  dpkg-sig --verify tunnelforge_1.0.0_amd64.deb
  
  # RPM signature
  rpm --checksig tunnelforge-1.0.0-1.x86_64.rpm
  ```

### Verify Distribution

- [ ] Homebrew tap updated
  ```bash
  brew tap ferg-cod3s/tunnelforge
  brew info tunnelforge
  ```

- [ ] APT repository accessible
  ```bash
  curl -fsSL https://apt.tunnelforge.sh/public.key | gpg --dearmor
  ```

- [ ] Snap Store listing live
  ```bash
  snap info tunnelforge
  ```

- [ ] Chocolatey package published
  ```powershell
  choco search tunnelforge
  ```

- [ ] winget package submitted
  ```powershell
  winget search tunnelforge
  ```

### Verify Auto-Updates

- [ ] Tauri updater JSON is accessible
  ```bash
  curl https://github.com/ferg-cod3s/tunnelforge/releases/latest/download/latest.json
  ```

- [ ] Update signatures are valid
  ```bash
  # Check signature in latest.json
  ```

---

## Troubleshooting

### Workflow Fails: "Secret not found"

**Solution:**
1. Verify secret name matches exactly (case-sensitive)
2. Check secret is added to correct organization/repository
3. Ensure workflow has access to organization secrets

### macOS: "Keychain unlock failed"

**Solution:**
```yaml
# Ensure this step exists in workflow
- name: Create Keychain
  run: |
    security create-keychain -p "${{ secrets.MACOS_KEYCHAIN_PASSWORD }}" build.keychain
    security default-keychain -s build.keychain
    security unlock-keychain -p "${{ secrets.MACOS_KEYCHAIN_PASSWORD }}" build.keychain
```

### Windows: "Certificate not trusted"

**Solution:**
- Wait 24-48 hours after first signing
- Microsoft SmartScreen builds reputation over time
- Submit binary to Microsoft for analysis: https://www.microsoft.com/wdsi/filesubmission

### Linux: "GPG signature verification failed"

**Solution:**
```bash
# Ensure public key is uploaded to keyservers
gpg --keyserver keyserver.ubuntu.com --send-keys YOUR_KEY_ID

# Users need to import key
curl -fsSL https://apt.tunnelforge.sh/public.key | gpg --dearmor | sudo tee /usr/share/keyrings/tunnelforge.gpg
```

### Artifact Upload/Download Fails

**Solution:**
- `upload-artifact@v4` and `download-artifact@v4` have breaking changes
- Download now goes to `artifacts/` directory by default
- Use `path:` parameter to specify location
- Use `merge-multiple: true` to flatten structure

Example:
```yaml
- name: Download artifacts
  uses: actions/download-artifact@v4
  with:
    path: artifacts/
    merge-multiple: true
```

---

## Security Considerations

### Before Going Live

- [ ] All secrets are stored in GitHub Secrets (never in code)
- [ ] Organization secrets are used for shared credentials
- [ ] Environment protection rules are enabled for `production`
- [ ] Branch protection rules require PR reviews
- [ ] Secret scanning is enabled
- [ ] Dependabot is enabled
- [ ] Code scanning (CodeQL) is enabled

### Secret Rotation Schedule

Add to calendar:
- Code signing certificates: Check expiration yearly
- API keys: Rotate every 90 days
- SSH keys: Rotate every 180 days
- Webhook URLs: Update as needed
- GPG keys: Never expire (revoke if compromised)

---

## Monitoring

### Set Up Monitoring

1. **GitHub Actions Metrics:**
   - Workflow run times
   - Failure rates
   - Artifact sizes

2. **Slack/Discord Alerts:**
   - Build failures
   - Deployment successes
   - Security vulnerabilities

3. **Download Metrics:**
   - GitHub release downloads
   - Package manager installs
   - Auto-update usage

### Key Metrics to Track

- [ ] Average build time per platform
- [ ] Build success rate
- [ ] Release frequency
- [ ] Download counts by platform
- [ ] Update adoption rate
- [ ] Security vulnerabilities found/fixed

---

## Rollback Plan

If a release has critical issues:

```bash
# 1. Mark release as draft (hide from users)
gh release edit v1.0.0 --draft

# 2. Stop auto-updates
# Edit latest.json to point to previous version

# 3. Revert package manager releases
# Homebrew: Update formula to previous version
# APT/Snap: Publish fixed version with higher version number
# Chocolatey: Unlist package version

# 4. Communicate issue
# Post on Discord/Slack
# Update GitHub release notes
# Tweet/blog post if widely distributed

# 5. Fix and re-release
# Fix issue in code
# Bump version to v1.0.1
# Re-run release workflow
```

---

## Support Resources

- **GitHub Actions Documentation**: https://docs.github.com/en/actions
- **Secrets Configuration Guide**: `.github/SECRETS_CONFIGURATION.md`
- **Workflow Files**: `.github/workflows/`
- **Issue Tracker**: https://github.com/ferg-cod3s/tunnelforge/issues

---

## Quick Commands

```bash
# List all workflows
gh workflow list

# Run workflow manually
gh workflow run WORKFLOW_NAME

# Watch workflow run
gh run watch

# List recent runs
gh run list --limit 10

# View workflow logs
gh run view RUN_ID --log

# List secrets (names only)
gh secret list

# Add secret
gh secret set SECRET_NAME

# Delete secret
gh secret delete SECRET_NAME
```

---

## Status: Current Implementation

✅ **Completed:**
- All workflows upgraded to latest action versions
- Cross-platform shell scripts fixed
- Artifact management standardized
- Bun versions pinned

⚠️ **Pending:**
- Secrets configuration (see checklist above)
- Production signing certificates
- Package repository setup
- End-to-end testing with real secrets

📋 **Next Steps:**
1. Acquire code signing certificates
2. Set up package repositories
3. Add all secrets to GitHub
4. Run test release
5. Monitor and iterate

---

*Last Updated: 2025-01-27*
