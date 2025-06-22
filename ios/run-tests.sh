#!/bin/bash

# Run iOS tests for VibeTunnel using xcodebuild
# This script properly runs tests on iOS simulator using Swift Testing framework

set -e

echo "Running iOS tests on simulator..."

# Find an available iOS simulator
# First, list available devices for debugging
echo "Available simulators:"
xcrun simctl list devices available | grep -E "iPhone" || true

# Try to find iOS 18 simulator first, then fall back to any available iPhone
SIMULATOR_ID=$(xcrun simctl list devices available | grep -E "iPhone.*iOS 18" | head -1 | awk -F'[()]' '{print $2}')

if [ -z "$SIMULATOR_ID" ]; then
    echo "No iOS 18 simulator found, looking for any iPhone simulator..."
    SIMULATOR_ID=$(xcrun simctl list devices available | grep -E "iPhone" | head -1 | awk -F'[()]' '{print $2}')
fi

if [ -z "$SIMULATOR_ID" ]; then
    echo "Error: No iPhone simulator found. Creating one..."
    # Get the latest iOS runtime
    RUNTIME=$(xcrun simctl list runtimes | grep "iOS" | tail -1 | awk '{print $NF}')
    echo "Using runtime: $RUNTIME"
    SIMULATOR_ID=$(xcrun simctl create "Test iPhone" "iPhone 15" "$RUNTIME" || xcrun simctl create "Test iPhone" "com.apple.CoreSimulator.SimDeviceType.iPhone-15" "$RUNTIME")
fi

echo "Using simulator: $SIMULATOR_ID"

# Boot the simulator if needed
xcrun simctl boot "$SIMULATOR_ID" 2>/dev/null || true

# Clean up any existing test results
rm -rf TestResults.xcresult

# Run tests using xcodebuild with proper destination
set -o pipefail

# Check if xcpretty is available
if command -v xcpretty &> /dev/null; then
    echo "Running tests with xcpretty formatter..."
    xcodebuild test \
        -project VibeTunnel.xcodeproj \
        -scheme VibeTunnel \
        -destination "platform=iOS Simulator,id=$SIMULATOR_ID" \
        -resultBundlePath TestResults.xcresult \
        2>&1 | xcpretty || {
            EXIT_CODE=$?
            echo "Tests failed with exit code: $EXIT_CODE"
            
            # Try to extract test failures
            if [ -d "TestResults.xcresult" ]; then
                xcrun xcresulttool get --format human-readable --path TestResults.xcresult 2>/dev/null || true
            fi
            
            # Shutdown simulator
            xcrun simctl shutdown "$SIMULATOR_ID" 2>/dev/null || true
            
            exit $EXIT_CODE
        }
else
    echo "Running tests without xcpretty..."
    xcodebuild test \
        -project VibeTunnel.xcodeproj \
        -scheme VibeTunnel \
        -destination "platform=iOS Simulator,id=$SIMULATOR_ID" \
        -resultBundlePath TestResults.xcresult \
        || {
            EXIT_CODE=$?
            echo "Tests failed with exit code: $EXIT_CODE"
            
            # Try to extract test failures
            if [ -d "TestResults.xcresult" ]; then
                xcrun xcresulttool get --format human-readable --path TestResults.xcresult 2>/dev/null || true
            fi
            
            # Shutdown simulator
            xcrun simctl shutdown "$SIMULATOR_ID" 2>/dev/null || true
            
            exit $EXIT_CODE
        }
fi

# Shutdown simulator
xcrun simctl shutdown "$SIMULATOR_ID" 2>/dev/null || true

echo "Tests completed successfully!"