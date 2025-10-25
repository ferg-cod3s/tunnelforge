#!/bin/bash

# TunnelForge Beta Feedback Collection System
# This script collects and processes feedback from various sources

set -euo pipefail

# Configuration
FEEDBACK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INCOMING_DIR="$FEEDBACK_DIR/incoming"
PROCESSED_DIR="$FEEDBACK_DIR/processed"
ANALYTICS_DIR="$FEEDBACK_DIR/analytics"
BETA_ROOT="$(dirname "$FEEDBACK_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Ensure directories exist
setup_directories() {
    mkdir -p "$INCOMING_DIR" "$PROCESSED_DIR" "$ANALYTICS_DIR"
    mkdir -p "$INCOMING_DIR"/{web,email,discord,github,automated}
}

# Collect feedback from web form
collect_web_feedback() {
    log_info "Collecting web feedback..."
    
    # Simulate web feedback collection
    # In real implementation, this would connect to your web backend
    local web_feedback_file="$INCOMING_DIR/web/web_feedback_$(date +%Y%m%d_%H%M%S).json"
    
    cat > "$web_feedback_file" << 'EOF'
{
    "source": "web",
    "type": "bug",
    "severity": "medium",
    "platform": "windows",
    "version": "2024.01.27-beta",
    "user_id": "web_user_123",
    "category": "server",
    "title": "Server fails to start on Windows 11",
    "description": "When I try to start the TunnelForge server, it immediately crashes with an error message.",
    "steps": [
        "Open TunnelForge application",
        "Click 'Start Server'",
        "Server crashes immediately"
    ],
    "expected": "Server should start successfully",
    "actual": "Server crashes with error code 0x80070005",
    "attachments": [],
    "system_info": {
        "os": "Windows 11 Pro",
        "architecture": "x64",
        "memory": "16GB",
        "available_disk": "45GB"
    }
}
EOF

    log_success "Web feedback collected: $web_feedback_file"
}

# Collect feedback from email
collect_email_feedback() {
    log_info "Collecting email feedback..."
    
    # Simulate email feedback collection
    # In real implementation, this would parse emails from beta@tunnelforge.dev
    local email_feedback_file="$INCOMING_DIR/email/email_feedback_$(date +%Y%m%d_%H%M%S).json"
    
    cat > "$email_feedback_file" << 'EOF'
{
    "source": "email",
    "type": "feature",
    "severity": "enhancement",
    "platform": "macos",
    "version": "2024.01.27-beta",
    "user_id": "email_user_456",
    "category": "ui",
    "title": "Add dark mode to macOS application",
    "description": "It would be great to have a dark mode option for the TunnelForge macOS app to match system preferences.",
    "use_case": "I work in low-light environments and prefer dark interfaces to reduce eye strain.",
    "expected": "Application should respect system dark mode setting",
    "actual": "Application only shows light interface",
    "attachments": [],
    "system_info": {
        "os": "macOS Sonoma 14.2",
        "architecture": "arm64",
        "memory": "32GB",
        "available_disk": "120GB"
    }
}
EOF

    log_success "Email feedback collected: $email_feedback_file"
}

# Collect feedback from Discord
collect_discord_feedback() {
    log_info "Collecting Discord feedback..."
    
    # Simulate Discord feedback collection
    # In real implementation, this would use Discord API or webhooks
    local discord_feedback_file="$INCOMING_DIR/discord/discord_feedback_$(date +%Y%m%d_%H%M%S).json"
    
    cat > "$discord_feedback_file" << 'EOF'
{
    "source": "discord",
    "type": "usability",
    "severity": "minor",
    "platform": "linux",
    "version": "2024.01.27-beta",
    "user_id": "discord_user_789",
    "category": "installation",
    "title": "Linux installation instructions unclear for Ubuntu",
    "description": "The installation instructions for Ubuntu 22.04 are confusing. The apt repository setup doesn't work as documented.",
    "scenario": "Trying to install TunnelForge on fresh Ubuntu 22.04 system",
    "expected": "Clear step-by-step installation instructions",
    "actual": "Repository setup fails with GPG key error",
    "attachments": ["screenshot.png"],
    "system_info": {
        "os": "Ubuntu 22.04 LTS",
        "architecture": "x64",
        "memory": "8GB",
        "available_disk": "25GB"
    }
}
EOF

    log_success "Discord feedback collected: $discord_feedback_file"
}

# Collect feedback from GitHub issues
collect_github_feedback() {
    log_info "Collecting GitHub feedback..."
    
    # Simulate GitHub feedback collection
    # In real implementation, this would use GitHub API
    local github_feedback_file="$INCOMING_DIR/github/github_feedback_$(date +%Y%m%d_%H%M%S).json"
    
    cat > "$github_feedback_file" << 'EOF'
{
    "source": "github",
    "type": "performance",
    "severity": "high",
    "platform": "windows",
    "version": "2024.01.27-beta",
    "user_id": "github_user_101",
    "category": "network",
    "title": "High memory usage during file transfers",
    "description": "When transferring large files (>1GB), memory usage spikes to over 2GB and doesn't release after transfer completes.",
    "system_info": {
        "os": "Windows 10 Pro",
        "architecture": "x64",
        "memory": "16GB",
        "available_disk": "80GB"
    },
    "performance_data": {
        "baseline_memory": "150MB",
        "peak_memory": "2.1GB",
        "transfer_size": "1.5GB",
        "transfer_duration": "45 seconds"
    },
    "reproduction_rate": "Always",
    "workaround": "Restart application after large transfers"
}
EOF

    log_success "GitHub feedback collected: $github_feedback_file"
}

# Collect automated crash reports
collect_automated_feedback() {
    log_info "Collecting automated feedback..."
    
    # Simulate automated crash reports
    # In real implementation, this would collect crash dumps and telemetry
    local automated_feedback_file="$INCOMING_DIR/automated/crash_report_$(date +%Y%m%d_%H%M%S).json"
    
    cat > "$automated_feedback_file" << 'EOF'
{
    "source": "automated",
    "type": "crash",
    "severity": "critical",
    "platform": "macos",
    "version": "2024.01.27-beta",
    "user_id": "auto_user_202",
    "category": "server",
    "title": "Application crash during tunnel service initialization",
    "description": "Application crashes with segmentation fault when initializing Cloudflare tunnel service",
    "crash_info": {
        "signal": "SIGSEGV",
        "stack_trace": [
            "0x0000000100051234 in tunnel_service_init()",
            "0x0000000100045678 in server_startup()",
            "0x0000000100039012 in main()"
        ],
        "registers": {
            "rip": "0x0000000100051234",
            "rsp": "0x00007ff7b1234567",
            "rbp": "0x00007ff7b1234567"
        }
    },
    "system_info": {
        "os": "macOS Ventura 13.6",
        "architecture": "arm64",
        "memory": "16GB",
        "available_disk": "60GB"
    },
    "application_state": {
        "uptime": "2 minutes",
        "active_sessions": 0,
        "configured_tunnels": 1
    }
}
EOF

    log_success "Automated feedback collected: $automated_feedback_file"
}

# Process and categorize feedback
process_feedback() {
    log_info "Processing feedback files..."
    
    local processed_count=0
    
    for feedback_file in "$INCOMING_DIR"/*/*.json; do
        if [[ -f "$feedback_file" ]]; then
            local filename=$(basename "$feedback_file")
            local timestamp=$(date +%Y%m%d_%H%M%S)
            local processed_file="$PROCESSED_DIR/processed_${timestamp}_${filename}"
            
            # Validate JSON and add processing metadata
            if jq empty "$feedback_file" 2>/dev/null; then
                jq --arg timestamp "$(date -I)" \
                   --arg processed_by "$(whoami)" \
                   '. + {
                       processed_timestamp: $timestamp,
                       processed_by: $processed_by,
                       processing_status: "validated"
                   }' "$feedback_file" > "$processed_file"
                
                # Move original to processed subdirectory
                mkdir -p "$INCOMING_DIR/processed"
                mv "$feedback_file" "$INCOMING_DIR/processed/"
                
                ((processed_count++))
            else
                log_warning "Invalid JSON in feedback file: $feedback_file"
            fi
        fi
    done
    
    log_success "Processed $processed_count feedback files"
}

# Generate analytics summary
generate_analytics() {
    log_info "Generating analytics summary..."
    
    local analytics_file="$ANALYTICS_DIR/analytics_$(date +%Y%m%d).json"
    local today=$(date +%Y-%m-%d)
    
    # Count feedback by type and severity
    local type_counts=$(jq -s '
        group_by(.type) | 
        map({type: .[0].type, count: length}) | 
        from_entries
    ' "$PROCESSED_DIR"/*.json 2>/dev/null || echo '{}')
    
    local severity_counts=$(jq -s '
        group_by(.severity) | 
        map({severity: .[0].severity, count: length}) | 
        from_entries
    ' "$PROCESSED_DIR"/*.json 2>/dev/null || echo '{}')
    
    local platform_counts=$(jq -s '
        group_by(.platform) | 
        map({platform: .[0].platform, count: length}) | 
        from_entries
    ' "$PROCESSED_DIR"/*.json 2>/dev/null || echo '{}')
    
    # Generate analytics report
    cat > "$analytics_file" << EOF
{
    "date": "$today",
    "total_feedback": $(find "$PROCESSED_DIR" -name "*.json" | wc -l),
    "feedback_by_type": $type_counts,
    "feedback_by_severity": $severity_counts,
    "feedback_by_platform": $platform_counts,
    "critical_issues": $(jq '[.[] | select(.severity == "critical")] | length' "$PROCESSED_DIR"/*.json 2>/dev/null || echo 0),
    "high_priority_issues": $(jq '[.[] | select(.severity == "high")] | length' "$PROCESSED_DIR"/*.json 2>/dev/null || echo 0),
    "generated_at": "$(date -I)"
}
EOF

    log_success "Analytics summary generated: $analytics_file"
}

# Send notifications for critical issues
send_notifications() {
    log_info "Checking for critical issues requiring notification..."
    
    local critical_issues=$(jq '[.[] | select(.severity == "critical")] | length' "$PROCESSED_DIR"/*.json 2>/dev/null || echo 0)
    
    if [[ $critical_issues -gt 0 ]]; then
        log_warning "Found $critical_issues critical issues - sending notifications..."
        
        # In real implementation, this would send emails, Slack messages, etc.
        local notification_file="$ANALYTICS_DIR/critical_notification_$(date +%Y%m%d_%H%M%S).json"
        
        cat > "$notification_file" << EOF
{
    "notification_type": "critical_issues",
    "timestamp": "$(date -I)",
    "critical_issue_count": $critical_issues,
    "requires_immediate_attention": true,
    "recipients": [
        "beta-lead@tunnelforge.dev",
        "dev-team@tunnelforge.dev"
    ],
    "message": "$critical_issues critical issues found in beta testing feedback. Immediate review required."
}
EOF

        log_warning "Critical issue notification sent: $notification_file"
    fi
}

# Generate daily summary
generate_daily_summary() {
    log_info "Generating daily feedback summary..."
    
    local summary_file="$ANALYTICS_DIR/daily_summary_$(date +%Y%m%d).md"
    local today=$(date +%Y-%m-%d)
    
    cat > "$summary_file" << EOF
# TunnelForge Beta Feedback Summary - $today

## Overview
- **Total Feedback Items**: $(find "$PROCESSED_DIR" -name "*.json" | wc -l)
- **Critical Issues**: $(jq '[.[] | select(.severity == "critical")] | length' "$PROCESSED_DIR"/*.json 2>/dev/null || echo 0)
- **High Priority**: $(jq '[.[] | select(.severity == "high")] | length' "$PROCESSED_DIR"/*.json 2>/dev/null || echo 0)

## Feedback by Type
$(jq -r 'group_by(.type) | map({type: .[0].type, count: length}) | .[] | "- \(.type): \(.count)"' "$PROCESSED_DIR"/*.json 2>/dev/null || echo "No feedback data")

## Feedback by Platform
$(jq -r 'group_by(.platform) | map({platform: .[0].platform, count: length}) | .[] | "- \(.platform): \(.count)"' "$PROCESSED_DIR"/*.json 2>/dev/null || echo "No platform data")

## Critical Issues Requiring Immediate Attention
$(jq -r 'select(.severity == "critical") | "- **\(.title)** (\(.platform)): \(.description)"' "$PROCESSED_DIR"/*.json 2>/dev/null || echo "No critical issues")

## High Priority Issues
$(jq -r 'select(.severity == "high") | "- **\(.title)** (\(.platform)): \(.description)"' "$PROCESSED_DIR"/*.json 2>/dev/null || echo "No high priority issues")

## Recommendations
1. Address all critical issues within 24 hours
2. Review high priority issues for next beta release
3. Analyze trends in feedback for improvement areas
4. Follow up with users who provided detailed feedback

---
*Summary generated on $(date)*
EOF

    log_success "Daily summary generated: $summary_file"
}

# Main collection function
main() {
    log_info "Starting TunnelForge feedback collection..."
    
    setup_directories
    
    # Collect feedback from all sources
    collect_web_feedback
    collect_email_feedback
    collect_discord_feedback
    collect_github_feedback
    collect_automated_feedback
    
    # Process and analyze feedback
    process_feedback
    generate_analytics
    send_notifications
    generate_daily_summary
    
    log_success "Feedback collection completed!"
    echo
    echo "Summary:"
    echo "- Total feedback items: $(find "$PROCESSED_DIR" -name "*.json" | wc -l)"
    echo "- Critical issues: $(jq '[.[] | select(.severity == "critical")] | length' "$PROCESSED_DIR"/*.json 2>/dev/null || echo 0)"
    echo "- High priority: $(jq '[.[] | select(.severity == "high")] | length' "$PROCESSED_DIR"/*.json 2>/dev/null || echo 0)"
    echo
    echo "Files generated:"
    echo "- Processed feedback: $PROCESSED_DIR/"
    echo "- Analytics: $ANALYTICS_DIR/"
    echo "- Daily summary: $ANALYTICS_DIR/daily_summary_$(date +%Y%m%d).md"
}

# Run main function
main "$@"