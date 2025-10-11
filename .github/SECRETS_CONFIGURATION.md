# GitHub Actions Secrets Configuration Guide

This document provides a comprehensive guide to all secrets required for TunnelForge's CI/CD pipelines.

## Table of Contents

- [Code Signing Secrets](#code-signing-secrets)
- [Package Distribution Secrets](#package-distribution-secrets)
- [Integration Secrets](#integration-secrets)
- [Setup Instructions](#setup-instructions)

---

## Code Signing Secrets

### Tauri Update Signing

**Required for**: Desktop app auto-updates

| Secret Name | Description | How to Generate |
|------------|-------------|-----------------|
| `TAURI_PRIVATE_KEY` | Private key for signing Tauri updates | Run `tauri signer generate` |
| `TAURI_KEY_PASSWORD` | Password for the Tauri private key | Set when generating the key |

**Setup:**
```bash
# Install Tauri CLI
cargo install tauri-cli

# Generate signing keys
tauri signer generate

# This outputs:
# - Public key (add to tauri.conf.json)
# - Private key (add to TAURI_PRIVATE_KEY secret)
# - Password (add to TAURI_KEY_PASSWORD secret)
```

**Documentation**: https://tauri.app/v1/guides/distribution/updater/

---

### macOS Code Signing

**Required for**: macOS app notarization and distribution

| Secret Name | Description | How to Generate |
|------------|-------------|-----------------|
| `MACOS_DEVELOPER_CERT` | Base64-encoded .p12 certificate | Export from Keychain Access |
| `MACOS_CERT_PASSWORD` | Password for .p12 certificate | Set during certificate export |
| `MACOS_DEVELOPER_ID` | Apple Developer ID | Found in Apple Developer Portal |
| `MACOS_TEAM_ID` | Apple Team ID | Found in Apple Developer Portal |
| `MACOS_KEYCHAIN_PASSWORD` | Password for temporary keychain | Any secure password |

**Setup:**

1. **Export Certificate:**
   ```bash
   # In Keychain Access:
   # 1. Find "Developer ID Application" certificate
   # 2. Right-click → Export
   # 3. Save as .p12 with password
   
   # Convert to base64
   base64 -i DeveloperIDApplication.p12 | pbcopy
   # Paste into MACOS_DEVELOPER_CERT secret
   ```

2. **Find Team ID:**
   - Go to https://developer.apple.com/account
   - Click "Membership" → Copy Team ID

3. **Find Developer ID:**
   - Open Keychain Access
   - Find certificate → Common Name is Developer ID

**Documentation**: 
- https://developer.apple.com/support/code-signing/
- https://tauri.app/v1/guides/building/macos/

---

### Windows Code Signing

**Required for**: Windows .exe and .msi signing

| Secret Name | Description | How to Generate |
|------------|-------------|-----------------|
| `WIN_CSC_CONTENT` | Base64-encoded .pfx certificate | Purchase from CA (DigiCert, etc.) |
| `WIN_CSC_KEY_PASSWORD` | Password for .pfx certificate | Set when purchasing certificate |

**Setup:**

1. **Purchase Certificate:**
   - Buy code signing certificate from DigiCert, Sectigo, etc.
   - Download as .pfx file

2. **Encode Certificate:**
   ```powershell
   # Windows PowerShell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("certificate.pfx")) | clip
   # Paste into WIN_CSC_CONTENT secret
   ```

**Documentation**: 
- https://learn.microsoft.com/en-us/windows/win32/seccrypto/cryptography-tools
- https://tauri.app/v1/guides/building/windows/

---

### GPG Signing (Linux Packages)

**Required for**: Signing .deb and .rpm packages

| Secret Name | Description | How to Generate |
|------------|-------------|-----------------|
| `GPG_PRIVATE_KEY` | Base64-encoded private key | `gpg --armor --export-secret-keys` |
| `GPG_PASSPHRASE` | Passphrase for GPG key | Set when generating key |
| `GPG_EMAIL` | Email associated with key | Your email address |
| `GPG_NAME` | Name associated with key | Your name or org name |

**Setup:**

1. **Generate Key:**
   ```bash
   # Generate GPG key
   gpg --full-generate-key
   # Choose: RSA and RSA, 4096 bits, no expiration
   # Enter name, email, and passphrase
   
   # List keys to find key ID
   gpg --list-secret-keys --keyid-format=long
   
   # Export private key (replace KEY_ID)
   gpg --armor --export-secret-keys KEY_ID | base64 | pbcopy
   # Paste into GPG_PRIVATE_KEY secret
   ```

2. **Publish Public Key:**
   ```bash
   # Export public key
   gpg --armor --export KEY_ID > public.asc
   
   # Upload to keyserver
   gpg --keyserver keyserver.ubuntu.com --send-keys KEY_ID
   ```

**Documentation**: https://www.gnupg.org/gph/en/manual.html

---

## Package Distribution Secrets

### Homebrew (macOS Package Manager)

**Required for**: Publishing to Homebrew tap

| Secret Name | Description | How to Generate |
|------------|-------------|-----------------|
| `HOMEBREW_TAP_TOKEN` | GitHub PAT for homebrew-tap repo | GitHub Settings → Developer settings |

**Setup:**

1. **Create GitHub Token:**
   - Go to https://github.com/settings/tokens
   - Click "Generate new token (classic)"
   - Scopes needed: `repo`, `workflow`
   - Generate and copy token

2. **Create Homebrew Tap Repository:**
   ```bash
   # Create repo: homebrew-tunnelforge
   # Add formula file
   # Use token to push updates
   ```

**Documentation**: https://docs.brew.sh/How-to-Create-and-Maintain-a-Tap

---

### APT Repository (Debian/Ubuntu)

**Required for**: Publishing .deb packages

| Secret Name | Description | How to Generate |
|------------|-------------|-----------------|
| `APT_DEPLOY_KEY` | SSH private key for APT server | `ssh-keygen -t ed25519` |
| `APT_HOST` | Hostname/IP of APT server | Your server address |

**Setup:**

1. **Generate SSH Key:**
   ```bash
   ssh-keygen -t ed25519 -C "apt-deploy@tunnelforge"
   # Copy private key to APT_DEPLOY_KEY secret
   # Add public key to APT server's ~/.ssh/authorized_keys
   ```

2. **Set Up APT Repository:**
   ```bash
   # On your server, set up apt-ftparchive or similar
   # Configure nginx/apache to serve the repository
   ```

**Documentation**: https://wiki.debian.org/DebianRepository/SetupWithReprepro

---

### Snap Store

**Required for**: Publishing to Snap Store

| Secret Name | Description | How to Generate |
|------------|-------------|-----------------|
| `SNAPCRAFT_STORE_CREDENTIALS` | Base64-encoded credentials | `snapcraft export-login` |

**Setup:**

1. **Create Snapcraft Account:**
   - Register at https://snapcraft.io/

2. **Export Credentials:**
   ```bash
   # Login to Snapcraft
   snapcraft login
   
   # Export credentials
   snapcraft export-login snapcraft.login
   
   # Base64 encode
   base64 snapcraft.login | pbcopy
   # Paste into SNAPCRAFT_STORE_CREDENTIALS secret
   ```

**Documentation**: https://snapcraft.io/docs/snapcraft-authentication

---

## Integration Secrets

### Slack Notifications

**Required for**: CI/CD notifications to Slack

| Secret Name | Description | How to Generate |
|------------|-------------|-----------------|
| `SLACK_WEBHOOK_URL` | Incoming webhook URL | Slack App settings |

**Setup:**

1. **Create Slack App:**
   - Go to https://api.slack.com/apps
   - Create new app → "From scratch"
   - Enable "Incoming Webhooks"
   - Add to workspace
   - Copy webhook URL

**Documentation**: https://api.slack.com/messaging/webhooks

---

### Discord Notifications

**Required for**: CI/CD notifications to Discord

| Secret Name | Description | How to Generate |
|------------|-------------|-----------------|
| `DISCORD_WEBHOOK_URL` | Discord webhook URL | Server Settings → Integrations |

**Setup:**

1. **Create Webhook:**
   - Go to Discord Server Settings
   - Click "Integrations" → "Webhooks"
   - Click "New Webhook"
   - Copy webhook URL

**Documentation**: https://support.discord.com/hc/en-us/articles/228383668

---

### Claude Code (AI Code Review)

**Required for**: AI-powered code reviews

| Secret Name | Description | How to Generate |
|------------|-------------|-----------------|
| `CLAUDE_CODE_OAUTH_TOKEN` | OAuth token for Claude API | Anthropic Console |

**Setup:**

1. **Get API Key:**
   - Go to https://console.anthropic.com/
   - Navigate to API Keys
   - Create new key
   - Copy and save securely

**Documentation**: https://docs.anthropic.com/

---

### Gemini AI

**Required for**: AI features and analysis

| Secret Name | Description | How to Generate |
|------------|-------------|-----------------|
| `GEMINI_API_KEY` | Google AI API key | Google AI Studio |

**Setup:**

1. **Get API Key:**
   - Go to https://aistudio.google.com/
   - Click "Get API key"
   - Create new key
   - Copy and save securely

**Documentation**: https://ai.google.dev/

---

## Setup Instructions

### Adding Secrets to GitHub

1. **Organization Secrets (Recommended for multiple repos):**
   ```
   GitHub Organization → Settings → Secrets and variables → Actions → New organization secret
   ```

2. **Repository Secrets:**
   ```
   Repository → Settings → Secrets and variables → Actions → New repository secret
   ```

### Environment Secrets

For production releases, consider using GitHub Environments:

```
Repository → Settings → Environments → New environment
```

Environments allow:
- Required reviewers before deployment
- Wait timer (e.g., 5 minutes after approval)
- Branch restrictions
- Environment-specific secrets

---

## Testing Secrets

### Local Testing

**NEVER** test with production secrets locally. Instead:

1. **Generate Test Certificates:**
   ```bash
   # For macOS testing
   security create-keychain -p test test.keychain
   
   # For Windows testing
   makecert -r -pe -n "CN=Test Cert" -ss My
   
   # For GPG testing
   gpg --quick-generate-key test@example.com
   ```

2. **Use Self-Signed Certificates:**
   - Self-signed certs work for testing builds
   - They won't pass OS security checks
   - Users will see warnings

### CI Testing

Use GitHub Actions environments with separate test secrets:

```yaml
environment:
  name: staging
  url: https://staging.tunnelforge.sh
```

---

## Security Best Practices

### ✅ DO

- Store all secrets in GitHub Secrets (encrypted at rest)
- Use organization secrets for shared credentials
- Rotate secrets regularly (every 90 days)
- Use environment-specific secrets for prod/staging
- Enable 2FA on all service accounts
- Use minimal required permissions
- Document secret ownership and renewal dates

### ❌ DON'T

- Commit secrets to git (use `.gitignore`)
- Share secrets via email/chat
- Use same secrets for dev/staging/prod
- Give secrets to untrusted third parties
- Log secrets in workflow outputs
- Store secrets in workflow files

### Secret Scanning

GitHub automatically scans for leaked secrets. Configure additional protection:

```
Repository → Settings → Code security and analysis → Secret scanning
```

---

## Troubleshooting

### Common Issues

**"Invalid certificate format"**
- Ensure certificate is base64 encoded
- Check for line breaks or extra characters

**"Authentication failed"**
- Verify secret name matches exactly (case-sensitive)
- Check token hasn't expired
- Ensure token has required permissions

**"Keychain unlock failed" (macOS)**
- Verify `MACOS_KEYCHAIN_PASSWORD` is set
- Check certificate matches Developer ID

**"GPG signing failed"**
- Ensure private key includes `-----BEGIN PGP PRIVATE KEY BLOCK-----`
- Verify passphrase is correct
- Check key hasn't expired

---

## Maintenance Schedule

| Secret Type | Rotation Period | Owner |
|------------|----------------|-------|
| Code Signing Certs | 1-3 years | DevOps Team |
| API Keys | 90 days | Engineering Lead |
| SSH Keys | 180 days | Infrastructure Team |
| Webhook URLs | As needed | DevOps Team |
| GPG Keys | Never (revoke if compromised) | Security Team |

---

## Support

For questions about secret configuration:

1. Check this documentation
2. Review workflow files in `.github/workflows/`
3. Consult platform-specific documentation
4. Open an issue: https://github.com/ferg-cod3s/tunnelforge/issues

---

*Last Updated: 2025-01-27*
