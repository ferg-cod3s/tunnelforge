#!/usr/bin/env bash

set -e

echo "=========================================="
echo "TunnelForge GitHub Secrets Setup"
echo "=========================================="
echo ""
echo "This script will guide you through setting up GitHub secrets"
echo "required for CI/CD workflows."
echo ""

REPO_NAME="${GITHUB_REPOSITORY:-}"

if [ -z "$REPO_NAME" ]; then
    read -p "Enter GitHub repository (e.g., username/tunnelforge): " REPO_NAME
fi

echo ""
echo "Using repository: $REPO_NAME"
echo ""

if ! command -v gh &> /dev/null; then
    echo "Error: GitHub CLI (gh) is not installed."
    echo "Please install it from: https://cli.github.com/"
    exit 1
fi

if ! gh auth status &> /dev/null; then
    echo "You are not authenticated with GitHub CLI."
    echo "Please run: gh auth login"
    exit 1
fi

echo "✓ GitHub CLI is installed and authenticated"
echo ""

function set_secret() {
    local secret_name="$1"
    local secret_description="$2"
    local secret_instructions="$3"
    
    echo "=========================================="
    echo "Setting: $secret_name"
    echo "=========================================="
    echo "$secret_description"
    echo ""
    echo "Instructions:"
    echo "$secret_instructions"
    echo ""
    
    read -p "Do you want to set $secret_name? (y/n): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Choose input method:"
        echo "1) Enter value directly"
        echo "2) Read from file"
        read -p "Select option (1 or 2): " -n 1 -r input_method
        echo ""
        
        if [[ $input_method == "1" ]]; then
            read -sp "Enter value for $secret_name: " secret_value
            echo ""
            echo "$secret_value" | gh secret set "$secret_name" --repo "$REPO_NAME"
        elif [[ $input_method == "2" ]]; then
            read -p "Enter file path: " file_path
            if [ -f "$file_path" ]; then
                gh secret set "$secret_name" --repo "$REPO_NAME" < "$file_path"
            else
                echo "Error: File not found: $file_path"
                return 1
            fi
        else
            echo "Invalid option. Skipping."
            return 1
        fi
        
        echo "✓ $secret_name set successfully"
    else
        echo "Skipped $secret_name"
    fi
    echo ""
}

echo "Let's set up your GitHub secrets..."
echo ""

set_secret \
    "HOMEBREW_TAP_TOKEN" \
    "Personal Access Token for Homebrew tap repository" \
    "1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate new token (classic) with 'repo' and 'workflow' scopes
3. Copy the token
Note: You must create a 'homebrew-tap' repository first"

set_secret \
    "GPG_PRIVATE_KEY" \
    "GPG private key for signing DEB packages" \
    "1. Generate: gpg --full-generate-key (RSA 4096-bit)
2. Export: gpg --armor --export-secret-keys YOUR_KEY_ID | base64 -w0
3. Copy the output"

set_secret \
    "GPG_PASSPHRASE" \
    "Passphrase for GPG private key" \
    "Enter the passphrase you used when creating the GPG key"

set_secret \
    "APT_DEPLOY_KEY" \
    "SSH private key for APT repository deployment" \
    "1. Generate: ssh-keygen -t ed25519 -C 'tunnelforge-apt-deploy'
2. Encode: cat ~/.ssh/id_ed25519 | base64 -w0
3. Add public key to APT server's authorized_keys"

set_secret \
    "APT_HOST" \
    "APT repository server hostname and path" \
    "Format: username@hostname:/path/to/apt/repo
Example: deploy@apt.tunnelforge.dev:/var/www/apt"

set_secret \
    "SNAPCRAFT_STORE_CREDENTIALS" \
    "Snapcraft store login credentials" \
    "1. Install: sudo snap install snapcraft --classic
2. Login: snapcraft login
3. Register: snapcraft register tunnelforge
4. Export: snapcraft export-login --snaps tunnelforge snapcraft-creds.txt
5. Encode: cat snapcraft-creds.txt | base64 -w0"

set_secret \
    "CHOCOLATEY_API_KEY" \
    "API key for Chocolatey package publishing" \
    "1. Create account at https://community.chocolatey.org/
2. Go to https://community.chocolatey.org/account
3. Copy your API key"

set_secret \
    "TAURI_PRIVATE_KEY" \
    "Private key for signing Tauri updates" \
    "1. Generate: bunx @tauri-apps/cli signer generate -w ~/.tauri/tunnelforge.key
2. Copy the content of ~/.tauri/tunnelforge.key"

set_secret \
    "TAURI_PUBLIC_KEY" \
    "Public key for verifying Tauri updates" \
    "Copy the public key printed when generating the private key"

echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Verifying secrets..."
gh secret list --repo "$REPO_NAME"
echo ""
echo "✓ All secrets have been configured"
echo ""
echo "Next steps:"
echo "1. Review the secrets in GitHub: https://github.com/$REPO_NAME/settings/secrets/actions"
echo "2. Test workflows by creating a release tag"
echo "3. Monitor Actions tab for any errors"
echo ""
echo "For troubleshooting, see: docs/GITHUB_SECRETS_SETUP.md"
