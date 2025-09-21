# Code Signing Setup Guide

This guide explains how to set up code signing certificates for TunnelForge's cross-platform releases.

## Overview

Code signing is required for:
- **Windows**: EV Code Signing Certificate for MSI/NSIS installers
- **macOS**: Apple Developer ID Certificate for DMG notarization
- **Linux**: GPG key for package signing

## Windows Code Signing

### Certificate Requirements
- **Type**: Extended Validation (EV) Code Signing Certificate
- **Provider**: DigiCert, GlobalSign, or Sectigo
- **Format**: PFX/P12 file with private key
- **Cost**: $200-500/year

### Setup Steps

1. **Purchase Certificate**
   ```bash
   # From DigiCert, GlobalSign, or Sectigo
   # Ensure it's an EV certificate for Windows 10/11 compatibility
   ```

2. **Export Certificate**
   ```bash
   # Export from certificate store to PFX format
   # Include private key
   # Set a strong password
   ```

3. **Configure GitHub Secrets**
   ```bash
   # Add to repository secrets:
   WIN_CSC_PATH: path/to/certificate.p12
   WIN_CSC_KEY_PASSWORD: your_certificate_password
   WIN_CSC_CONTENT: base64_encoded_certificate_content
   ```

4. **Test Signing**
   ```bash
   # Test with signtool
   signtool sign /fd SHA256 /t http://timestamp.digicert.com /f certificate.p12 /p password test.exe
   signtool verify /pa /v test.exe
   ```

## macOS Code Signing

### Certificate Requirements
- **Type**: Apple Developer ID Application Certificate
- **Account**: Apple Developer Program ($99/year)
- **Format**: Certificate + private key in keychain
- **Notarization**: Required for macOS 10.15+

### Setup Steps

1. **Join Apple Developer Program**
   ```bash
   # Visit developer.apple.com
   # Pay $99 annual fee
   # Verify identity (may take days)
   ```

2. **Generate Certificate**
   ```bash
   # In Apple Developer Console:
   # Certificates, Identifiers & Profiles > Certificates > + > Developer ID Application
   # Download the certificate
   ```

3. **Install Certificate**
   ```bash
   # Double-click certificate to install in Keychain Access
   # Export as .p12 if needed for CI/CD
   ```

4. **Configure GitHub Secrets**
   ```bash
   # Add to repository secrets:
   MACOS_DEVELOPER_ID: Developer ID Application: Your Name (Team ID)
   MACOS_APPLE_ID: your_apple_id@example.com
   MACOS_APP_PASSWORD: app_specific_password
   MACOS_TEAM_ID: your_team_id
   MACOS_DEVELOPER_CERT: base64_encoded_certificate
   MACOS_CERT_PASSWORD: certificate_password
   MACOS_KEYCHAIN_PASSWORD: keychain_password
   ```

5. **Test Signing and Notarization**
   ```bash
   # Sign test app
   codesign --force --deep --sign "Developer ID Application: Your Name" TestApp.app
   
   # Notarize
   xcrun notarytool submit TestApp.dmg --apple-id user@example.com --password app_password --team-id TEAMID --wait
   ```

## Linux Code Signing

### GPG Key Requirements
- **Type**: RSA 4096-bit key
- **Usage**: Package signing
- **Distribution**: Upload to keyservers
- **Cost**: Free

### Setup Steps

1. **Generate GPG Key**
   ```bash
   # Generate strong GPG key
   gpg --full-generate-key
   # Choose: RSA and RSA, 4096 bits, no expiration
   # Real name: TunnelForge
   # Email: security@tunnelforge.dev
   ```

2. **Export Keys**
   ```bash
   # Export private key (keep secure!)
   gpg --export-secret-key -a security@tunnelforge.dev > private.key
   
   # Export public key
   gpg --export -a security@tunnelforge.dev > public.key
   ```

3. **Upload to Keyservers**
   ```bash
   # Upload public key
   gpg --send-keys --keyserver keyserver.ubuntu.com KEY_ID
   ```

4. **Configure GitHub Secrets**
   ```bash
   # Add to repository secrets:
   GPG_PRIVATE_KEY: contents_of_private.key
   GPG_PUBLIC_KEY: contents_of_public.key
   GPG_EMAIL: security@tunnelforge.dev
   GPG_NAME: TunnelForge
   GPG_PASSPHRASE: key_passphrase
   ```

5. **Test GPG Signing**
   ```bash
   # Import keys
   echo "$GPG_PRIVATE_KEY" | gpg --import
   echo "$GPG_PUBLIC_KEY" | gpg --import
   
   # Test signing
   echo "test" | gpg --clearsign > test.txt.asc
   gpg --verify test.txt.asc
   ```

## CI/CD Integration

### GitHub Actions Setup

1. **Enable Required Secrets**
   ```bash
   # All secrets listed above must be configured
   # Go to Repository Settings > Secrets and variables > Actions
   ```

2. **Test Signing Workflow**
   ```bash
   # Trigger code signing workflow manually
   gh workflow run code-signing.yml -f platform=windows -f sign_type=test
   ```

3. **Verify Signed Artifacts**
   ```bash
   # Download signed artifacts and verify signatures
   # Platform-specific verification commands above
   ```

## Security Best Practices

### Certificate Storage
- **Never commit certificates** to version control
- **Use GitHub Secrets** for all sensitive data
- **Rotate certificates** annually
- **Use separate certificates** for different environments

### Key Management
- **Store private keys** securely offline
- **Use hardware security modules** (HSM) when possible
- **Implement key rotation** procedures
- **Monitor certificate expiration** dates

### CI/CD Security
- **Limit access** to signing secrets
- **Use separate secrets** for different platforms
- **Audit signing activities** regularly
- **Implement approval workflows** for releases

## Troubleshooting

### Windows Signing Issues
- **Certificate not found**: Verify WIN_CSC_PATH and password
- **Timestamp server error**: Try different timestamp URLs
- **Signature verification fails**: Check certificate validity

### macOS Signing Issues
- **Keychain access denied**: Verify keychain password
- **Notarization fails**: Check Apple ID and app password
- **Gatekeeper blocks app**: Ensure proper signing and notarization

### Linux Signing Issues
- **GPG key not found**: Verify GPG_PRIVATE_KEY secret
- **Package signing fails**: Check dpkg-sig/rpm configuration
- **Keyserver upload fails**: Try different keyservers

## Cost Summary

### One-time Setup Costs
- **Windows EV Certificate**: $300-500
- **Apple Developer Program**: $99
- **GPG Key Generation**: Free

### Annual Renewal Costs
- **Windows Certificate**: $200-400/year
- **Apple Developer Program**: $99/year
- **GPG Key**: Free

### Total First Year Cost: $400-700
### Annual Recurring Cost: $300-500

## Next Steps

1. **Purchase certificates** for your target platforms
2. **Set up GitHub Secrets** with certificate data
3. **Test signing workflows** in CI/CD
4. **Implement signing** in release pipelines
5. **Monitor certificate expiration** dates

---

*This setup enables secure, trusted software distribution across all supported platforms.*
