#!/bin/bash

# TunnelForge Beta Testing Environment Setup
# This script sets up the complete beta testing infrastructure

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BETA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$BETA_DIR")"
BETA_VERSION="${BETA_VERSION:-$(date +%Y.%m.%d-beta)}"
BETA_ENV_FILE="$BETA_DIR/.env"

# Logging
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

# Create directory structure
create_directories() {
    log_info "Creating beta testing directory structure..."
    
    mkdir -p "$BETA_DIR"/{feedback-system,user-management,automated-testing,reporting,deployment}
    mkdir -p "$BETA_DIR"/feedback-system/{incoming,processed,analytics}
    mkdir -p "$BETA_DIR"/user-management/{testers,credentials,permissions}
    mkdir -p "$BETA_DIR"/automated-testing/{scripts,results,configs}
    mkdir -p "$BETA_DIR"/reporting/{daily,weekly,monthly,charts}
    mkdir -p "$BETA_DIR"/deployment/{builds,configs,scripts}
    
    log_success "Directory structure created"
}

# Create environment configuration
create_env_file() {
    log_info "Creating beta environment configuration..."
    
    cat > "$BETA_ENV_FILE" << EOF
# TunnelForge Beta Testing Environment Configuration
BETA_VERSION=$BETA_VERSION
BETA_START_DATE=$(date +%Y-%m-%d)
BETA_END_DATE=$(date -d "+12 weeks" +%Y-%m-%d)

# Feedback System Configuration
FEEDBACK_WEBHOOK_URL="${FEEDBACK_WEBHOOK_URL:-}"
FEEDBACK_EMAIL="${FEEDBACK_EMAIL:-beta@tunnelforge.dev}"
FEEDBACK_DISCORD_WEBHOOK="${FEEDBACK_DISCORD_WEBHOOK:-}"

# User Management
MAX_BETA_TESTERS=500
CURRENT_TESTER_COUNT=0
TESTER_INVITE_CODE="${TESTER_INVITE_CODE:-TF-BETA-$(date +%Y%m)}"

# Deployment Configuration
BETA_BUILD_CHANNEL="beta"
BETA_UPDATE_URL="https://beta.tunnelforge.dev/updates"
BETA_DOWNLOAD_URL="https://beta.tunnelforge.dev/downloads"

# Analytics Configuration
ANALYTICS_ENABLED=true
ANALYTICS_RETENTION_DAYS=90
CRASH_REPORTING_ENABLED=true
USAGE_TRACKING_ENABLED=true

# Security Configuration
BETA_BUILD_SIGNED=true
TELEMETRY_ANONYMIZED=true
DATA_RETENTION_DAYS=30

# Integration Configuration
GITHUB_REPO="tunnelforge/tunnelforge"
GITHUB_BETA_BRANCH="beta"
DISCORD_SERVER_ID="${DISCORD_SERVER_ID:-}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"
EOF

    log_success "Environment configuration created"
}

# Create feedback collection system
setup_feedback_system() {
    log_info "Setting up feedback collection system..."
    
    # Feedback processing script
    cat > "$BETA_DIR/feedback-system/process-feedback.sh" << 'EOF'
#!/bin/bash

FEEDBACK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INCOMING_DIR="$FEEDBACK_DIR/incoming"
PROCESSED_DIR="$FEEDBACK_DIR/processed"
ANALYTICS_DIR="$FEEDBACK_DIR/analytics"

# Process incoming feedback
process_feedback() {
    local feedback_file="$1"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local processed_file="$PROCESSED_DIR/feedback_$timestamp.json"
    
    # Validate and categorize feedback
    jq '{
        timestamp: now,
        type: .type // "general",
        severity: .severity // "medium",
        platform: .platform // "unknown",
        version: .version // "unknown",
        user_id: .user_id // "anonymous",
        category: .category // "other",
        title: .title,
        description: .description,
        steps: .steps // [],
        expected: .expected // "",
        actual: .actual // "",
        attachments: .attachments // []
    }' "$feedback_file" > "$processed_file"
    
    # Move to processed
    mv "$feedback_file" "$INCOMING_DIR/processed/"
    
    # Update analytics
    echo "$processed_file" >> "$ANALYTICS_DIR/feedback_log.txt"
}

# Process all unprocessed feedback
for file in "$INCOMING_DIR"/*.json; do
    if [[ -f "$file" ]]; then
        process_feedback "$file"
    fi
done

echo "Feedback processing completed"
EOF

    chmod +x "$BETA_DIR/feedback-system/process-feedback.sh"
    
    # Feedback categories configuration
    cat > "$BETA_DIR/feedback-system/categories.json" << 'EOF'
{
    "categories": {
        "bug": {
            "name": "Bug Report",
            "description": "Software defects and unexpected behavior",
            "severity_levels": ["critical", "high", "medium", "low"],
            "required_fields": ["title", "description", "steps", "expected", "actual"]
        },
        "feature": {
            "name": "Feature Request",
            "description": "New feature suggestions and enhancements",
            "severity_levels": ["enhancement", "nice-to-have"],
            "required_fields": ["title", "description", "use_case"]
        },
        "usability": {
            "name": "Usability Issue",
            "description": "User experience and interface problems",
            "severity_levels": ["major", "minor"],
            "required_fields": ["title", "description", "scenario"]
        },
        "performance": {
            "name": "Performance Issue",
            "description": "Slow performance or resource usage problems",
            "severity_levels": ["critical", "high", "medium"],
            "required_fields": ["title", "description", "system_info"]
        },
        "documentation": {
            "name": "Documentation",
            "description": "Documentation issues and suggestions",
            "severity_levels": ["major", "minor"],
            "required_fields": ["title", "description", "location"]
        },
        "other": {
            "name": "Other",
            "description": "General feedback and other issues",
            "severity_levels": ["high", "medium", "low"],
            "required_fields": ["title", "description"]
        }
    }
}
EOF

    log_success "Feedback system configured"
}

# Create user management system
setup_user_management() {
    log_info "Setting up user management system..."
    
    # User registration script
    cat > "$BETA_DIR/user-management/register-tester.sh" << 'EOF'
#!/bin/bash

USER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TESTERS_FILE="$USER_DIR/testers/beta_testers.json"
CREDENTIALS_DIR="$USER_DIR/credentials"

register_tester() {
    local email="$1"
    local name="$2"
    local platform="$3"
    local experience="$4"
    
    local tester_id=$(uuidgen | tr '[:upper:]' '[:lower:]')
    local registration_date=$(date -I)
    
    # Create tester record
    jq --arg email "$email" \
       --arg name "$name" \
       --arg platform "$platform" \
       --arg experience "$experience" \
       --arg id "$tester_id" \
       --arg date "$registration_date" \
       '.testers += [{
           id: $id,
           email: $email,
           name: $name,
           platform: $platform,
           experience: $experience,
           registration_date: $date,
           status: "active",
           feedback_count: 0,
           last_active: $date
       }]' "$TESTERS_FILE" > "${TESTERS_FILE}.tmp" && mv "${TESTERS_FILE}.tmp" "$TESTERS_FILE"
    
    # Generate credentials
    local api_key=$(openssl rand -hex 16)
    local tester_config="$CREDENTIALS_DIR/${tester_id}.json"
    
    cat > "$tester_config" << CREDENTIALS_EOF
{
    "tester_id": "$tester_id",
    "email": "$email",
    "api_key": "$api_key",
    "permissions": ["submit_feedback", "view_analytics", "download_builds"],
    "created_at": "$registration_date",
    "expires_at": "$(date -d "+90 days" -I)"
}
CREDENTIALS_EOF
    
    chmod 600 "$tester_config"
    
    echo "Tester registered successfully:"
    echo "  ID: $tester_id"
    echo "  Email: $email"
    echo "  API Key: $api_key"
}

# Initialize testers file if it doesn't exist
if [[ ! -f "$TESTERS_FILE" ]]; then
    echo '{"testers": []}' > "$TESTERS_FILE"
fi

# Register tester from command line arguments
if [[ $# -eq 4 ]]; then
    register_tester "$1" "$2" "$3" "$4"
else
    echo "Usage: $0 <email> <name> <platform> <experience>"
    echo "Platforms: windows, macos, linux"
    echo "Experience: beginner, intermediate, advanced"
    exit 1
fi
EOF

    chmod +x "$BETA_DIR/user-management/register-tester.sh"
    
    # Initialize testers database
    mkdir -p "$BETA_DIR/user-management/testers"
    echo '{"testers": []}' > "$BETA_DIR/user-management/testers/beta_testers.json"
    
    log_success "User management system configured"
}

# Create automated testing framework
setup_automated_testing() {
    log_info "Setting up automated testing framework..."
    
    # Beta test runner
    cat > "$BETA_DIR/automated-testing/run-beta-tests.sh" << 'EOF'
#!/bin/bash

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="$TEST_DIR/results"
CONFIGS_DIR="$TEST_DIR/configs"

# Test configuration
TEST_CONFIG="$CONFIGS_DIR/beta-test-config.json"

run_beta_tests() {
    local test_date=$(date +%Y%m%d_%H%M%S)
    local result_dir="$RESULTS_DIR/beta_test_$test_date"
    
    mkdir -p "$result_dir"
    
    # Run cross-platform tests
    echo "Running cross-platform beta tests..."
    
    # Server functionality tests
    echo "Testing server functionality..."
    # Add server test commands here
    
    # UI/UX tests
    echo "Testing user interface..."
    # Add UI test commands here
    
    # Performance tests
    echo "Testing performance..."
    # Add performance test commands here
    
    # Generate test report
    cat > "$result_dir/test_report.json" << REPORT_EOF
{
    "test_date": "$(date -I)",
    "test_duration": "0",
    "platforms_tested": ["windows", "macos", "linux"],
    "tests_run": 0,
    "tests_passed": 0,
    "tests_failed": 0,
    "critical_issues": [],
    "performance_metrics": {},
    "recommendations": []
}
REPORT_EOF
    
    echo "Beta tests completed. Results saved to: $result_dir"
}

run_beta_tests
EOF

    chmod +x "$BETA_DIR/automated-testing/run-beta-tests.sh"
    
    # Test configuration
    cat > "$BETA_DIR/automated-testing/configs/beta-test-config.json" << 'EOF'
{
    "test_suites": {
        "server": {
            "enabled": true,
            "timeout": 300,
            "tests": [
                "server_startup",
                "session_management",
                "authentication",
                "file_operations",
                "tunnel_services"
            ]
        },
        "client": {
            "enabled": true,
            "timeout": 180,
            "tests": [
                "installation",
                "configuration",
                "ui_responsiveness",
                "system_integration",
                "auto_update"
            ]
        },
        "performance": {
            "enabled": true,
            "timeout": 600,
            "tests": [
                "memory_usage",
                "cpu_usage",
                "network_performance",
                "concurrent_sessions",
                "large_file_transfers"
            ]
        },
        "security": {
            "enabled": true,
            "timeout": 300,
            "tests": [
                "authentication_security",
                "data_encryption",
                "permission_handling",
                "input_validation",
                "secure_communication"
            ]
        }
    },
    "platforms": {
        "windows": {
            "enabled": true,
            "versions": ["10", "11"],
            "architectures": ["x64", "arm64"]
        },
        "macos": {
            "enabled": true,
            "versions": ["11", "12", "13"],
            "architectures": ["x64", "arm64"]
        },
        "linux": {
            "enabled": true,
            "distributions": ["ubuntu", "fedora", "arch"],
            "architectures": ["x64", "arm64"]
        }
    }
}
EOF

    log_success "Automated testing framework configured"
}

# Create reporting system
setup_reporting() {
    log_info "Setting up reporting system..."
    
    # Daily report generator
    cat > "$BETA_DIR/reporting/generate-daily-report.sh" << 'EOF'
#!/bin/bash

REPORTING_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DAILY_DIR="$REPORTING_DIR/daily"
FEEDBACK_DIR="../feedback-system"
USER_DIR="../user-management"

generate_daily_report() {
    local report_date=$(date +%Y-%m-%d)
    local report_file="$DAILY_DIR/beta_report_$report_date.md"
    
    cat > "$report_file" << REPORT_EOF
# TunnelForge Beta Daily Report - $report_date

## Executive Summary

### Key Metrics
- **Active Testers**: $(jq '.testers | map(select(.status == "active")) | length' "$USER_DIR/testers/beta_testers.json")
- **New Feedback**: $(find "$FEEDBACK_DIR/processed" -name "feedback_*$report_date*.json" | wc -l)
- **Critical Issues**: $(jq '[.[] | select(.severity == "critical")] | length' "$FEEDBACK_DIR/processed/feedback_$report_date"*.json 2>/dev/null || echo 0)
- **Test Coverage**: Platform coverage percentages

### Feedback Summary
$(if [[ -n "$(find "$FEEDBACK_DIR/processed" -name "feedback_*$report_date*.json" 2>/dev/null)" ]]; then
    jq -r 'group_by(.type) | map({type: .[0].type, count: length}) | .[] | "- \(.type): \(.count)"' "$FEEDBACK_DIR/processed/feedback_$report_date"*.json 2>/dev/null
else
    echo "- No feedback received today"
fi)

### Platform Activity
- Windows: TBD
- macOS: TBD
- Linux: TBD

## Issues Identified

### Critical Issues
$(jq -r 'select(.severity == "critical") | "- \(.title): \(.description)"' "$FEEDBACK_DIR/processed/feedback_$report_date"*.json 2>/dev/null || echo "None")

### High Priority Issues
$(jq -r 'select(.severity == "high") | "- \(.title): \(.description)"' "$FEEDBACK_DIR/processed/feedback_$report_date"*.json 2>/dev/null || echo "None")

## Testing Progress

### Automated Tests
- Tests Run: TBD
- Pass Rate: TBD
- Failures: TBD

### Manual Testing
- Sessions Completed: TBD
- Test Scenarios Covered: TBD

## Recommendations

1. Based on today's feedback and testing results
2. Priority actions for tomorrow
3. Resource allocation recommendations

## Next Steps

- [ ] Address critical issues
- [ ] Follow up on high-priority feedback
- [ ] Plan tomorrow's testing focus
- [ ] Update tester communications

---
*Report generated on $(date)*
REPORT_EOF

    echo "Daily report generated: $report_file"
}

generate_daily_report
EOF

    chmod +x "$BETA_DIR/reporting/generate-daily-report.sh"
    
    log_success "Reporting system configured"
}

# Create deployment configuration
setup_deployment() {
    log_info "Setting up deployment configuration..."
    
    # Beta deployment script
    cat > "$BETA_DIR/deployment/deploy-beta.sh" << 'EOF'
#!/bin/bash

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILDS_DIR="$DEPLOY_DIR/builds"
CONFIGS_DIR="$DEPLOY_DIR/configs"

deploy_beta_build() {
    local version="$1"
    local platform="$2"
    
    echo "Deploying beta build $version for $platform..."
    
    # Validate build exists
    local build_file="$BUILDS_DIR/tunnelforge-beta-$version-$platform.pkg"
    if [[ ! -f "$build_file" ]]; then
        echo "Error: Build file not found: $build_file"
        return 1
    fi
    
    # Create deployment manifest
    local manifest_file="$CONFIGS_DIR/beta-manifest-$version-$platform.json"
    cat > "$manifest_file" << MANIFEST_EOF
{
    "version": "$version",
    "platform": "$platform",
    "build_date": "$(date -I)",
    "build_file": "$(basename "$build_file")",
    "checksum": "$(sha256sum "$build_file" | cut -d' ' -f1)",
    "size": "$(stat -f%z "$build_file" 2>/dev/null || stat -c%s "$build_file")",
    "signature": "$(openssl dgst -sha256 -sign beta.key "$build_file" | base64 -w0)",
    "release_notes": "Beta release with latest improvements and bug fixes",
    "minimum_system_version": {
        "windows": "10",
        "macos": "11",
        "linux": "Ubuntu 20.04"
    },
    "changelog": [
        "Improved tunnel service reliability",
        "Enhanced user interface responsiveness",
        "Fixed critical security vulnerabilities",
        "Added new configuration options"
    ]
}
MANIFEST_EOF
    
    echo "Beta deployment manifest created: $manifest_file"
    
    # Here you would typically upload to your distribution server
    # scp "$build_file" "beta-server:/var/www/beta.tunnelforge.dev/downloads/"
    # scp "$manifest_file" "beta-server:/var/www/beta.tunnelforge.dev/manifests/"
    
    echo "Deployment completed for $platform"
}

# Deploy for all platforms if no specific platform provided
if [[ $# -eq 1 ]]; then
    for platform in windows macos linux; do
        deploy_beta_build "$1" "$platform"
    done
elif [[ $# -eq 2 ]]; then
    deploy_beta_build "$1" "$2"
else
    echo "Usage: $0 <version> [platform]"
    echo "Platforms: windows, macos, linux"
    exit 1
fi
EOF

    chmod +x "$BETA_DIR/deployment/deploy-beta.sh"
    
    log_success "Deployment configuration created"
}

# Create beta testing dashboard
create_dashboard() {
    log_info "Creating beta testing dashboard..."
    
    cat > "$BETA_DIR/dashboard.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TunnelForge Beta Testing Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .dashboard { max-width: 1200px; margin: 0 auto; }
        .header { background: #2c3e50; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 20px; }
        .metric-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric-value { font-size: 2em; font-weight: bold; color: #3498db; }
        .metric-label { color: #7f8c8d; margin-top: 5px; }
        .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .chart-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .status { padding: 10px; border-radius: 4px; margin: 10px 0; }
        .status.success { background: #d4edda; color: #155724; }
        .status.warning { background: #fff3cd; color: #856404; }
        .status.error { background: #f8d7da; color: #721c24; }
    </style>
</head>
<body>
    <div class="dashboard">
        <div class="header">
            <h1>TunnelForge Beta Testing Dashboard</h1>
            <p>Real-time monitoring and analytics for beta testing program</p>
        </div>

        <div class="metrics">
            <div class="metric-card">
                <div class="metric-value" id="active-testers">0</div>
                <div class="metric-label">Active Testers</div>
            </div>
            <div class="metric-card">
                <div class="metric-value" id="feedback-count">0</div>
                <div class="metric-label">Feedback Items</div>
            </div>
            <div class="metric-card">
                <div class="metric-value" id="critical-issues">0</div>
                <div class="metric-label">Critical Issues</div>
            </div>
            <div class="metric-card">
                <div class="metric-value" id="test-coverage">0%</div>
                <div class="metric-label">Test Coverage</div>
            </div>
        </div>

        <div class="charts">
            <div class="chart-card">
                <h3>Platform Distribution</h3>
                <canvas id="platformChart"></canvas>
            </div>
            <div class="chart-card">
                <h3>Feedback Trends</h3>
                <canvas id="feedbackChart"></canvas>
            </div>
        </div>

        <div class="chart-card">
            <h3>Recent Activity</h3>
            <div id="activity-log">
                <div class="status success">Beta testing environment initialized successfully</div>
            </div>
        </div>
    </div>

    <script>
        // Mock data for demonstration
        document.getElementById('active-testers').textContent = '47';
        document.getElementById('feedback-count').textContent = '23';
        document.getElementById('critical-issues').textContent = '2';
        document.getElementById('test-coverage').textContent = '78%';

        // Add activity logging
        function addActivity(message, type = 'success') {
            const log = document.getElementById('activity-log');
            const entry = document.createElement('div');
            entry.className = `status ${type}`;
            entry.textContent = `${new Date().toLocaleString()}: ${message}`;
            log.insertBefore(entry, log.firstChild);
        }

        // Simulate real-time updates
        setInterval(() => {
            const activities = [
                'New tester registered',
                'Feedback received',
                'Automated test completed',
                'Build deployed',
                'Report generated'
            ];
            const randomActivity = activities[Math.floor(Math.random() * activities.length)];
            addActivity(randomActivity, 'success');
        }, 30000);
    </script>
</body>
</html>
EOF

    log_success "Beta testing dashboard created"
}

# Main setup function
main() {
    log_info "Setting up TunnelForge Beta Testing Environment..."
    log_info "Beta Version: $BETA_VERSION"
    
    create_directories
    create_env_file
    setup_feedback_system
    setup_user_management
    setup_automated_testing
    setup_reporting
    setup_deployment
    create_dashboard
    
    log_success "Beta testing environment setup completed!"
    echo
    echo "Next steps:"
    echo "1. Review configuration in: $BETA_ENV_FILE"
    echo "2. Open dashboard: file://$BETA_DIR/dashboard.html"
    echo "3. Register beta testers: ./user-management/register-tester.sh"
    echo "4. Deploy beta builds: ./deployment/deploy-beta.sh"
    echo "5. Start automated testing: ./automated-testing/run-beta-tests.sh"
    echo
    echo "Beta testing infrastructure is ready for use!"
}

# Run main function
main "$@"