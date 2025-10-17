#!/bin/bash
# GitHub Secrets Setup Script for TunnelForge CI/CD
# Run this after generating all signing keys

echo "=== TunnelForge GitHub Secrets Setup ==="
echo ""
echo "This script will help you set up all required GitHub secrets for CI/CD."
echo "Make sure you have run the following first:"
echo "- Generated Tauri update keys"
echo "- Generated GPG keys for Linux"
echo "- Exported Apple certificates (on macOS)"
echo ""
echo "Required secrets:"
echo ""

# Tauri keys
TAURI_PRIVATE_KEY=$(cat /home/f3rg/src/github/tunnelforge/desktop/tauri-keys)
TAURI_PUBLIC_KEY=$(cat /home/f3rg/src/github/tunnelforge/desktop/tauri-keys.pub)

echo "=== TAURI SECRETS ==="
echo "TAURI_PRIVATE_KEY: [base64 content ready]"
echo "TAURI_KEY_PASSWORD: tunnelforge2025"
echo ""

# GPG keys
GPG_PRIVATE_KEY_BASE64=$(gpg --armor --export-secret-keys 36659ACED2932AD6 | base64 -w 0)

echo "=== GPG SECRETS (Linux) ==="
echo "GPG_PRIVATE_KEY: [base64 content ready]"
echo "GPG_PASSPHRASE: tunnelforge2025"
echo "GPG_EMAIL: dev@tunnelforge.dev"
echo "GPG_NAME: TunnelForge"
echo ""

echo "=== APPLE SECRETS (macOS) ==="
echo "MACOS_DEVELOPER_CERT: [paste base64 from export-apple-cert.sh]"
echo "MACOS_CERT_PASSWORD: [password from Keychain export]"
echo "MACOS_DEVELOPER_ID: [from certificate name]"
echo "MACOS_TEAM_ID: [10-char from Apple Developer Portal]"
echo "MACOS_APPLE_ID: [your Apple ID email]"
echo "MACOS_APP_PASSWORD: [app-specific password]"
echo "MACOS_KEYCHAIN_PASSWORD: [choose secure random password]"
echo ""

echo "=== WINDOWS SECRETS (choose one option) ==="
echo ""
echo "# Option A: Certum Open Source (€69/year)"
echo "WIN_CSC_CONTENT: [base64 .pfx certificate from Certum]"
echo "WIN_CSC_KEY_PASSWORD: [certificate password]"
echo ""
echo "# Option B: SignPath Free"
echo "SIGNPATH_API_TOKEN: [from SignPath dashboard]"
echo ""
echo "# Option C: Azure Trusted Signing"
echo "AZURE_TENANT_ID: [from Azure portal]"
echo "AZURE_CLIENT_ID: [service principal ID]"
echo "AZURE_CLIENT_SECRET: [service principal secret]"
echo ""

echo "=== AUTOMATED SETUP ==="
echo ""
echo "To set all secrets automatically, run these commands:"
echo ""

# Tauri secrets
echo "# Tauri Update Signing"
echo "gh secret set TAURI_PRIVATE_KEY -b '$TAURI_PRIVATE_KEY'"
echo "gh secret set TAURI_KEY_PASSWORD -b 'tunnelforge2025'"
echo ""

# GPG secrets
echo "# Linux GPG Signing"
echo "gh secret set GPG_PRIVATE_KEY -b '$GPG_PRIVATE_KEY_BASE64'"
echo "gh secret set GPG_PASSPHRASE -b 'tunnelforge2025'"
echo "gh secret set GPG_EMAIL -b 'dev@tunnelforge.dev'"
echo "gh secret set GPG_NAME -b 'TunnelForge'"
echo ""

# Apple secrets (placeholders)
echo "# macOS Code Signing (fill in your values)"
echo "# gh secret set MACOS_DEVELOPER_CERT -b '[paste base64 cert]'"
echo "# gh secret set MACOS_CERT_PASSWORD -b '[cert export password]'"
echo "# gh secret set MACOS_DEVELOPER_ID -b '[Developer ID Application: Your Name]'"
echo "# gh secret set MACOS_TEAM_ID -b '[10-char team ID]'"
echo "# gh secret set MACOS_APPLE_ID -b '[your@email.com]'"
echo "# gh secret set MACOS_APP_PASSWORD -b '[xxxx-xxxx-xxxx-xxxx]'"
echo "# gh secret set MACOS_KEYCHAIN_PASSWORD -b '[random-password]'"
echo ""

echo "=== VERIFICATION ==="
echo ""
echo "After setting secrets, verify with:"
echo "gh secret list"
echo ""
echo "You should see at least these secrets:"
echo "- TAURI_PRIVATE_KEY"
echo "- TAURI_KEY_PASSWORD"
echo "- GPG_PRIVATE_KEY"
echo "- GPG_PASSPHRASE"
echo "- GPG_EMAIL"
echo "- GPG_NAME"
echo "- [7 MACOS_* secrets when you add Apple certs]"
echo "- [Windows secrets when you choose an option]"
echo ""

echo "=== NEXT STEPS ==="
echo ""
echo "1. Run the automated commands above (uncomment the Apple ones after export)"
echo "2. Choose Windows signing option and apply for certificate"
echo "3. Test signed builds:"
echo "   gh workflow run build-linux.yml -f sign_artifacts=true"
echo "   gh workflow run build-macos.yml -f sign_artifacts=true"
echo "   gh workflow run build-windows.yml -f sign_artifacts=true"
echo ""

echo "=== END OF SECRETS SETUP ==="