#!/bin/bash
# TunnelForge Memory Usage Monitor
# Usage: ./monitor-memory.sh <PID> [interval_seconds] [duration_seconds] [output_file]

set -e

pid=${1:-}
interval=${2:-1}
duration=${3:-300}
output_file=${4:-"memory-usage.csv"}

if [ -z "$pid" ]; then
    echo "Usage: $0 <PID> [interval_seconds] [duration_seconds] [output_file]"
    echo "Example: $0 12345 1 300 memory-usage.csv"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Ensure output directory exists
mkdir -p "$(dirname "$output_file")"

echo "Starting memory usage monitoring..."
echo "PID: $pid"
echo "Interval: $interval seconds"
echo "Duration: $duration seconds"
echo "Output file: $output_file"
echo "Timestamp: $(date)"
echo ""

# Detect platform
platform=$(uname -s)

# Create CSV header
echo "timestamp,platform,memory_rss_mb,memory_vms_mb,cpu_percent,threads" > "$output_file"

echo "Monitoring memory usage for PID $pid..."
echo "Press Ctrl+C to stop monitoring early"
echo ""

end_time=$(( $(date +%s) + duration ))
samples=0
total_memory=0
max_memory=0

while [ $(date +%s) -lt "$end_time" ]; do
    timestamp=$(date +%Y%m%d_%H%M%S)
    
    # Get process information (platform-specific)
    case "$platform" in
        "Darwin")
            # macOS
            if ps -p "$pid" > /dev/null 2>&1; then
                # Get memory and CPU info
                process_info=$(ps -o rss,vsz,pcpu,nlwp -p "$pid" 2>/dev/null | tail -1)
                if [ -n "$process_info" ]; then
                    read memory_rss_kb memory_vms_kb cpu_percent threads <<< "$process_info"
                    memory_rss_mb=$(( memory_rss_kb / 1024 ))
                    memory_vms_mb=$(( memory_vms_kb / 1024 ))
                    
                    echo "$timestamp,$platform,$memory_rss_mb,$memory_vms_mb,$cpu_percent,$threads" >> "$output_file"
                    
                    total_memory=$((total_memory + memory_rss_mb))
                    if [ "$memory_rss_mb" -gt "$max_memory" ]; then
                        max_memory=$memory_rss_mb
                    fi
                    samples=$((samples + 1))
                fi
            else
                echo "$timestamp,$platform,0,0,0,0" >> "$output_file"
            fi
            ;;
            
        "Linux")
            # Linux
            if ps -p "$pid" > /dev/null 2>&1; then
                # Get memory and CPU info
                process_info=$(ps -o rss,vsz,pcpu,nlwp -p "$pid" 2>/dev/null | tail -1)
                if [ -n "$process_info" ]; then
                    read memory_rss_kb memory_vms_kb cpu_percent threads <<< "$process_info"
                    memory_rss_mb=$(( memory_rss_kb / 1024 ))
                    memory_vms_mb=$(( memory_vms_kb / 1024 ))
                    
                    echo "$timestamp,$platform,$memory_rss_mb,$memory_vms_mb,$cpu_percent,$threads" >> "$output_file"
                    
                    total_memory=$((total_memory + memory_rss_mb))
                    if [ "$memory_rss_mb" -gt "$max_memory" ]; then
                        max_memory=$memory_rss_mb
                    fi
                    samples=$((samples + 1))
                fi
            else
                echo "$timestamp,$platform,0,0,0,0" >> "$output_file"
            fi
            ;;
            
        "MINGW64_NT"*|"MSYS_NT"*)
            # Windows (Git Bash)
            if ps -p "$pid" > /dev/null 2>&1; then
                # Get memory and CPU info (Windows)
                process_info=$(ps -o rss,vsz,pcpu,nlwp -p "$pid" 2>/dev/null | tail -1)
                if [ -n "$process_info" ]; then
                    read memory_rss_kb memory_vms_kb cpu_percent threads <<< "$process_info"
                    memory_rss_mb=$(( memory_rss_kb / 1024 ))
                    memory_vms_mb=$(( memory_vms_kb / 1024 ))
                    
                    echo "$timestamp,Windows,$memory_rss_mb,$memory_vms_mb,$cpu_percent,$threads" >> "$output_file"
                    
                    total_memory=$((total_memory + memory_rss_mb))
                    if [ "$memory_rss_mb" -gt "$max_memory" ]; then
                        max_memory=$memory_rss_mb
                    fi
                    samples=$((samples + 1))
                fi
            else
                echo "$timestamp,Windows,0,0,0,0" >> "$output_file"
            fi
            ;;
            
        *)
            echo "Error: Unsupported platform: $platform"
            exit 1
            ;;
    esac
    
    # Show progress
    elapsed=$(( $(date +%s) - (end_time - duration) ))
    progress=$(( elapsed * 100 / duration ))
    echo -ne "Progress: $progress% - Memory: ${memory_rss_mb}MB - CPU: ${cpu_percent}% - Samples: $samples\r"
    
    sleep "$interval"
done

echo ""
echo ""
echo "Memory monitoring complete!"
echo "Results summary:"
echo "- Total samples: $samples"
echo "- Average memory usage: $(if [ $samples -gt 0 ]; then echo $((total_memory / samples)); else echo 0; fi) MB"
echo "- Peak memory usage: ${max_memory} MB"
echo "- Results saved to: $output_file"

# Generate summary report
if [ $samples -gt 0 ]; then
    avg_memory=$((total_memory / samples))
else
    avg_memory=0
fi

cat > "$(dirname "$output_file")/memory-summary.txt" << EOF
TunnelForge Memory Usage Monitoring Summary
Generated: $(date)
Platform: $platform
PID: $pid

Duration: $duration seconds
Interval: $interval seconds
Total Samples: $samples

Average Memory Usage: ${avg_memory} MB
Peak Memory Usage: ${max_memory} MB

Target: < 100 MB average
Status: $(if [ "$avg_memory" -lt 100 ]; then echo "✅ PASS"; else echo "❌ FAIL"; fi)

Detailed results: $output_file
