# TunnelForge Certificate Acquisition Guide

**Status**: 🚀 Ready to Start  
**Timeline**: 2-3 weeks  
**Total Cost**: $348-698/year  

---

## Executive Summary

This guide provides a step-by-step process to acquire all necessary code signing certificates for TunnelForge cross-platform desktop applications. Following this guide will enable:

- ✅ Signed Windows installers (no SmartScreen warnings)
- ✅ Signed macOS applications (Gatekeeper approved)
- ✅ Secure auto-update capabilities
- ✅ Distribution through official channels

---

## Prerequisites Checklist

Before purchasing certificates, gather the following business information:

### 🏢 Business Information

- [ ] **Legal Entity Name**: `Amantus Machina` (from LICENSE file)
- [ ] **Business Registration Documents**:
  - Articles of Incorporation / Formation
  - Business license (if applicable)
  - Operating agreement (if LLC)
- [ ] **Tax Identification**:
  - EIN (Employer Identification Number) or
  - SSN (if sole proprietor)
  - Tax registration certificate
- [ ] **Business Address**:
  - Physical street address (no PO boxes)
  - Proof of address (utility bill, lease agreement)
- [ ] **Business Phone Number**:
  - Must be publicly listed or verifiable
  - Consider: Google Voice, dedicated business line
- [ ] **Domain Ownership**:
  - `tunnelforge.dev` - WHOIS verification
  - `tunnelforge.sh` - WHOIS verification
  - Admin email access: admin@tunnelforge.dev

### 👤 Identity Verification

- [ ] **Government-issued ID**:
  - Driver's license or passport
  - Must match business owner/authorized representative
- [ ] **Contact Information**:
  - Personal phone number
  - Personal email address
- [ ] **Authorization Letter** (if not business owner):
  - Signed letter from owner authorizing certificate purchase

### 💳 Payment Information

- [ ] Credit card or business bank account
- [ ] Budget allocation:
  - Windows: $199-599/year
  - macOS: $99/year
  - Total: $298-698/year

---

## Platform Requirements

### 1. Windows Code Signing Certificate

**Type**: Organization Validation (OV) Code Signing Certificate

#### Option A: SSL.com OV Certificate (Recommended)
**Cost**: $249/year  
**Lead Time**: 2-5 business days  
**Why**: Best balance of cost, reputation, and support

**Features**:
- ✅ Instant SmartScreen reputation with EV option
- ✅ Authenticode signing for .exe, .msi, .dll
- ✅ Kernel-mode signing capable (if needed)
- ✅ Timestamping included (free)
- ✅ Unlimited signatures

**Purchase Link**: https://www.ssl.com/code-signing/

#### Option B: DigiCert OV Certificate
**Cost**: $599/year  
**Lead Time**: 3-5 business days  
**Why**: Industry leader, highest trust, enterprise-grade

**Features**:
- ✅ Best SmartScreen reputation
- ✅ Priority support
- ✅ Advanced security options
- ✅ Certificate management portal

**Purchase Link**: https://www.digicert.com/signing/code-signing-certificates

#### Option C: Sectigo OV Certificate
**Cost**: $199/year  
**Lead Time**: 2-7 business days  
**Why**: Budget-friendly, widely trusted

**Features**:
- ✅ Standard code signing
- ✅ Good SmartScreen reputation (slower buildup)
- ✅ Basic support

**Purchase Link**: https://sectigo.com/ssl-certificates-tls/code-signing

#### Verification Process

**Step 1: Submit Order**
- Choose certificate vendor
- Select "Organization Validation" (OV) certificate
- Complete online order form

**Step 2: Business Verification**
- Submit business registration documents
- Verify phone number (callback from CA)
- Verify domain ownership (email or DNS)
- Verify physical address

**Step 3: Identity Verification**
- Upload government ID
- Phone verification call
- Email verification

**Step 4: Certificate Issuance**
- Download certificate (.pfx or .p12 file)
- **CRITICAL**: Store securely with strong password
- **BACKUP**: Store encrypted backup in secure location

**Step 5: GitHub Secrets Configuration**
Configure these secrets in GitHub repository:

```
WINDOWS_CERTIFICATE: <base64-encoded .pfx file>
WINDOWS_CERTIFICATE_PASSWORD: <certificate password>
WINDOWS_CERTIFICATE_THUMBPRINT: <SHA1 thumbprint>
WINDOWS_SIGNING_TIMESTAMP_URL: http://timestamp.digicert.com
WINDOWS_SIGNING_DIGEST_ALGORITHM: sha256
```

---

### 2. Apple Developer Program (macOS)

**Type**: Apple Developer Program Membership  
**Cost**: $99/year  
**Lead Time**: 1-2 weeks (D-U-N-S Number required)

#### Prerequisites

**D-U-N-S Number**:
- Free business identifier from Dun & Bradstreet
- Required for Apple Developer enrollment
- Application: https://developer.apple.com/enroll/duns-lookup/
- Lead time: 5-10 business days

**Apple ID**:
- Create at appleid.apple.com
- Use business email (e.g., dev@tunnelforge.dev)
- Enable two-factor authentication

#### Enrollment Process

**Step 1: Request D-U-N-S Number**
1. Visit: https://developer.apple.com/enroll/duns-lookup/
2. Verify existing D-U-N-S or request new
3. Provide:
   - Legal entity name: `Amantus Machina`
   - Business address
   - Business phone
   - Contact information
4. Wait 5-10 business days for confirmation

**Step 2: Enroll in Apple Developer Program**
1. Visit: https://developer.apple.com/programs/enroll/
2. Sign in with Apple ID
3. Choose "Enroll as an Organization"
4. Provide:
   - D-U-N-S Number
   - Legal entity information
   - Business verification documents
   - Payment: $99/year

**Step 3: Verification & Approval**
- Apple reviews application (1-3 business days)
- May request additional documentation
- Phone verification call (sometimes)
- Email confirmation when approved

**Step 4: Generate Certificates**

Once enrolled, generate Developer ID certificates:

1. **Login to Apple Developer Portal**:
   - https://developer.apple.com/account

2. **Create Developer ID Application Certificate**:
   - Navigate to: Certificates, Identifiers & Profiles
   - Click: Certificates → (+) → Developer ID Application
   - Generate Certificate Signing Request (CSR):
     ```bash
     # On macOS:
     # Open Keychain Access → Certificate Assistant → Request Certificate from CA
     # Save CSR file
     ```
   - Upload CSR
   - Download certificate (.cer file)
   - Install in Keychain (macOS)

3. **Create Developer ID Installer Certificate** (optional, for .pkg):
   - Same process as Application certificate
   - Choose "Developer ID Installer"

4. **Generate App-Specific Password** (for notarization):
   - Visit: appleid.apple.com → Sign In
   - Security → App-Specific Passwords → Generate
   - Label: "TunnelForge Notarization"
   - Save password securely

**Step 5: Export Certificates for CI/CD**

```bash
# On macOS with certificates installed:

# Export Developer ID Application certificate
security find-identity -v -p codesigning

# Export as .p12 (requires password)
security export -k ~/Library/Keychains/login.keychain-db \
  -t identities -f pkcs12 \
  -o developer-id-application.p12 \
  -P <export-password>

# Base64 encode for GitHub Secrets
base64 -i developer-id-application.p12 -o developer-id-application.p12.base64
```

**Step 6: GitHub Secrets Configuration**

```
APPLE_CERTIFICATE: <base64-encoded .p12 file>
APPLE_CERTIFICATE_PASSWORD: <certificate export password>
APPLE_ID: <your Apple ID email>
APPLE_APP_SPECIFIC_PASSWORD: <app-specific password>
APPLE_TEAM_ID: <10-character Team ID from developer portal>
APPLE_SIGNING_IDENTITY: "Developer ID Application: Amantus Machina (TEAM_ID)"
APPLE_NOTARIZE_USERNAME: <Apple ID email>
APPLE_NOTARIZE_PASSWORD: <app-specific password>
```

---

### 3. Linux GPG Signing (Optional)

**Type**: GPG Key Pair  
**Cost**: Free  
**Lead Time**: 1 hour  
**Why**: Optional but recommended for package repository signing

#### Generate GPG Key

```bash
# Generate key pair
gpg --full-generate-key

# Choose:
# - Type: RSA and RSA (default)
# - Key size: 4096 bits
# - Expiration: 2 years
# - Real name: TunnelForge Team
# - Email: security@tunnelforge.dev
# - Passphrase: <strong password>

# Export public key
gpg --armor --export security@tunnelforge.dev > tunnelforge-public.asc

# Export private key (secure storage!)
gpg --armor --export-secret-keys security@tunnelforge.dev > tunnelforge-private.asc

# Upload to keyserver
gpg --keyserver keyserver.ubuntu.com --send-keys <KEY_ID>
```

#### GitHub Secrets Configuration

```
GPG_PRIVATE_KEY: <contents of tunnelforge-private.asc>
GPG_PASSPHRASE: <GPG key passphrase>
```

---

## Vendor Comparison Matrix

| Vendor | Type | Cost/Year | Trust | Lead Time | Support | Recommendation |
|--------|------|-----------|-------|-----------|---------|----------------|
| **SSL.com** | Windows OV | $249 | High | 2-5 days | Good | ⭐ Best Value |
| **DigiCert** | Windows OV | $599 | Highest | 3-5 days | Excellent | Enterprise |
| **Sectigo** | Windows OV | $199 | Good | 2-7 days | Basic | Budget |
| **Apple** | macOS Dev | $99 | Highest | 1-2 weeks | Good | Required |
| **GPG** | Linux | Free | Medium | 1 hour | Community | Optional |

---

## Step-by-Step Timeline

### Week 1: Preparation & Purchase

**Day 1-2: Document Gathering**
- [ ] Compile all business verification documents
- [ ] Scan/photograph government ID
- [ ] Verify domain ownership access
- [ ] Set up business phone line (if needed)

**Day 3-4: D-U-N-S Number Application**
- [ ] Submit D-U-N-S application for Apple
- [ ] Verify business information accuracy
- [ ] Note: This runs in parallel with Windows cert

**Day 5: Purchase Certificates**
- [ ] Choose Windows certificate vendor
- [ ] Purchase Windows OV certificate
- [ ] Begin Apple Developer enrollment (if D-U-N-S ready)
- [ ] Submit all verification documents

**Day 6-7: Follow-Up**
- [ ] Respond to any CA verification requests
- [ ] Answer phone verification calls
- [ ] Provide additional documents if requested

### Week 2: Issuance & Configuration

**Day 8-10: Certificate Receipt**
- [ ] Download Windows certificate (.pfx)
- [ ] Store securely with strong password
- [ ] Create encrypted backup
- [ ] Test certificate locally

**Day 11-12: Apple Developer Approval**
- [ ] Complete Apple enrollment
- [ ] Generate Developer ID certificates
- [ ] Create app-specific password
- [ ] Export certificates for CI/CD

**Day 13-14: GitHub Configuration**
- [ ] Configure 8 Windows secrets
- [ ] Configure 9 macOS secrets
- [ ] Configure 3 Linux secrets (optional)
- [ ] Configure 5 general secrets

### Week 3: Testing & Validation

**Day 15-17: Signed Build Testing**
- [ ] Build signed Windows installers
- [ ] Test SmartScreen behavior
- [ ] Build signed macOS DMG
- [ ] Test Gatekeeper approval
- [ ] Validate notarization

**Day 18-21: CI/CD Integration**
- [ ] Enable GitHub Actions signing
- [ ] Test automated signed builds
- [ ] Validate artifact uploads
- [ ] Document any issues

---

## Security Best Practices

### Certificate Storage

**DO**:
- ✅ Store certificates in encrypted password managers (1Password, LastPass)
- ✅ Use strong, unique passwords for certificate files
- ✅ Create encrypted backups in multiple secure locations
- ✅ Restrict access to certificate files (GitHub Secrets, team leads only)
- ✅ Enable 2FA on all certificate authority accounts
- ✅ Use hardware security modules (HSM) for EV certificates

**DON'T**:
- ❌ Store certificates in plain text files
- ❌ Commit certificates to version control
- ❌ Email certificates unencrypted
- ❌ Share certificates via insecure channels
- ❌ Store passwords with certificates
- ❌ Use weak or default passwords

### GitHub Secrets Management

**Best Practices**:
- Use GitHub Environments for production secrets
- Limit secret access to specific workflows
- Rotate secrets annually (when renewing certificates)
- Use separate certificates for development/staging/production
- Monitor secret access logs
- Enable secret scanning in repository

---

## Troubleshooting

### Windows Certificate Issues

**Issue**: "The certificate could not be validated"
- **Cause**: Certificate not installed properly
- **Fix**: Re-import .pfx with correct password, ensure in "Personal" store

**Issue**: "The timestamp server was unreachable"
- **Cause**: Timestamp URL incorrect or network issue
- **Fix**: Use recommended timestamp URLs:
  - DigiCert: http://timestamp.digicert.com
  - SSL.com: http://ts.ssl.com
  - Sectigo: http://timestamp.sectigo.com

**Issue**: "SmartScreen still shows warning"
- **Cause**: New certificate needs reputation buildup
- **Fix**: Normal for OV certificates, takes weeks/months of downloads

### Apple Certificate Issues

**Issue**: "No valid signing identity found"
- **Cause**: Certificate not in Keychain or expired
- **Fix**: Re-import certificate, verify not expired

**Issue**: "Notarization failed"
- **Cause**: App-specific password incorrect or expired
- **Fix**: Regenerate app-specific password, update secrets

**Issue**: "Gatekeeper blocks app"
- **Cause**: App not notarized or signature invalid
- **Fix**: Verify `codesign` and `notarytool` commands successful

---

## Cost Summary

### Recommended Configuration

| Item | Vendor | Cost/Year | Renewal |
|------|--------|-----------|---------|
| Windows OV | SSL.com | $249 | Annual |
| macOS Developer | Apple | $99 | Annual |
| Linux GPG | Self-signed | Free | Every 2 years |
| **Total** | | **$348** | |

### Enterprise Configuration

| Item | Vendor | Cost/Year | Renewal |
|------|--------|-----------|---------|
| Windows EV | DigiCert | $599 | Annual |
| macOS Developer | Apple | $99 | Annual |
| Linux GPG | Self-signed | Free | Every 2 years |
| **Total** | | **$698** | |

### 3-Year Total Cost of Ownership

**Recommended**: $348 × 3 = $1,044  
**Enterprise**: $698 × 3 = $2,094

---

## Next Steps After Certificate Acquisition

Once all certificates are acquired and configured:

1. **Enable CI/CD Signing** (1-2 days):
   - Test GitHub Actions with new secrets
   - Validate signed builds on all platforms
   - Fix any signing issues

2. **Beta Testing** (1-2 weeks):
   - Distribute signed builds to internal testers
   - Validate installation on target platforms
   - Collect feedback on signing behavior

3. **Production Release** (1 week):
   - Tag release version
   - Trigger automated signed builds
   - Upload to release channels
   - Announce availability

4. **Auto-Update Setup** (1 week):
   - Configure update server endpoints
   - Test update mechanism
   - Document update process

---

## Contacts & Resources

### Certificate Authorities

**SSL.com**:
- Website: https://www.ssl.com/code-signing/
- Support: support@ssl.com
- Phone: +1 (877) 775-2691

**DigiCert**:
- Website: https://www.digicert.com/signing/code-signing-certificates
- Support: support@digicert.com
- Phone: +1 (801) 877-2100

**Sectigo**:
- Website: https://sectigo.com/ssl-certificates-tls/code-signing
- Support: support@sectigo.com
- Phone: +1 (888) 266-6361

**Apple Developer**:
- Website: https://developer.apple.com/support/
- Support: https://developer.apple.com/contact/
- Phone: +1 (800) 633-2152

### Internal Documentation

- `docs/CODE_SIGNING_REQUIREMENTS.md` - Detailed technical requirements
- `.github/SECRETS_CONFIGURATION.md` - GitHub secrets reference
- `BUILD_VALIDATION_REPORT.md` - Build status and validation

### External Resources

- [Microsoft Authenticode](https://docs.microsoft.com/en-us/windows-hardware/drivers/dashboard/code-signing-cert-manage)
- [Apple Code Signing Guide](https://developer.apple.com/library/archive/documentation/Security/Conceptual/CodeSigningGuide/)
- [Tauri Code Signing](https://v2.tauri.app/distribute/sign/)
- [CA/Browser Forum](https://cabforum.org/) - Industry standards

---

## Conclusion

Following this guide will result in fully signed, production-ready TunnelForge desktop applications across all platforms within 2-3 weeks. The total investment of ~$350/year enables:

- ✅ Professional distribution without security warnings
- ✅ Secure auto-update capabilities
- ✅ User trust and confidence
- ✅ Potential app store distribution

**Recommended Next Action**: Start with D-U-N-S number application (longest lead time) and document gathering while evaluating Windows certificate vendors.

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-27  
**Author**: Claude (AI Assistant)  
**Status**: Ready for Implementation
