# Code Signing Requirements for TunnelForge

*Last Updated: 2025-10-11*

## Overview

To distribute TunnelForge desktop applications on all platforms, we need platform-specific code signing certificates. This document outlines requirements, vendors, pricing, and acquisition timelines.

## Current Status

- ✅ **Tauri Updater Keypair**: Generated and configured in all platform configs
  - Public key: `dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEJBNTZDMzczNUIwQ0I4NUUKUldSZXVBeGJjOE5XdXRHQ0VRTnJPVFZXemxkZnQrTzRQalgxTmdza0pjZzJkN3ZlayswOWFHTG0K`
  - Private key: `.tauri/tunnelforge.key` (gitignored)
  - Used for: Signing app updates (all platforms)

- ⏳ **Platform Code Signing**: Not yet acquired

## Platform Requirements

### Windows

**Certificate Type**: Code Signing Certificate (Authenticode)

**Requirements**:
- Organization Validated (OV) certificate required for kernel-level code
- Standard certificate acceptable for user-space applications
- EV (Extended Validation) recommended for SmartScreen reputation

**Vendors & Pricing**:
1. **DigiCert** (Recommended)
   - OV Code Signing: $474/year
   - EV Code Signing: $599/year
   - Timeline: 1-3 business days (OV), 1-5 days (EV)
   - URL: https://www.digicert.com/code-signing

2. **Sectigo (formerly Comodo)**
   - OV Code Signing: $199/year
   - EV Code Signing: $449/year
   - Timeline: 1-3 business days
   - URL: https://sectigo.com/ssl-certificates-tls/code-signing

3. **SSL.com**
   - OV Code Signing: $249/year
   - EV Code Signing: $359/year
   - Timeline: 1-5 business days
   - URL: https://www.ssl.com/code-signing-certificates/

**Verification Requirements**:
- Business registration documents
- Phone verification
- Domain verification
- EV requires additional vetting

**GitHub Secret Names**:
- `WINDOWS_CERTIFICATE_THUMBPRINT`
- `WINDOWS_SIGNING_CERT` (base64 encoded .pfx)
- `WINDOWS_SIGNING_CERT_PASSWORD`

### macOS

**Certificate Type**: Apple Developer ID Application Certificate

**Requirements**:
- Apple Developer Account ($99/year)
- Enrolled in Apple Developer Program
- Certificate issued through Xcode or Apple Developer portal

**Pricing**: $99/year (Apple Developer Program membership)

**Timeline**: 
- Immediate (if already enrolled)
- 1-2 days (new enrollment with verification)

**Setup Process**:
1. Enroll in Apple Developer Program
2. Create Developer ID Application certificate in Xcode/portal
3. Export certificate as .p12 file
4. Convert to base64 for GitHub Secrets

**Notarization**:
- Required for distribution outside Mac App Store
- Automated via `xcrun notarytool`
- Requires app-specific password

**GitHub Secret Names**:
- `APPLE_CERTIFICATE` (base64 encoded .p12)
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_ID` (for notarization)
- `APPLE_TEAM_ID`
- `APPLE_APP_SPECIFIC_PASSWORD` (for notarization)

### Linux

**Certificate Type**: None required (optional GPG signing)

**Current Status**: 
- No code signing certificates required for Linux distribution
- Package verification via checksums and GPG signatures (optional)
- Users verify via HTTPS download from trusted domain

**Optional GPG Signing**:
- Free
- Immediate setup
- Improves package authenticity verification
- Used by: Debian, Ubuntu, Fedora package repositories

**GitHub Secret Names** (if using GPG):
- `GPG_PRIVATE_KEY`
- `GPG_PASSPHRASE`

## Total Investment Required

### Minimum (1 Year)
- **Windows OV Certificate**: $199-249 (Sectigo/SSL.com)
- **Apple Developer**: $99
- **Total**: ~$300-350

### Recommended (1 Year)
- **Windows EV Certificate**: $359-599 (better SmartScreen reputation)
- **Apple Developer**: $99
- **Total**: ~$450-700

### Enterprise (3 Years)
- **Windows EV Certificate**: ~$1,500 (3-year bulk pricing)
- **Apple Developer**: $297 (3 years)
- **Total**: ~$1,800 (saves ~$300)

## Acquisition Timeline

### Week 1 (Current)
- ✅ Generate Tauri updater keypair
- ✅ Update platform configs
- ⏳ Gather business verification documents
- ⏳ Choose certificate vendors

### Week 2
- Purchase Windows code signing certificate
- Purchase/activate Apple Developer membership
- Submit verification documents
- Wait for certificate issuance

### Week 3
- Receive and install certificates
- Configure GitHub Secrets
- Test signing workflow locally
- Validate signed builds

### Week 4
- Deploy CI/CD with signing
- Begin internal beta testing
- Monitor signing issues

## Business Verification Documents

### Required for Windows OV/EV Certificates
- Business registration certificate
- Tax ID / EIN
- Physical business address
- Business phone number (landline preferred for EV)
- Domain ownership proof
- DUNS number (for EV)

### Required for Apple Developer
- Legal entity name
- D-U-N-S Number (free from Dun & Bradstreet)
- Legal Entity Status (corporation, LLC, etc.)
- Website
- Business phone number

## Security Best Practices

### Certificate Storage
- ❌ Never commit certificates to git
- ✅ Store in GitHub Secrets (base64 encoded)
- ✅ Use separate certificates for development/production
- ✅ Restrict certificate access to authorized personnel

### Key Management
- ✅ Tauri private key: Store in GitHub Secrets as `TAURI_SIGNING_PRIVATE_KEY`
- ✅ Windows certificate: Encrypted .pfx with strong password
- ✅ Apple certificate: .p12 with strong password
- ✅ Rotate keys annually or when compromised

### CI/CD Security
- ✅ Use environment-specific secrets
- ✅ Enable audit logging for secret access
- ✅ Restrict workflow triggers to protected branches
- ✅ Review and approve all workflow changes

## Vendor Comparison Matrix

| Vendor | Windows OV | Windows EV | Support | Reputation | Speed |
|--------|-----------|-----------|---------|-----------|-------|
| DigiCert | $474/yr | $599/yr | Excellent | Best | Fast |
| Sectigo | $199/yr | $449/yr | Good | Good | Fast |
| SSL.com | $249/yr | $359/yr | Good | Good | Medium |

## Recommended Vendors

### For Startups/Small Teams
- **Windows**: SSL.com or Sectigo (cost-effective)
- **macOS**: Apple Developer Program (required)

### For Established Companies
- **Windows**: DigiCert EV (best reputation, avoids SmartScreen issues)
- **macOS**: Apple Developer Program (required)

## Next Steps

1. **Immediate** (This Week):
   - [ ] Gather business verification documents
   - [ ] Choose Windows certificate vendor (recommend SSL.com for budget)
   - [ ] Enroll in Apple Developer Program
   - [ ] Submit orders and verification

2. **Week 2-3**:
   - [ ] Receive certificates
   - [ ] Configure GitHub Secrets (see `.github/SECRETS_CONFIGURATION.md`)
   - [ ] Test local signing
   - [ ] Test CI/CD signing

3. **Week 4+**:
   - [ ] Begin internal beta with signed builds
   - [ ] Monitor certificate expiration dates
   - [ ] Set up renewal reminders (90 days before expiry)

## Certificate Renewal Process

### Windows Certificates
- Renew 30-90 days before expiration
- Re-verification may be required
- Plan for 1-5 day turnaround

### Apple Developer
- Auto-renews if payment method valid
- Update certificates in Xcode/portal
- Re-export and update GitHub Secrets

### Tauri Updater Key
- Does not expire
- Rotate only if compromised
- Requires re-release of all platform apps with new public key

## Troubleshooting

### Windows Signing Issues
- **Error**: "Certificate not found"
  - Verify `WINDOWS_CERTIFICATE_THUMBPRINT` matches certificate
  - Check certificate is properly imported

- **Error**: "Invalid certificate password"
  - Verify `WINDOWS_SIGNING_CERT_PASSWORD` secret
  - Re-export certificate with known password

### macOS Signing Issues
- **Error**: "No valid signing identity"
  - Verify certificate is in Keychain
  - Check certificate permissions

- **Error**: "Notarization failed"
  - Verify `APPLE_APP_SPECIFIC_PASSWORD` is correct
  - Check `APPLE_ID` and `APPLE_TEAM_ID`

### Tauri Updater Issues
- **Error**: "Invalid signature"
  - Verify public key matches private key
  - Check `TAURI_SIGNING_PRIVATE_KEY` secret

## References

- [Tauri Updater Documentation](https://tauri.app/v1/guides/distribution/updater)
- [Windows Code Signing Guide](https://learn.microsoft.com/en-us/windows/win32/appxpkg/how-to-sign-a-package-using-signtool)
- [Apple Code Signing Guide](https://developer.apple.com/library/archive/documentation/Security/Conceptual/CodeSigningGuide/Introduction/Introduction.html)
- [GitHub Actions: Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)

---

*For configuration instructions, see `.github/SECRETS_CONFIGURATION.md`*
*For deployment checklist, see `.github/DEPLOYMENT_CHECKLIST.md`*
