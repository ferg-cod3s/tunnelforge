#!/bin/bash

# Get the target directory from cargo or use default
TARGET_DIR="$(cargo metadata --format-version 1 --no-deps | jq -r '.target_directory')"
PROFILE="$1" # debug or release
PLATFORM="$2" # platform triple if cross-compiling

echo "🔍 Running post-build cleanup for $PROFILE build..."

if [ "$PROFILE" = "debug" ]; then
    # For debug builds, remove old debug artifacts but keep the current one
    echo "📦 Cleaning old debug artifacts..."
    
    # Get timestamp of newest build
    NEWEST_BUILD=$(find "$TARGET_DIR/debug" -name "tunnelforge*" -type f -exec stat -f "%m" {} \; | sort -nr | head -n1)
    
    if [ -n "$NEWEST_BUILD" ]; then
        # Remove everything older than the newest build
        find "$TARGET_DIR/debug/deps" -type f -not -newermt "@$NEWEST_BUILD" -delete 2>/dev/null
        find "$TARGET_DIR/debug/incremental" -type d -not -newermt "@$NEWEST_BUILD" -exec rm -rf {} + 2>/dev/null
    fi
    
elif [ "$PROFILE" = "release" ]; then
    # For release builds, clean up old release artifacts for the current platform
    echo "📦 Cleaning old release artifacts..."
    
    if [ -n "$PLATFORM" ]; then
        PLATFORM_DIR="$TARGET_DIR/$PLATFORM"
        if [ -d "$PLATFORM_DIR" ]; then
            # Get timestamp of newest release build
            NEWEST_BUILD=$(find "$PLATFORM_DIR/release" -type f -name "tunnelforge*" -exec stat -f "%m" {} \; | sort -nr | head -n1)
            
            if [ -n "$NEWEST_BUILD" ]; then
                # Keep only the newest release build and its dependencies
                find "$PLATFORM_DIR/release" -type f -not -newermt "@$NEWEST_BUILD" -delete 2>/dev/null
            fi
        fi
    else
        # Regular release build
        NEWEST_BUILD=$(find "$TARGET_DIR/release" -name "tunnelforge*" -type f -exec stat -f "%m" {} \; | sort -nr | head -n1)
        
        if [ -n "$NEWEST_BUILD" ]; then
            find "$TARGET_DIR/release" -type f -not -newermt "@$NEWEST_BUILD" -delete 2>/dev/null
        fi
    fi
fi

# Clean empty directories
find "$TARGET_DIR" -type d -empty -delete 2>/dev/null

echo "✨ Cleanup complete!"