#!/bin/bash
echo "=== Test Suite Validation ==="
echo ""

valid=0
invalid=0
total_tests=0
total_lines=0

for f in tests/e2e-web/*.spec.ts; do
  if [ -f "$f" ]; then
    filename=$(basename "$f")
    tests=$(grep -c "test('\\|it(" "$f" 2>/dev/null || echo 0)
    lines=$(wc -l < "$f")
    
    total_tests=$((total_tests + tests))
    total_lines=$((total_lines + lines))
    
    if [ "$tests" -gt 0 ]; then
      echo "✓ $filename ($tests tests, $lines lines)"
      ((valid++))
    else
      echo "✗ $filename - NO TESTS FOUND"
      ((invalid++))
    fi
  fi
done

echo ""
echo "Summary:"
echo "--------"
echo "Valid Files: $valid/21"
echo "Invalid Files: $invalid/21"
echo "Total Tests: $total_tests"
echo "Total Lines: $total_lines"
echo "Avg Tests/File: $(echo "scale=1; $total_tests / 21" | bc)"
echo "Avg Lines/File: $(echo "scale=0; $total_lines / 21" | bc)"
