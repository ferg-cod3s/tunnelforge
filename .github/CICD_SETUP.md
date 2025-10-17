# TunnelForge CI/CD Setup Guide

*Complete guide to setting up automated builds with code signing for all platforms*

## Overview

This guide walks you through setting up automated, signed builds for TunnelForge desktop apps on Linux, Windows, and macOS using GitHub Actions.

**Current Status:**
- ✅ Build workflows implemented (`build-linux.yml`, `build-macos.yml`, `build-windows.yml`)
- ✅ Desktop release workflow (`desktop-release.yml`)
- 🔐 Awaiting code signing setup

## Quick Start Checklist

### Prerequisites
- [ ] GitHub repository access (admin permissions)
- [ ] Apple Developer Account ($99/year) - **YOU HAVE THIS** ✅
- [ ] Code signing certificates (see [Certificate Options](#certificate-options) below)

### Setup Steps
1. [Generate Tauri update signing keys](#1-tauri-update-signing)
2. [Set up Apple code signing](#2-apple-code-signing-setup)
3. [Choose Windows signing option](#3-windows-code-signing-options)
4. [Configure Linux GPG signing (optional)](#4-linux-gpg-signing-optional)
5. [Add secrets to GitHub](#5-add-secrets-to-github)
6. [Test builds](#6-test-builds)

---

## Certificate Options

### Windows Code Signing - Cost Comparison

| Option | Annual Cost | Best For | Setup Time |
|--------|-------------|----------|------------|
| **Certum Open Source** | **€69 (~$75)** | Open source projects | 1 week |
| SSL.com OV | $249 | Small commercial apps | 3-5 days |
| SignPath (Cloud) | $99/month | Teams with CI/CD focus | 1 day |
| Azure Trusted Signing | Pay-per-use | Microsoft ecosystem | 1 day |

**Recommendation**: Use **Certum Open Source** if TunnelForge qualifies as open source. Saves $174/year vs SSL.com.

### macOS Code Signing

| Item | Cost | Status |
|------|------|--------|
| Apple Developer Program | $99/year | ✅ **YOU HAVE THIS** |
| Developer ID Certificate | Included | Free with membership |
| App Notarization | Included | Free with membership |

**No additional cost needed for macOS!** 🎉

---

## 1. Tauri Update Signing

Generate keys for secure auto-updates:

```bash
# Install Tauri CLI
cargo install tauri-cli@^2.0

# Generate signing keys
cd desktop
bunx tauri signer generate

# Output:
# Public key:   dW50cnVzdGVkIGNvbW1lbnQ... (add to tauri.conf.json)
# Private key:  [long base64 string] (add to TAURI_PRIVATE_KEY secret)
# Password:     [password] (add to TAURI_KEY_PASSWORD secret)
```

**Save the output!** You'll need:
1. Public key → Add to `desktop/src-tauri/tauri.conf.json`:
   ```json
   {
     "bundle": {
       "updater": {
         "active": true,
         "pubkey": "YOUR_PUBLIC_KEY_HERE"
       }
     }
   }
   ```

2. Private key → GitHub secret `TAURI_PRIVATE_KEY`
3. Password → GitHub secret `TAURI_KEY_PASSWORD`

**Docs**: https://v2.tauri.app/distribute/updater/

---

## 2. Apple Code Signing Setup

Since you already have an Apple Developer Account, here's how to set up signing:

### 2.1 Generate Developer ID Certificate

1. **Go to Apple Developer Portal**:
   - Visit https://developer.apple.com/account/resources/certificates/list
   - Click **+** to create new certificate
   - Select **"Developer ID Application"** (for distribution outside Mac App Store)
   - Follow prompts to generate certificate

2. **Download and Install Certificate**:
   - Download certificate file (`developerID_application.cer`)
   - Double-click to install in Keychain Access
   - Verify it appears in **Keychain Access → My Certificates**

### 2.2 Export Certificate for CI/CD

```bash
# In Keychain Access:
# 1. Find "Developer ID Application: Your Name (TEAM_ID)"
# 2. Right-click → Export "Developer ID Application..."
# 3. Save as .p12 format
# 4. Set a strong password (save for GitHub secrets)

# Convert to base64 for GitHub secret
base64 -i ~/Downloads/DeveloperIDApplication.p12 | pbcopy
# Now paste into GitHub secret MACOS_DEVELOPER_CERT
```

### 2.3 Get Apple Credentials

**Team ID**:
```bash
# Option 1: From Developer Portal
# Go to https://developer.apple.com/account
# Click "Membership" → Copy Team ID (10 characters, e.g., ABC1234XYZ)

# Option 2: From Keychain
# Open certificate → Details → Organizational Unit = Team ID
```

**Apple ID**:
- Your Apple Developer Account email (e.g., you@example.com)

**App-Specific Password** (for notarization):
```bash
# 1. Go to https://appleid.apple.com/account/manage
# 2. Sign in with Apple ID
# 3. Security → App-Specific Passwords → Generate
# 4. Name it "TunnelForge CI/CD"
# 5. Copy password (format: xxxx-xxxx-xxxx-xxxx)
```

### 2.4 Required GitHub Secrets for macOS

| Secret Name | Value | How to Get |
|-------------|-------|------------|
| `MACOS_DEVELOPER_CERT` | Base64 .p12 certificate | Export from Keychain (see 2.2) |
| `MACOS_CERT_PASSWORD` | Certificate export password | Password you set in step 2.2 |
| `MACOS_DEVELOPER_ID` | Developer ID name | From certificate common name |
| `MACOS_TEAM_ID` | 10-character team ID | Apple Developer Portal |
| `MACOS_APPLE_ID` | Apple ID email | Your developer account email |
| `MACOS_APP_PASSWORD` | App-specific password | Generated in Apple ID portal |
| `MACOS_KEYCHAIN_PASSWORD` | Any secure password | Choose a random password |

**Docs**: https://v2.tauri.app/distribute/sign/macos/

---

## 3. Windows Code Signing Options

### Option A: Certum Open Source (€69/year) - RECOMMENDED

**Best for**: Open source projects, indie developers

**Setup**:
1. **Apply for certificate**:
   - Visit https://shop.certum.eu/data-safety/code-signing-certificates/certum-open-source-code-signing.html
   - Provide proof of open source status (GitHub repo link, license)
   - Complete verification (1-5 business days)

2. **Receive certificate**:
   - Download certificate as `.pfx` file
   - Convert to base64:
     ```powershell
     [Convert]::ToBase64String([IO.File]::ReadAllBytes("certificate.pfx")) | clip
     ```

3. **Add GitHub secrets**:
   - `WIN_CSC_CONTENT`: Base64-encoded certificate
   - `WIN_CSC_KEY_PASSWORD`: Certificate password

**Pros**: Affordable, full SmartScreen support, WebTrust certified  
**Cons**: Requires open source project verification

### Option B: SignPath Free for Open Source

**Best for**: Open source with CI/CD focus

**Setup**:
1. **Apply for free tier**:
   - Visit https://about.signpath.io/product/open-source
   - Submit open source project application
   - Get approved (typically 2-3 days)

2. **Configure SignPath**:
   - Connect GitHub repository
   - Configure signing policies
   - Get signing endpoint

3. **Add GitHub secret**:
   - `SIGNPATH_API_TOKEN`: From SignPath dashboard

**Pros**: Free for open source, native GitHub integration, no certificate management  
**Cons**: Requires policy setup, approval workflow

### Option C: Azure Trusted Signing (Pay-per-use)

**Best for**: Microsoft ecosystem users

**Setup**:
1. **Enable Azure Trusted Signing**:
   - Go to Azure Portal → Create "Trusted Signing" resource
   - Get signing endpoint and credentials

2. **Add GitHub secrets**:
   - `AZURE_TENANT_ID`: From Azure portal
   - `AZURE_CLIENT_ID`: Service principal ID
   - `AZURE_CLIENT_SECRET`: Service principal secret

**Pros**: No certificate management, Microsoft official, EV compliance  
**Cons**: Requires Azure subscription, ongoing costs

### Option D: Self-Signed (Development Only)

**For testing only - DO NOT distribute to users**

```powershell
# Generate self-signed certificate
$cert = New-SelfSignedCertificate -Type CodeSigningCert `
  -Subject "CN=TunnelForge Development" `
  -KeyAlgorithm RSA `
  -KeyLength 2048 `
  -Provider "Microsoft Enhanced RSA and AES Cryptographic Provider" `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -NotAfter (Get-Date).AddYears(3)

# Export as .pfx
$pwd = ConvertTo-SecureString -String "dev-password" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "dev-cert.pfx" -Password $pwd
```

**Use Case**: Local testing, CI/CD pipeline testing  
**Warning**: Users will see security warnings, SmartScreen blocks

---

## 4. Linux GPG Signing (Optional)

GPG signing adds trust for `.deb` and `.rpm` packages but is **optional**.

### Generate GPG Key

```bash
# Generate key
gpg --full-generate-key
# Choose: RSA and RSA, 4096 bits, no expiration
# Enter name: TunnelForge
# Enter email: dev@tunnelforge.dev

# List keys
gpg --list-secret-keys --keyid-format=long

# Export private key (replace KEY_ID)
gpg --armor --export-secret-keys KEY_ID | base64 | pbcopy

# Export public key
gpg --armor --export KEY_ID > public.asc

# Upload to keyserver
gpg --keyserver keyserver.ubuntu.com --send-keys KEY_ID
```

### Required GitHub Secrets

| Secret Name | Value | How to Get |
|-------------|-------|------------|
| `GPG_PRIVATE_KEY` | Base64 private key | `gpg --armor --export-secret-keys` |
| `GPG_PASSPHRASE` | GPG key passphrase | Set during key generation |
| `GPG_EMAIL` | Email for GPG key | From key generation |
| `GPG_NAME` | Name for GPG key | From key generation |

---

## 5. Add Secrets to GitHub

### Via GitHub Web UI

1. **Go to repository settings**:
   ```
   https://github.com/YOUR_USERNAME/tunnelforge/settings/secrets/actions
   ```

2. **Click "New repository secret"**

3. **Add each secret** from the tables above

### Via GitHub CLI (Faster)

```bash
# Install GitHub CLI
brew install gh  # macOS
# or visit https://cli.github.com/

# Login
gh auth login

# Add secrets
gh secret set TAURI_PRIVATE_KEY < tauri_private_key.txt
gh secret set TAURI_KEY_PASSWORD
# Enter password when prompted

gh secret set MACOS_DEVELOPER_CERT < macos_cert_base64.txt
gh secret set MACOS_CERT_PASSWORD
gh secret set MACOS_TEAM_ID -b "ABC1234XYZ"
gh secret set MACOS_APPLE_ID -b "you@example.com"
gh secret set MACOS_APP_PASSWORD
gh secret set MACOS_DEVELOPER_ID -b "Developer ID Application: Your Name (ABC1234XYZ)"
gh secret set MACOS_KEYCHAIN_PASSWORD

# Windows (choose your signing option)
gh secret set WIN_CSC_CONTENT < windows_cert_base64.txt
gh secret set WIN_CSC_KEY_PASSWORD

# Linux (optional)
gh secret set GPG_PRIVATE_KEY < gpg_private_key_base64.txt
gh secret set GPG_PASSPHRASE
```

### Verify Secrets

```bash
# List all secrets (values are hidden)
gh secret list
```

---

## 6. Test Builds

### Test Unsigned Builds First

```bash
# Trigger build without signing
gh workflow run build-linux.yml -f sign_artifacts=false -f build_type=test
gh workflow run build-macos.yml -f sign_artifacts=false -f build_type=test
gh workflow run build-windows.yml -f sign_artifacts=false -f build_type=test
```

### Test Signed Builds

```bash
# Enable signing
gh workflow run build-linux.yml -f sign_artifacts=true -f build_type=test
gh workflow run build-macos.yml -f sign_artifacts=true -f build_type=test
gh workflow run build-windows.yml -f sign_artifacts=true -f build_type=test
```

### Monitor Build Progress

```bash
# Watch workflow runs
gh run list --workflow=build-macos.yml

# View specific run logs
gh run view RUN_ID --log
```

### Download Test Artifacts

```bash
# Download build artifacts
gh run download RUN_ID

# Test on local machine
# Linux:
sudo dpkg -i tunnelforge-linux-*/tunnelforge_*.deb

# macOS:
open tunnelforge-macos-*/TunnelForge.dmg

# Windows:
# Double-click tunnelforge-windows-*/TunnelForge.msi
```

---

## 7. Production Release

Once testing passes, trigger a production release:

```bash
# Create a version tag
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# This triggers desktop-release.yml workflow
# Which builds all platforms with signing enabled
```

The workflow will:
1. ✅ Build Go server binaries for all platforms
2. ✅ Build Linux packages (DEB, RPM, AppImage)
3. ✅ Build Windows installers (MSI, NSIS)
4. ✅ Build macOS DMG and .app
5. ✅ Sign all artifacts
6. ✅ Create GitHub Release (draft)
7. ✅ Upload all artifacts to release

### Finalize Release

1. Go to https://github.com/YOUR_USERNAME/tunnelforge/releases
2. Find draft release `v1.0.0`
3. Review artifacts and release notes
4. Click **"Publish release"**

---

## Troubleshooting

### macOS Signing Issues

**Error: "No signing identity found"**
```bash
# Check certificate in keychain
security find-identity -v -p codesigning

# If missing, re-import certificate
security import DeveloperIDApplication.p12 -k ~/Library/Keychains/login.keychain-db
```

**Error: "Notarization failed"**
- Verify app-specific password is correct
- Check Team ID matches certificate
- Ensure `MACOS_APPLE_ID` is correct

**Docs**: https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution

### Windows Signing Issues

**Error: "SignTool error: No certificates were found"**
- Verify `WIN_CSC_CONTENT` is base64-encoded correctly
- Check `WIN_CSC_KEY_PASSWORD` is correct
- Ensure certificate hasn't expired

**Error: "SmartScreen warning appears"**
- This is normal for new certificates
- SmartScreen reputation builds over time (typically 2-4 weeks with downloads)
- Consider EV certificate for immediate reputation

**Docs**: https://learn.microsoft.com/en-us/windows/win32/seccrypto/cryptography-tools

### Linux Signing Issues

**Error: "GPG signing failed"**
```bash
# Verify GPG key format
echo "$GPG_PRIVATE_KEY" | base64 -d | gpg --import
# Should show "secret key imported"

# Test signing locally
gpg --armor --detach-sign --default-key YOUR_KEY_ID test.deb
```

### GitHub Actions Issues

**Error: "Secret not found"**
- Check secret name matches exactly (case-sensitive)
- Verify secret is set at repository level (not organization)
- Ensure workflow has permissions to access secrets

**Error: "Workflow timed out"**
- macOS builds can take 20-30 minutes
- Windows builds: 15-25 minutes
- Linux builds: 10-20 minutes
- Increase timeout in workflow if needed

---

## Cost Summary

### Recommended Setup (Open Source)

| Item | Provider | Annual Cost |
|------|----------|-------------|
| Apple Developer Program | Apple | $99 ✅ **YOU HAVE THIS** |
| Windows Code Signing | Certum Open Source | €69 (~$75) |
| Linux GPG Key | Self-generated | Free |
| Tauri Update Signing | Self-generated | Free |
| **Total** | | **~$75/year** |

### Alternative (Commercial)

| Item | Provider | Annual Cost |
|------|----------|-------------|
| Apple Developer Program | Apple | $99 ✅ **YOU HAVE THIS** |
| Windows Code Signing | SSL.com OV | $249 |
| Linux GPG Key | Self-generated | Free |
| **Total** | | **$249/year** |

---

## Next Steps

1. **Choose Windows signing option** (Certum recommended)
2. **Generate Tauri update keys** (30 minutes)
3. **Export Apple certificates** (15 minutes)
4. **Add all secrets to GitHub** (30 minutes)
5. **Test unsigned builds** (wait for CI, ~30 min)
6. **Test signed builds** (wait for CI, ~30 min)
7. **Create v1.0.0 release** 🚀

**Estimated total setup time**: 2-4 hours + certificate approval wait time (1-5 days for Certum)

---

## Resources

- **Tauri Docs**: https://v2.tauri.app/
- **Apple Code Signing**: https://developer.apple.com/support/code-signing/
- **Certum Open Source**: https://shop.certum.eu/code-signing-certificates/
- **SignPath**: https://about.signpath.io/product/open-source
- **GitHub Actions Secrets**: https://docs.github.com/en/actions/security-guides/encrypted-secrets

---

*Last Updated: 2025-01-27*
*For questions: Open an issue at https://github.com/YOUR_USERNAME/tunnelforge/issues*
