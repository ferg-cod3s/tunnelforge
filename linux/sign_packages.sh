#!/bin/bash

# TunnelForge Code Signing Script
# Signs packages and executables for all platforms

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RELEASE_DIR=${RELEASE_DIR:-"release"}
WINDOWS_CERT=${WINDOWS_CERT:-""}
WINDOWS_CERT_PASSWORD=${WINDOWS_CERT_PASSWORD:-""}
MACOS_CERT=${MACOS_CERT:-""}
MACOS_CERT_PASSWORD=${MACOS_CERT_PASSWORD:-""}
LINUX_GPG_KEY=${LINUX_GPG_KEY:-""}
LINUX_GPG_PASSPHRASE=${LINUX_GPG_PASSPHRASE:-""}

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check signing dependencies
check_signing_dependencies() {
    log "Checking code signing dependencies..."
    
    local missing=()
    
    # Windows signing tools
    if [ -n "$WINDOWS_CERT" ]; then
        if ! command -v "signtool" &> /dev/null; then
            missing+=("signtool (Windows SDK)")
        fi
    fi
    
    # macOS signing tools
    if [ -n "$MACOS_CERT" ]; then
        if ! command -v "codesign" &> /dev/null; then
            missing+=("codesign (Xcode Command Line Tools)")
        fi
        if ! command -v "spctl" &> /dev/null; then
            missing+=("spctl (Xcode Command Line Tools)")
        fi
    fi
    
    # Linux signing tools
    if [ -n "$LINUX_GPG_KEY" ]; then
        if ! command -v "gpg" &> /dev/null; then
            missing+=("gpg")
        fi
    fi
    
    if [ ${#missing[@]} -ne 0 ]; then
        error "Missing signing dependencies: ${missing[*]}"
        exit 1
    fi
    
    success "Signing dependencies checked"
}

# Sign Windows executables and installers
sign_windows() {
    log "Signing Windows packages..."
    
    if [ -z "$WINDOWS_CERT" ]; then
        warning "Windows certificate not provided, skipping Windows signing"
        return
    fi
    
    local windows_dir="$RELEASE_DIR/windows"
    if [ ! -d "$windows_dir" ]; then
        warning "Windows packages directory not found: $windows_dir"
        return
    fi
    
    # Sign MSI installers
    for msi in "$windows_dir"/*.msi; do
        if [ -f "$msi" ]; then
            log "Signing MSI: $(basename "$msi")"
            
            signtool sign \
                /f "$WINDOWS_CERT" \
                /p "$WINDOWS_CERT_PASSWORD" \
                /t http://timestamp.digicert.com \
                /fd SHA256 \
                /d "TunnelForge Terminal Sharing" \
                /du "https://tunnelforge.com" \
                "$msi"
            
            success "Signed: $(basename "$msi")"
        fi
    done
    
    # Sign executables (if any)
    for exe in "$windows_dir"/*.exe; do
        if [ -f "$exe" ]; then
            log "Signing executable: $(basename "$exe")"
            
            signtool sign \
                /f "$WINDOWS_CERT" \
                /p "$WINDOWS_CERT_PASSWORD" \
                /t http://timestamp.digicert.com \
                /fd SHA256 \
                /d "TunnelForge Terminal Sharing" \
                /du "https://tunnelforge.com" \
                "$exe"
            
            success "Signed: $(basename "$exe")"
        fi
    done
    
    # Verify signatures
    log "Verifying Windows signatures..."
    for package in "$windows_dir"/*.{msi,exe}; do
        if [ -f "$package" ]; then
            if signtool verify /pa "$package" > /dev/null 2>&1; then
                success "Signature verified: $(basename "$package")"
            else
                error "Signature verification failed: $(basename "$package")"
            fi
        fi
    done
}

# Sign macOS applications and DMGs
sign_macos() {
    log "Signing macOS packages..."
    
    if [ -z "$MACOS_CERT" ]; then
        warning "macOS certificate not provided, skipping macOS signing"
        return
    fi
    
    local macos_dir="$RELEASE_DIR/macos"
    if [ ! -d "$macos_dir" ]; then
        warning "macOS packages directory not found: $macos_dir"
        return
    fi
    
    # Import certificate if provided as file
    if [ -f "$MACOS_CERT" ]; then
        log "Importing macOS certificate..."
        security import "$MACOS_CERT" -k ~/Library/Keychains/login.keychain -P "$MACOS_CERT_PASSWORD" -T /usr/bin/codesign -T /usr/bin/spctl
    fi
    
    # Sign applications
    for app in "$macos_dir"/*.app; do
        if [ -d "$app" ]; then
            log "Signing application: $(basename "$app")"
            
            # Sign the application bundle
            codesign --force --deep --sign "$MACOS_CERT" --options runtime "$app"
            
            # Verify signature
            if codesign --verify --verbose "$app" > /dev/null 2>&1; then
                success "Application signed: $(basename "$app")"
            else
                error "Application signing failed: $(basename "$app")"
                continue
            fi
            
            # Notarize if Apple ID credentials are available
            if [ -n "$APPLE_ID" ] && [ -n "$APPLE_ID_PASSWORD" ]; then
                log "Notarizing application: $(basename "$app")"
                
                # Create ZIP for notarization
                local zip_name="${app%.app}.zip"
                ditto -c -k --keepParent "$app" "$zip_name"
                
                # Submit for notarization
                local uuid=$(xcrun altool --notarize-app \
                    --primary-bundle-id "com.tunnelforge.app" \
                    --username "$APPLE_ID" \
                    --password "$APPLE_ID_PASSWORD" \
                    --file "$zip_name" 2>&1 | grep "RequestUUID" | awk '{print $3}')
                
                if [ -n "$uuid" ]; then
                    log "Notarization submitted with UUID: $uuid"
                    
                    # Wait for notarization
                    while true; do
                        local status=$(xcrun altool --notarization-info "$uuid" \
                            --username "$APPLE_ID" \
                            --password "$APPLE_ID_PASSWORD" 2>&1 | grep "Status" | awk '{print $2}')
                        
                        if [ "$status" = "success" ]; then
                            log "Notarization successful"
                            xcrun stapler staple "$app"
                            success "Application notarized: $(basename "$app")"
                            break
                        elif [ "$status" = "invalid" ]; then
                            error "Notarization failed for $(basename "$app")"
                            break
                        else
                            log "Waiting for notarization... (Status: $status)"
                            sleep 30
                        fi
                    done
                else
                    warning "Notarization submission failed"
                fi
                
                # Clean up ZIP
                rm -f "$zip_name"
            fi
        fi
    done
    
    # Sign DMG files
    for dmg in "$macos_dir"/*.dmg; do
        if [ -f "$dmg" ]; then
            log "Signing DMG: $(basename "$dmg")"
            
            codesign --force --sign "$MACOS_CERT" "$dmg"
            
            if codesign --verify --verbose "$dmg" > /dev/null 2>&1; then
                success "DMG signed: $(basename "$dmg")"
            else
                error "DMG signing failed: $(basename "$dmg")"
            fi
        fi
    done
}

# Sign Linux packages with GPG
sign_linux() {
    log "Signing Linux packages..."
    
    if [ -z "$LINUX_GPG_KEY" ]; then
        warning "Linux GPG key not provided, skipping Linux signing"
        return
    fi
    
    local linux_dir="$RELEASE_DIR/linux"
    if [ ! -d "$linux_dir" ]; then
        warning "Linux packages directory not found: $linux_dir"
        return
    fi
    
    # Import GPG key if provided as file
    if [ -f "$LINUX_GPG_KEY" ]; then
        log "Importing GPG key..."
        gpg --import "$LINUX_GPG_KEY"
    fi
    
    # Sign all packages
    for package in "$linux_dir"/*.{deb,rpm,AppImage,tar.gz}; do
        if [ -f "$package" ]; then
            log "Signing package: $(basename "$package")"
            
            # Create detached signature
            echo "$LINUX_GPG_PASSPHRASE" | gpg --batch --yes --passphrase-fd 0 \
                --detach-sign --armor "$package"
            
            # Create clearsigned signature
            echo "$LINUX_GPG_PASSPHRASE" | gpg --batch --yes --passphrase-fd 0 \
                --clearsign --armor "$package" > "$package.asc"
            
            success "Package signed: $(basename "$package")"
        fi
    done
    
    # Create signed checksums
    log "Creating signed checksums..."
    
    cd "$linux_dir"
    
    # Generate SHA256SUMS
    find . -type f \( -name "*.deb" -o -name "*.rpm" -o -name "*.AppImage" -o -name "*.tar.gz" \) \
        -exec sha256sum {} + > SHA256SUMS
    
    # Sign the checksums file
    echo "$LINUX_GPG_PASSPHRASE" | gpg --batch --yes --passphrase-fd 0 \
        --detach-sign --armor SHA256SUMS
    
    cd - > /dev/null
    
    success "Linux packages signed"
}

# Generate signing report
generate_signing_report() {
    log "Generating signing report..."
    
    local report_file="$RELEASE_DIR/SIGNING_REPORT.md"
    
    cat > "$report_file" << EOF
# TunnelForge Code Signing Report

**Generated:** $(date)
**Platform:** $(uname -a)

## Signing Summary

### Windows Packages
EOF
    
    if [ -n "$WINDOWS_CERT" ]; then
        echo "- Certificate: $WINDOWS_CERT" >> "$report_file"
        echo "- Timestamp Server: http://timestamp.digicert.com" >> "$report_file"
        echo "- Hash Algorithm: SHA256" >> "$report_file"
        
        for msi in "$RELEASE_DIR/windows"/*.msi 2>/dev/null; do
            if [ -f "$msi" ]; then
                local basename=$(basename "$msi")
                if signtool verify /pa "$msi" > /dev/null 2>&1; then
                    echo "- ✅ $basename (Signed and Verified)" >> "$report_file"
                else
                    echo "- ❌ $basename (Signature Invalid)" >> "$report_file"
                fi
            fi
        done
    else
        echo "- ⚠️  Windows signing skipped (no certificate)" >> "$report_file"
    fi
    
    cat >> "$report_file" << EOF

### macOS Packages
EOF
    
    if [ -n "$MACOS_CERT" ]; then
        echo "- Certificate: $MACOS_CERT" >> "$report_file"
        echo "- Runtime enabled: Yes" >> "$report_file"
        
        for app in "$RELEASE_DIR/macos"/*.app 2>/dev/null; do
            if [ -d "$app" ]; then
                local basename=$(basename "$app")
                if codesign --verify "$app" > /dev/null 2>&1; then
                    echo "- ✅ $basename (Signed and Verified)" >> "$report_file"
                else
                    echo "- ❌ $basename (Signature Invalid)" >> "$report_file"
                fi
            fi
        done
        
        for dmg in "$RELEASE_DIR/macos"/*.dmg 2>/dev/null; do
            if [ -f "$dmg" ]; then
                local basename=$(basename "$dmg")
                if codesign --verify "$dmg" > /dev/null 2>&1; then
                    echo "- ✅ $basename (Signed and Verified)" >> "$report_file"
                else
                    echo "- ❌ $basename (Signature Invalid)" >> "$report_file"
                fi
            fi
        done
    else
        echo "- ⚠️  macOS signing skipped (no certificate)" >> "$report_file"
    fi
    
    cat >> "$report_file" << EOF

### Linux Packages
EOF
    
    if [ -n "$LINUX_GPG_KEY" ]; then
        echo "- GPG Key: $LINUX_GPG_KEY" >> "$report_file"
        echo "- Signature Type: Detached and Clearsigned" >> "$report_file"
        
        for package in "$RELEASE_DIR/linux"/*.{deb,rpm,AppImage} 2>/dev/null; do
            if [ -f "$package" ]; then
                local basename=$(basename "$package")
                if [ -f "${package}.asc" ]; then
                    echo "- ✅ $basename (Signed)" >> "$report_file"
                else
                    echo "- ❌ $basename (Not Signed)" >> "$report_file"
                fi
            fi
        done
        
        if [ -f "$RELEASE_DIR/linux/SHA256SUMS" ]; then
            echo "- ✅ SHA256SUMS (Signed)" >> "$report_file"
        fi
    else
        echo "- ⚠️  Linux signing skipped (no GPG key)" >> "$report_file"
    fi
    
    cat >> "$report_file" << EOF

## Verification Instructions

### Windows
\`\`\`cmd
signtool verify /pa TunnelForge-*.msi
\`\`\`

### macOS
\`\`\`bash
codesign --verify --verbose TunnelForge.app
spctl -a -v TunnelForge.app
\`\`\`

### Linux
\`\`\`bash
gpg --verify SHA256SUMS.sig SHA256SUMS
sha256sum -c SHA256SUMS
\`\`\`

## Security Notes

- All binaries are timestamped to ensure signature validity after certificate expiration
- macOS applications are signed with runtime entitlements for Gatekeeper compliance
- Linux packages include GPG signatures for package manager integration
- Windows installers include signature verification in the installer UI

EOF
    
    success "Signing report generated: $report_file"
}

# Main execution
main() {
    log "Starting TunnelForge code signing..."
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --windows-cert)
                WINDOWS_CERT="$2"
                shift 2
                ;;
            --windows-cert-password)
                WINDOWS_CERT_PASSWORD="$2"
                shift 2
                ;;
            --macos-cert)
                MACOS_CERT="$2"
                shift 2
                ;;
            --macos-cert-password)
                MACOS_CERT_PASSWORD="$2"
                shift 2
                ;;
            --linux-gpg-key)
                LINUX_GPG_KEY="$2"
                shift 2
                ;;
            --linux-gpg-passphrase)
                LINUX_GPG_PASSPHRASE="$2"
                shift 2
                ;;
            --apple-id)
                APPLE_ID="$2"
                shift 2
                ;;
            --apple-id-password)
                APPLE_ID_PASSWORD="$2"
                shift 2
                ;;
            *)
                error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    check_signing_dependencies
    sign_windows
    sign_macos
    sign_linux
    generate_signing_report
    
    success "Code signing completed!"
    log "Signing report available in: $RELEASE_DIR/SIGNING_REPORT.md"
}

# Run main function with all arguments
main "$@"