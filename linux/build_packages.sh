#!/bin/bash

# TunnelForge Package Generation Script
# Creates production-ready packages for all platforms

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
VERSION=${VERSION:-$(git describe --tags --always --dirty 2>/dev/null || echo "1.0.0")}
RELEASE_DIR="release"
BUILD_DIR="build"
SIGN_CERT=${SIGN_CERT:-}
SIGN_KEY=${SIGN_KEY:-}

# Platform-specific configurations
WINDOWS_TARGETS=("x86_64-pc-windows-msvc")
MACOS_TARGETS=("x86_64-apple-darwin" "aarch64-apple-darwin")
LINUX_TARGETS=("x86_64-unknown-linux-gnu" "x86_64-unknown-linux-musl")

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

# Clean up function
cleanup() {
    log "Cleaning up build environment..."
    rm -rf "$BUILD_DIR"
}

# Set up trap for cleanup
trap cleanup EXIT INT TERM

# Check dependencies
check_dependencies() {
    log "Checking dependencies..."
    
    local deps=("cargo" "npm" "node" "git")
    local missing=()
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            missing+=("$dep")
        fi
    done
    
    if [ ${#missing[@]} -ne 0 ]; then
        error "Missing dependencies: ${missing[*]}"
        exit 1
    fi
    
    # Check for platform-specific tools
    case "$(uname -s)" in
        Linux)
            if ! command -v "dpkg-deb" &> /dev/null; then
                warning "dpkg-deb not found, DEB package generation disabled"
            fi
            if ! command -v "rpmbuild" &> /dev/null; then
                warning "rpmbuild not found, RPM package generation disabled"
            fi
            if ! command -v "appimagetool" &> /dev/null; then
                warning "appimagetool not found, AppImage generation disabled"
            fi
            ;;
        Darwin)
            if ! command -v "create-dmg" &> /dev/null; then
                warning "create-dmg not found, DMG generation may not work optimally"
            fi
            ;;
        MINGW*|CYGWIN*|MSYS*)
            if ! command -v "makensis" &> /dev/null; then
                warning "makensis not found, NSIS installer generation disabled"
            fi
            ;;
    esac
    
    success "Dependencies checked"
}

# Prepare build environment
prepare_build() {
    log "Preparing build environment..."
    
    # Create directories
    mkdir -p "$RELEASE_DIR"
    mkdir -p "$BUILD_DIR"
    
    # Install Rust targets
    for target in "${WINDOWS_TARGETS[@]}" "${MACOS_TARGETS[@]}" "${LINUX_TARGETS[@]}"; do
        if ! rustup target list --installed | grep -q "$target"; then
            log "Installing Rust target: $target"
            rustup target add "$target"
        fi
    done
    
    # Build web frontend
    log "Building web frontend..."
    cd ../web
    npm ci
    npm run build
    cd - > /dev/null
    
    success "Build environment prepared"
}

# Build for Windows
build_windows() {
    log "Building Windows packages..."
    
    for target in "${WINDOWS_TARGETS[@]}"; do
        log "Building for Windows target: $target"
        
        # Build Tauri app
        cargo tauri build --target "$target"
        
        local target_dir="src-tauri/target/$target/release"
        local bundle_dir="$target_dir/bundle"
        
        # Sign executables if certificate is provided
        if [ -n "$SIGN_CERT" ] && [ -n "$SIGN_KEY" ]; then
            log "Signing Windows executables..."
            for exe in "$target_dir"/*.exe; do
                if [ -f "$exe" ]; then
                    # Windows code signing would go here
                    log "Would sign: $exe"
                fi
            done
        fi
        
        # Copy packages to release directory
        mkdir -p "$RELEASE_DIR/windows"
        cp -r "$bundle_dir"/* "$RELEASE_DIR/windows/" 2>/dev/null || true
        
        # Rename packages with version
        for package in "$RELEASE_DIR/windows"/*; do
            if [ -f "$package" ]; then
                local basename=$(basename "$package")
                local extension="${basename##*.}"
                local name="${basename%.*}"
                mv "$package" "$RELEASE_DIR/windows/TunnelForge-${VERSION}-${name}.${extension}"
            fi
        done
        
        success "Windows build completed for $target"
    done
}

# Build for macOS
build_macos() {
    log "Building macOS packages..."
    
    for target in "${MACOS_TARGETS[@]}"; do
        log "Building for macOS target: $target"
        
        # Build Tauri app
        cargo tauri build --target "$target"
        
        local target_dir="src-tauri/target/$target/release"
        local bundle_dir="$target_dir/bundle"
        
        # Sign applications if certificate is provided
        if [ -n "$SIGN_CERT" ]; then
            log "Signing macOS applications..."
            for app in "$bundle_dir"/*.app; do
                if [ -d "$app" ]; then
                    # macOS code signing would go here
                    log "Would sign: $app"
                fi
            done
        fi
        
        # Create DMG if not already created
        if [ ! -f "$bundle_dir"/*.dmg ]; then
            log "Creating DMG..."
            local app_name=$(find "$bundle_dir" -name "*.app" -exec basename {} \;)
            if [ -n "$app_name" ]; then
                create-dmg \
                    --volname "TunnelForge" \
                    --window-pos 200 120 \
                    --window-size 600 300 \
                    --icon-size 100 \
                    --icon "$app_name" 175 120 \
                    --hide-extension "$app_name" \
                    --app-drop-link 425 120 \
                    "$bundle_dir/$app_name" \
                    "$bundle_dir/TunnelForge-${VERSION}.dmg" || {
                    warning "DMG creation failed, using fallback method"
                    hdiutil create -volname "TunnelForge" -srcfolder "$bundle_dir/$app_name" -ov -format UDZO "$bundle_dir/TunnelForge-${VERSION}.dmg"
                }
            fi
        fi
        
        # Copy packages to release directory
        mkdir -p "$RELEASE_DIR/macos"
        cp -r "$bundle_dir"/* "$RELEASE_DIR/macos/" 2>/dev/null || true
        
        # Rename packages with version
        for package in "$RELEASE_DIR/macos"/*; do
            if [ -f "$package" ]; then
                local basename=$(basename "$package")
                local extension="${basename##*.}"
                local name="${basename%.*}"
                mv "$package" "$RELEASE_DIR/macos/TunnelForge-${VERSION}-${name}.${extension}"
            fi
        done
        
        success "macOS build completed for $target"
    done
}

# Build for Linux
build_linux() {
    log "Building Linux packages..."
    
    for target in "${LINUX_TARGETS[@]}"; do
        log "Building for Linux target: $target"
        
        # Build Tauri app
        cargo tauri build --target "$target"
        
        local target_dir="src-tauri/target/$target/release"
        local bundle_dir="$target_dir/bundle"
        
        # Create AppImage if appimagetool is available
        if command -v appimagetool &> /dev/null; then
            log "Creating AppImage..."
            
            local app_dir="$BUILD_DIR/TunnelForge.AppDir"
            mkdir -p "$app_dir/usr/bin"
            mkdir -p "$app_dir/usr/share/applications"
            mkdir -p "$app_dir/usr/share/icons/hicolor/256x256/apps"
            
            # Copy executable
            cp "$target_dir/tunnelforge" "$app_dir/usr/bin/"
            
            # Create desktop file
            cat > "$app_dir/usr/share/applications/tunnelforge.desktop" << EOF
[Desktop Entry]
Type=Application
Name=TunnelForge
Comment=Terminal sharing with web interface
Exec=tunnelforge
Icon=tunnelforge
Categories=Development;Network;
EOF
            
            # Copy icon (if available)
            if [ -f "icons/icon.png" ]; then
                cp icons/icon.png "$app_dir/usr/share/icons/hicolor/256x256/apps/tunnelforge.png"
            fi
            
            # Create AppRun
            cat > "$app_dir/AppRun" << 'EOF'
#!/bin/sh
HERE="$(dirname "$(readlink -f "${0}")")"
export PATH="${HERE}/usr/bin/:${PATH}"
export LD_LIBRARY_PATH="${HERE}/usr/lib/:${LD_LIBRARY_PATH}"
exec "${HERE}/usr/bin/tunnelforge" "$@"
EOF
            chmod +x "$app_dir/AppRun"
            
            # Create AppImage
            appimagetool "$app_dir" "$bundle_dir/TunnelForge-${VERSION}-x86_64.AppImage" || {
                warning "AppImage creation failed"
            }
        fi
        
        # Copy packages to release directory
        mkdir -p "$RELEASE_DIR/linux"
        cp -r "$bundle_dir"/* "$RELEASE_DIR/linux/" 2>/dev/null || true
        
        # Rename packages with version
        for package in "$RELEASE_DIR/linux"/*; do
            if [ -f "$package" ]; then
                local basename=$(basename "$package")
                local extension="${basename##*.}"
                local name="${basename%.*}"
                mv "$package" "$RELEASE_DIR/linux/TunnelForge-${VERSION}-${name}.${extension}"
            fi
        done
        
        success "Linux build completed for $target"
    done
}

# Generate checksums
generate_checksums() {
    log "Generating checksums..."
    
    cd "$RELEASE_DIR"
    
    # Generate SHA256 checksums
    find . -type f -exec sha256sum {} + > SHA256SUMS
    
    # Generate MD5 checksums for legacy compatibility
    find . -type f -exec md5sum {} + > MD5SUMS 2>/dev/null || {
        warning "md5sum not available, skipping MD5 checksums"
    }
    
    cd - > /dev/null
    
    success "Checksums generated"
}

# Create release notes
create_release_notes() {
    log "Creating release notes..."
    
    cat > "$RELEASE_DIR/RELEASE_NOTES.md" << EOF
# TunnelForge v${VERSION}

## Installation

### Windows
- Download the MSI installer: \`TunnelForge-${VERSION}-msi.msi\`
- Run the installer and follow the setup wizard

### macOS
- Download the DMG file: \`TunnelForge-${VERSION}-dmg.dmg\`
- Open the DMG and drag TunnelForge to Applications

### Linux
- Ubuntu/Debian: \`sudo dpkg -i TunnelForge-${VERSION}-deb.deb\`
- Red Hat/Fedora: \`sudo rpm -i TunnelForge-${VERSION}-rpm.rpm\`
- AppImage: Download and run \`TunnelForge-${VERSION}-x86_64.AppImage\`

## Verification

All packages can be verified using the provided checksums:

\`\`\`bash
# Verify SHA256
sha256sum -c SHA256SUMS

# Verify MD5 (if available)
md5sum -c MD5SUMS
\`\`\`

## What's New

$(git log --pretty=format:"- %s" "$(git describe --tags --abbrev=0 HEAD^)"..HEAD 2>/dev/null || echo "- Initial release")

## System Requirements

- Windows 10 or later
- macOS 10.15 or later
- Linux (glibc 2.17 or later)

## Support

- Documentation: https://docs.tunnelforge.com
- Issues: https://github.com/ferg-cod3s/tunnelforge/issues
- Community: https://discord.gg/tunnelforge

EOF
    
    success "Release notes created"
}

# Main execution
main() {
    log "Starting TunnelForge package generation..."
    log "Version: $VERSION"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --version)
                VERSION="$2"
                shift 2
                ;;
            --windows-only)
                WINDOWS_ONLY=true
                shift
                ;;
            --macos-only)
                MACOS_ONLY=true
                shift
                ;;
            --linux-only)
                LINUX_ONLY=true
                shift
                ;;
            --no-sign)
                NO_SIGN=true
                shift
                ;;
            *)
                error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    check_dependencies
    prepare_build
    
    # Build for requested platforms
    if [ "${WINDOWS_ONLY:-false}" = "true" ]; then
        build_windows
    elif [ "${MACOS_ONLY:-false}" = "true" ]; then
        build_macos
    elif [ "${LINUX_ONLY:-false}" = "true" ]; then
        build_linux
    else
        # Build for current platform only by default
        case "$(uname -s)" in
            Linux*)
                build_linux
                ;;
            Darwin*)
                build_macos
                ;;
            MINGW*|CYGWIN*|MSYS*)
                build_windows
                ;;
            *)
                error "Unsupported platform: $(uname -s)"
                exit 1
                ;;
        esac
    fi
    
    generate_checksums
    create_release_notes
    
    success "Package generation completed!"
    log "Packages available in: $RELEASE_DIR"
    log "Total packages: $(find $RELEASE_DIR -type f -name "*TunnelForge*" | wc -l)"
}

# Run main function with all arguments
main "$@"