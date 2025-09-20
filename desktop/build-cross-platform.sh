#!/bin/bash

# TunnelForge Cross-Platform Build Script
# This script uses Docker containers to build Tauri apps for Windows and Linux from macOS

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Build Docker images if they don't exist
print_status "Building Docker images for cross-compilation..."

if ! docker images | grep -q "tunnelforge-windows-builder"; then
    print_status "Building Windows cross-compilation image..."
    docker build -f docker/Dockerfile.windows -t tunnelforge-windows-builder .
fi

if ! docker images | grep -q "tunnelforge-linux-builder"; then
    print_status "Building Linux cross-compilation image..."
    docker build -f docker/Dockerfile.linux -t tunnelforge-linux-builder .
fi

# Function to build for a specific platform
build_platform() {
    local platform=$1
    local image_name=$2
    local target=$3
    local output_name=$4
    
    print_status "Building TunnelForge for $platform..."
    
    # Create output directory
    mkdir -p "dist/$platform"
    
    # Run build in Docker container
    docker run --rm -v "$(pwd):/app" -w /app "$image_name" bash -c "
        # Install dependencies
        cd /app && bun install
        
        # Build web frontend
        cd /app && bun run build:web
        
        # Build Tauri app
        cd /app && bun run tauri build --target $target --no-bundle
        
        # Copy built artifacts
        cp -r src-tauri/target/$target/release/bundle/* dist/$platform/ 2>/dev/null || true
        cp -r src-tauri/target/release/* dist/$platform/ 2>/dev/null || true
    "
    
    if [ $? -eq 0 ]; then
        print_status "✅ Successfully built TunnelForge for $platform"
    else
        print_error "❌ Failed to build TunnelForge for $platform"
        return 1
    fi
}

# Build for Windows
build_platform "Windows" "tunnelforge-windows-builder" "x86_64-pc-windows-msvc" "windows"

# Build for Linux
build_platform "Linux" "tunnelforge-linux-builder" "x86_64-unknown-linux-gnu" "linux"

# Build for macOS (native)
print_status "Building TunnelForge for macOS (native)..."
bun run build:web
bun run tauri build --target x86_64-apple-darwin

if [ $? -eq 0 ]; then
    print_status "✅ Successfully built TunnelForge for macOS"
    mkdir -p "dist/macos"
    cp -r src-tauri/target/x86_64-apple-darwin/release/bundle/* dist/macos/ 2>/dev/null || true
    cp -r src-tauri/target/x86_64-apple-darwin/release/* dist/macos/ 2>/dev/null || true
else
    print_error "❌ Failed to build TunnelForge for macOS"
    exit 1
fi

print_status "🎉 Cross-platform build completed!"
print_status "Built artifacts are available in the 'dist' directory:"
ls -la dist/

