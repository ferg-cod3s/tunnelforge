#!/bin/bash
# TunnelForge Startup Performance Benchmark
# Usage: ./benchmark-startup.sh [iterations] [output_file]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

iterations=${1:-50}
output_file=${2:-"$PROJECT_ROOT/benchmark-results/startup-times.csv"}
log_file="$PROJECT_ROOT/benchmark-results/startup-benchmark.log"

# Ensure output directory exists
mkdir -p "$(dirname "$output_file")"
mkdir -p "$(dirname "$log_file")"

echo "Starting TunnelForge startup performance benchmark..."
echo "Iterations: $iterations"
echo "Output file: $output_file"
echo "Log file: $log_file"
echo "Timestamp: $(date)"
echo ""

# Create CSV header
echo "timestamp,platform,architecture,startup_time_ms,memory_peak_mb,cpu_peak_percent,exit_code" > "$output_file"

# Detect platform and architecture
platform=$(uname -s)
architecture=$(uname -m)

echo "Platform: $platform"
echo "Architecture: $architecture"
echo ""

success_count=0
total_time=0

for i in $(seq 1 "$iterations"); do
    echo "Running iteration $i/$iterations..."
    
    timestamp=$(date +%Y%m%d_%H%M%S)
    iteration_start=$(date +%s%N)
    
    # Start application (platform-specific)
    case "$platform" in
        "Darwin")
            # macOS
            app_pid=""
            memory_peak=0
            cpu_peak=0
            
            # Launch application
            open -a TunnelForge --wait-apps --new --hide 2>/dev/null &
            app_pid=$!
            
            # Wait for startup
            sleep 5
            
            # Monitor memory and CPU during startup
            if [ -n "$app_pid" ] && ps -p "$app_pid" > /dev/null 2>&1; then
                # Get memory and CPU usage
                sample_output=$(ps -o rss,pcpu -p "$app_pid" 2>/dev/null | tail -1)
                if [ -n "$sample_output" ]; then
                    read memory_kb cpu_percent <<< "$sample_output"
                    memory_mb=$(( memory_kb / 1024 ))
                    memory_peak=$memory_mb
                    cpu_peak=$cpu_percent
                fi
            fi
            ;;
            
        "Linux")
            # Linux
            app_pid=""
            memory_peak=0
            cpu_peak=0
            
            # Launch application (adjust path as needed)
            if [ -f "$PROJECT_ROOT/linux/target/release/tunnelforge" ]; then
                "$PROJECT_ROOT/linux/target/release/tunnelforge" &
                app_pid=$!
            elif [ -f "$PROJECT_ROOT/desktop/src-tauri/target/release/tunnelforge" ]; then
                "$PROJECT_ROOT/desktop/src-tauri/target/release/tunnelforge" &
                app_pid=$!
            else
                echo "Error: TunnelForge binary not found"
                exit 1
            fi
            
            # Wait for startup
            sleep 5
            
            # Monitor memory and CPU during startup
            if [ -n "$app_pid" ] && ps -p "$app_pid" > /dev/null 2>&1; then
                sample_output=$(ps -o rss,pcpu -p "$app_pid" 2>/dev/null | tail -1)
                if [ -n "$sample_output" ]; then
                    read memory_kb cpu_percent <<< "$sample_output"
                    memory_mb=$(( memory_kb / 1024 ))
                    memory_peak=$memory_mb
                    cpu_peak=$cpu_percent
                fi
            fi
            ;;
            
        "MINGW64_NT"*|"MSYS_NT"*)
            # Windows (Git Bash)
            app_pid=""
            memory_peak=0
            cpu_peak=0
            
            # Launch application (adjust path as needed)
            if [ -f "$PROJECT_ROOT/windows/target/release/tunnelforge.exe" ]; then
                "$PROJECT_ROOT/windows/target/release/tunnelforge.exe" &
                app_pid=$!
            else
                echo "Error: TunnelForge.exe not found"
                exit 1
            fi
            
            # Wait for startup
            sleep 5
            
            # Monitor memory and CPU during startup
            if [ -n "$app_pid" ] && ps -p "$app_pid" > /dev/null 2>&1; then
                sample_output=$(ps -o rss,pcpu -p "$app_pid" 2>/dev/null | tail -1)
                if [ -n "$sample_output" ]; then
                    read memory_kb cpu_percent <<< "$sample_output"
                    memory_mb=$(( memory_kb / 1024 ))
                    memory_peak=$memory_mb
                    cpu_peak=$cpu_percent
                fi
            fi
            ;;
            
        *)
            echo "Error: Unsupported platform: $platform"
            exit 1
            ;;
    esac
    
    iteration_end=$(date +%s%N)
    startup_time_ms=$(( (iteration_end - iteration_start) / 1000000 ))
    
    # Check if application is still running
    exit_code=0
    if [ -n "$app_pid" ] && ! ps -p "$app_pid" > /dev/null 2>&1; then
        exit_code=1
    fi
    
    # Record results
    echo "$timestamp,$platform,$architecture,$startup_time_ms,$memory_peak,$cpu_peak,$exit_code" >> "$output_file"
    
    # Clean up
    if [ -n "$app_pid" ] && ps -p "$app_pid" > /dev/null 2>&1; then
        kill "$app_pid" 2>/dev/null
        wait "$app_pid" 2>/dev/null
    fi
    
    # Update statistics
    if [ "$exit_code" -eq 0 ]; then
        success_count=$((success_count + 1))
        total_time=$((total_time + startup_time_ms))
    fi
    
    echo "Iteration $i completed: ${startup_time_ms}ms, Memory: ${memory_peak}MB, CPU: ${cpu_peak}%, Exit: $exit_code"
    
    # Wait between iterations
    sleep 2
done

# Calculate final statistics
if [ "$success_count" -gt 0 ]; then
    avg_time=$((total_time / success_count))
else
    avg_time=0
fi

echo ""
echo "Benchmarking complete!"
echo "Results summary:"
echo "- Total iterations: $iterations"
echo "- Successful iterations: $success_count"
echo "- Success rate: $((success_count * 100 / iterations))%"
echo "- Average startup time: ${avg_time}ms"
echo "- Results saved to: $output_file"
echo "- Log saved to: $log_file"

# Generate summary report
cat > "$PROJECT_ROOT/benchmark-results/startup-summary.txt" << EOF
TunnelForge Startup Performance Benchmark Summary
Generated: $(date)
Platform: $platform
Architecture: $architecture

Iterations: $iterations
Successful: $success_count
Success Rate: $((success_count * 100 / iterations))%
Average Startup Time: ${avg_time}ms

Target: < 2000ms
Status: $(if [ "$avg_time" -lt 2000 ]; then echo "✅ PASS"; else echo "❌ FAIL"; fi)

Detailed results: $output_file
