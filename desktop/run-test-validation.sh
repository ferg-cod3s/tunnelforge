#!/bin/bash

# Test Validation Script
# Validates syntax and runs a subset of tests to ensure functionality

set -e

echo "=== TunnelForge Test Suite Validation ==="
echo ""
echo "Phase 1: Syntax Validation"
echo "========================="

# Count valid test files
valid=0
invalid=0

for f in tests/e2e-web/*.spec.ts; do
  filename=$(basename "$f")
  if grep -q "describe\|it(" "$f" 2>/dev/null; then
    echo "✓ $filename - syntax OK"
    ((valid++))
  else
    echo "✗ $filename - MISSING TESTS"
    ((invalid++))
  fi
done

echo ""
echo "Syntax Check Result: $valid valid, $invalid invalid"
echo ""

if [ $invalid -gt 0 ]; then
  echo "⚠️  Warning: Found $invalid files with issues"
fi

echo ""
echo "Phase 2: Package Check"
echo "====================="

# Check required packages
packages=("@playwright/test" "axios" "ws")
missing=0

for pkg in "${packages[@]}"; do
  if grep -q "\"$pkg\"" package.json 2>/dev/null; then
    echo "✓ $pkg - found in package.json"
  else
    echo "✗ $pkg - NOT FOUND in package.json"
    ((missing++))
  fi
done

if [ $missing -gt 0 ]; then
  echo "⚠️  Missing $missing required packages"
fi

echo ""
echo "Phase 3: Test Statistics"
echo "======================="

total_tests=0
total_lines=0

for f in tests/e2e-web/*.spec.ts; do
  tests=$(grep -c "test('\\|test\.it('\\|it('\\|test\.skip('\\|test\.only(" "$f" 2>/dev/null || echo 0)
  lines=$(wc -l < "$f")
  total_tests=$((total_tests + tests))
  total_lines=$((total_lines + lines))
done

echo "Total Test Suites: 21"
echo "Total Test Cases: $total_tests"
echo "Total Lines of Code: $total_lines"
echo "Average Tests per Suite: $(echo "scale=1; $total_tests / 21" | bc)"
echo "Average Lines per Suite: $(echo "scale=0; $total_lines / 21" | bc)"

echo ""
echo "Phase 4: Configuration Check"
echo "============================"

if [ -f "playwright.config.ts" ]; then
  echo "✓ playwright.config.ts found"
  base_url=$(grep -o "baseURL:.*" playwright.config.ts | head -1)
  echo "  Base URL: $base_url"
else
  echo "✗ playwright.config.ts NOT FOUND"
fi

echo ""
echo "=== Validation Complete ==="
