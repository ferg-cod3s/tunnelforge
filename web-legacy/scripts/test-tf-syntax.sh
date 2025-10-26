#!/bin/bash
# Test script to validate tf command syntax and basic functionality
# This can be run as part of the build process to catch issues early

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TF_SCRIPT="$PROJECT_ROOT/bin/tf"

echo "Testing tf command syntax and functionality..."

# Test 1: Check if tf script exists
if [ ! -f "$TF_SCRIPT" ]; then
    echo "❌ ERROR: tf script not found at $TF_SCRIPT"
    exit 1
fi
echo "✅ tf script exists"

# Test 2: Check if tf script is executable
if [ ! -x "$TF_SCRIPT" ]; then
    echo "❌ ERROR: tf script is not executable"
    exit 1
fi
echo "✅ tf script is executable"

# Test 3: Validate bash syntax
if ! bash -n "$TF_SCRIPT" 2>/dev/null; then
    echo "❌ ERROR: tf script has syntax errors"
    bash -n "$TF_SCRIPT" # Show the actual errors
    exit 1
fi
echo "✅ tf script has valid bash syntax"

# Test 4: Check if tf script contains required functions
if ! grep -q "show_help()" "$TF_SCRIPT"; then
    echo "❌ ERROR: tf script missing show_help() function"
    exit 1
fi
echo "✅ tf script contains show_help() function"

if ! grep -q "resolve_command()" "$TF_SCRIPT"; then
    echo "❌ ERROR: tf script missing resolve_command() function"
    exit 1
fi
echo "✅ tf script contains resolve_command() function"

# Test 5: Check for empty if statements (the bug we fixed)
# Use a simpler approach that works on macOS
if awk '/if.*then/{start=NR; in_if=1; has_content=0} in_if && !/^[[:space:]]*#/ && !/^[[:space:]]*$/ && !/if.*then/ && !/fi$/{has_content=1} /^[[:space:]]*fi$/ && in_if{if(!has_content) print "Empty if at line " start; in_if=0}' "$TF_SCRIPT" | grep -q .; then
    echo "❌ ERROR: tf script contains empty if statements"
    exit 1
fi
echo "✅ tf script has no empty if statements"

# Test 6: Check that package.json does NOT include tf in bin section
# (tf is installed conditionally via postinstall script to avoid conflicts)
PACKAGE_JSON="$PROJECT_ROOT/package.json"
if [ -f "$PACKAGE_JSON" ]; then
    if grep -q '"tf".*:.*"./bin/tf"' "$PACKAGE_JSON"; then
        echo "❌ ERROR: package.json should NOT include tf in bin section"
        echo "   tf must be installed conditionally via postinstall to avoid conflicts"
        exit 1
    fi
    echo "✅ package.json correctly omits tf from bin section (installed conditionally)"
fi

# Test 7: Basic functionality test (help command)
# Skip if already inside a TunnelForge session (recursive sessions not supported)
if [ -n "$TUNNELFORGE_SESSION_ID" ]; then
    echo "⚠️  Skipping tf --help test (already inside TunnelForge session)"
else
    # Use gtimeout if available, otherwise skip timeout
    if command -v gtimeout >/dev/null 2>&1; then
        if ! gtimeout 5 "$TF_SCRIPT" --help >/dev/null 2>&1; then
            echo "❌ ERROR: tf --help command failed or timed out"
            exit 1
        fi
    else
        # On macOS without gtimeout, just test that it doesn't immediately fail
        if ! "$TF_SCRIPT" --help >/dev/null 2>&1; then
            echo "❌ ERROR: tf --help command failed"
            exit 1
        fi
    fi
    echo "✅ tf --help command works"
fi

echo "🎉 All tf command tests passed!"