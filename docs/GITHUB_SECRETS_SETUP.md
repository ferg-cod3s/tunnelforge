# GitHub Secrets Setup Guide

This document provides instructions for setting up the required GitHub secrets for TunnelForge CI/CD pipelines.

## Overview

TunnelForge uses GitHub Actions for automated building, testing, and distribution across multiple platforms. Several workflows require secrets for authentication with package managers and distribution channels.

## Required Secrets

### 1. Homebrew Distribution (macOS)

**Secret Name**: `HOMEBREW_TAP_TOKEN`

**Description**: Personal Access Token for pushing to the Homebrew tap repository

**How to Create**:
1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Name: `TunnelForge Homebrew Tap`
4. Expiration: No expiration (or 1 year if preferred)
5. Scopes required:
   - `repo` (Full control of private repositories)
   - `workflow` (Update GitHub Action workflows)
6. Click "Generate token" and copy the token
7. Add to GitHub repository secrets as `HOMEBREW_TAP_TOKEN`

**Required Repository**: Create a `homebrew-tap` repository in your organization/account

### 2. APT Repository (Debian/Ubuntu)

**Secret Name**: `GPG_PRIVATE_KEY`

**Description**: GPG private key for signing DEB packages

**How to Create**:
```bash
# Generate GPG key
gpg --full-generate-key
# Select: (1) RSA and RSA
# Key size: 4096
# Expiration: 0 (does not expire)
# Real name: TunnelForge Release
# Email: release@tunnelforge.dev

# Export private key (base64 encoded)
gpg --armor --export-secret-keys YOUR_KEY_ID | base64 -w0
```

**Secret Name**: `GPG_PASSPHRASE`

**Description**: Passphrase for the GPG private key

**How to Set**: Copy the passphrase you used when creating the GPG key

---

**Secret Name**: `APT_DEPLOY_KEY`

**Description**: SSH private key for deploying to APT repository server

**How to Create**:
```bash
# Generate SSH key pair
ssh-keygen -t ed25519 -C "tunnelforge-apt-deploy" -f ~/.ssh/tunnelforge-apt

# Copy private key (base64 encoded)
cat ~/.ssh/tunnelforge-apt | base64 -w0

# Add public key to APT server's ~/.ssh/authorized_keys
cat ~/.ssh/tunnelforge-apt.pub
```

**Secret Name**: `APT_HOST`

**Description**: APT repository server hostname and path

**Format**: `username@hostname:/path/to/apt/repo`

**Example**: `deploy@apt.tunnelforge.dev:/var/www/apt`

### 3. Snap Store (Linux)

**Secret Name**: `SNAPCRAFT_STORE_CREDENTIALS`

**Description**: Snapcraft store login credentials

**How to Create**:
```bash
# Install snapcraft
sudo snap install snapcraft --classic

# Login to Snap Store
snapcraft login

# Export credentials
snapcraft export-login --snaps tunnelforge --acls package_access,package_push,package_update,package_release snapcraft-creds.txt

# Copy the content (base64 encoded)
cat snapcraft-creds.txt | base64 -w0
```

**Prerequisites**:
1. Create a Snapcraft developer account at https://snapcraft.io/
2. Register the package name:
   ```bash
   snapcraft register tunnelforge
   ```

### 4. Chocolatey (Windows)

**Secret Name**: `CHOCOLATEY_API_KEY`

**Description**: API key for publishing to Chocolatey repository

**How to Create**:
1. Create account at https://community.chocolatey.org/
2. Go to https://community.chocolatey.org/account
3. Copy your API key
4. Add to GitHub secrets as `CHOCOLATEY_API_KEY`

**Prerequisites**:
- Register package name at https://community.chocolatey.org/packages/upload

### 5. Tauri Updater (Optional)

**Secret Name**: `TAURI_PRIVATE_KEY`

**Description**: Private key for signing Tauri app updates

**How to Create**:
```bash
# Generate key pair using Tauri CLI
bunx @tauri-apps/cli signer generate -w ~/.tauri/tunnelforge.key

# The private key is saved to ~/.tauri/tunnelforge.key
# The public key is printed to console
cat ~/.tauri/tunnelforge.key
```

**Secret Name**: `TAURI_PUBLIC_KEY`

**Description**: Public key for verifying Tauri app updates

**How to Create**: Copy the public key printed when generating the private key above

## Setting Secrets in GitHub

### Via GitHub Web UI

1. Go to repository: `https://github.com/YOUR_ORG/tunnelforge`
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Enter the secret name and value
5. Click **Add secret**

### Via GitHub CLI

```bash
# Install GitHub CLI
# https://cli.github.com/

# Authenticate
gh auth login

# Add secrets
gh secret set HOMEBREW_TAP_TOKEN < token.txt
gh secret set GPG_PRIVATE_KEY < gpg-key.txt
gh secret set GPG_PASSPHRASE --body "your-passphrase"
gh secret set APT_DEPLOY_KEY < apt-deploy-key.txt
gh secret set APT_HOST --body "deploy@apt.tunnelforge.dev:/var/www/apt"
gh secret set SNAPCRAFT_STORE_CREDENTIALS < snapcraft-creds.txt
gh secret set CHOCOLATEY_API_KEY --body "your-api-key"
gh secret set TAURI_PRIVATE_KEY < tauri-private.key
gh secret set TAURI_PUBLIC_KEY --body "your-public-key"
```

## Verification

After setting up secrets, verify they're configured correctly:

```bash
# List all secrets (names only, values are hidden)
gh secret list

# Expected output:
# HOMEBREW_TAP_TOKEN     Updated YYYY-MM-DD
# GPG_PRIVATE_KEY        Updated YYYY-MM-DD
# GPG_PASSPHRASE         Updated YYYY-MM-DD
# APT_DEPLOY_KEY         Updated YYYY-MM-DD
# APT_HOST               Updated YYYY-MM-DD
# SNAPCRAFT_STORE_CREDENTIALS Updated YYYY-MM-DD
# CHOCOLATEY_API_KEY     Updated YYYY-MM-DD
# TAURI_PRIVATE_KEY      Updated YYYY-MM-DD
# TAURI_PUBLIC_KEY       Updated YYYY-MM-DD
```

## Quick Setup Script

For convenience, use the provided setup script:

```bash
./scripts/setup-github-secrets.sh
```

This interactive script will guide you through setting up all required secrets.

## Security Best Practices

1. **Rotate Keys Regularly**: Update keys every 6-12 months
2. **Least Privilege**: Only grant necessary permissions to tokens
3. **Audit Access**: Regularly review which workflows use which secrets
4. **Backup Keys**: Store private keys securely (e.g., password manager)
5. **Monitor Usage**: Check GitHub Actions logs for unauthorized access

## Troubleshooting

### Homebrew Publishing Fails

**Error**: `Permission denied (publickey)`

**Solution**: Verify `HOMEBREW_TAP_TOKEN` has `repo` and `workflow` scopes

### APT Publishing Fails

**Error**: `gpg: signing failed: Inappropriate ioctl for device`

**Solution**: Ensure `GPG_PASSPHRASE` is correct and GPG key is not expired

### Snap Publishing Fails

**Error**: `No valid credentials found`

**Solution**: Re-export Snapcraft credentials and update secret

### Chocolatey Publishing Fails

**Error**: `401 Unauthorized`

**Solution**: Verify API key is valid and has push permissions

## Additional Resources

- [GitHub Actions Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Homebrew Tap Documentation](https://docs.brew.sh/How-to-Create-and-Maintain-a-Tap)
- [Snapcraft Documentation](https://snapcraft.io/docs)
- [Chocolatey Package Creation](https://docs.chocolatey.org/en-us/create/create-packages)
- [Tauri Updater Guide](https://tauri.app/v1/guides/distribution/updater)

## Support

For issues with secret setup, please:
1. Check the troubleshooting section above
2. Search existing GitHub issues
3. Open a new issue with the `ci/cd` label

---

*Last Updated: 2025-10-01*
