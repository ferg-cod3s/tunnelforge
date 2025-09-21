#!/bin/bash

# Get the target directory from cargo or use default
TARGET_DIR="$(cargo metadata --format-version 1 --no-deps | jq -r '.target_directory')"

# Keep only the most recent debug build artifacts
cleanup_debug() {
    local debug_dir="$TARGET_DIR/debug"
    if [ -d "$debug_dir" ]; then
        # Remove old incremental builds
        rm -rf "$debug_dir/incremental"
        
        # Remove old dependencies while keeping the most recent
        if [ -d "$debug_dir/deps" ]; then
            # Keep only files modified in the last 24 hours
            find "$debug_dir/deps" -type f -mtime +1 -delete
        fi
    fi
}

# Clean up old platform-specific builds
cleanup_platform_builds() {
    local platform_dirs=("x86_64-apple-darwin" "x86_64-pc-windows-msvc" "x86_64-unknown-linux-gnu")
    
    for dir in "${platform_dirs[@]}"; do
        local platform_dir="$TARGET_DIR/$dir"
        if [ -d "$platform_dir" ]; then
            # Keep only the most recent release build
            if [ -d "$platform_dir/release" ]; then
                find "$platform_dir/release" -type f -mtime +7 -delete
            fi
        fi
    done
}

# Main cleanup
echo "🧹 Cleaning up old build artifacts..."
cleanup_debug
cleanup_platform_builds
echo "✨ Cleanup complete!"