#!/usr/bin/env bash

# Script to upgrade GitHub Actions to latest versions
# This fixes the issues identified in the workflow audit

set -euo pipefail

WORKFLOWS_DIR=".github/workflows"

echo "🔧 Upgrading GitHub Actions versions..."

# Function to upgrade actions in a file
upgrade_file() {
    local file="$1"
    echo "  Processing: $file"
    
    # Upgrade upload-artifact from v3 to v4
    sed -i 's/actions\/upload-artifact@v3/actions\/upload-artifact@v4/g' "$file"
    
    # Upgrade download-artifact from v3 to v4 (requires pattern changes)
    sed -i 's/actions\/download-artifact@v3/actions\/download-artifact@v4/g' "$file"
    
    # Upgrade cache from v3 to v4
    sed -i 's/actions\/cache@v3/actions\/cache@v4/g' "$file"
    
    # Upgrade setup-bun from v1 to v2
    sed -i 's/oven-sh\/setup-bun@v1/oven-sh\/setup-bun@v2/g' "$file"
    
    # Pin bun version instead of using latest
    sed -i 's/bun-version: latest/bun-version: '\''1.1.42'\''/g' "$file"
}

# Process all workflow files
find "$WORKFLOWS_DIR" -name "*.yml" -type f | while read -r file; do
    upgrade_file "$file"
done

echo "✅ GitHub Actions versions upgraded!"
echo ""
echo "⚠️  Note: download-artifact@v4 has breaking changes."
echo "   Files now download to 'artifacts/' directory by default."
echo "   Review workflows that use download-artifact@v4."
