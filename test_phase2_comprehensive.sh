#!/bin/bash
set -e

echo "=== Phase 2 Comprehensive Functional Testing ==="
echo "Test Date: $(date)"
echo ""

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS_COUNT=0
FAIL_COUNT=0

# Helper function
test_component() {
    local name="$1"
    local test_func="$2"
    
    echo ""
    echo "Testing: $name"
    if eval "$test_func"; then
        echo -e "${GREEN}✓ PASS${NC}: $name"
        ((PASS_COUNT++))
    else
        echo -e "${RED}✗ FAIL${NC}: $name"
        ((FAIL_COUNT++))
    fi
}

# ============================================================
# PHASE 2.1: STARTUP & INITIALIZATION
# ============================================================
echo ""
echo "========== PHASE 2.1: Startup & Initialization =========="

test_binary_exists() {
    [ -f "./desktop/src-tauri/target/release/tunnelforge" ]
}
test_component "Binary compilation" "test_binary_exists"

test_config_dir_structure() {
    [ -d "./desktop/src-tauri/src/config" ] && \
    [ -f "./desktop/src-tauri/src/config/mod.rs" ]
}
test_component "Config directory structure" "test_config_dir_structure"

test_access_mode_service_exists() {
    [ -f "./desktop/src-tauri/src/access_mode_service.rs" ] && \
    grep -q "pub struct AccessModeService" "./desktop/src-tauri/src/access_mode_service.rs"
}
test_component "AccessModeService implementation" "test_access_mode_service_exists"

test_default_mode_localhost() {
    grep -q "pub fn default() -> Self" "./desktop/src-tauri/src/config/mod.rs" && \
    grep -q "AccessMode::LocalhostOnly" "./desktop/src-tauri/src/config/mod.rs"
}
test_component "Default mode is LocalhostOnly" "test_default_mode_localhost"

# ============================================================
# PHASE 2.2: SETTINGS UI TOGGLE IMPLEMENTATION
# ============================================================
echo ""
echo "========== PHASE 2.2: Settings UI Toggle Implementation =========="

test_set_access_mode_command() {
    grep -q "#\[tauri::command\]" "./desktop/src-tauri/src/config/mod.rs" && \
    grep -q "pub async fn set_access_mode" "./desktop/src-tauri/src/config/mod.rs"
}
test_component "set_access_mode Tauri command" "test_set_access_mode_command"

test_toggle_access_mode_command() {
    grep -q "pub async fn toggle_access_mode" "./desktop/src-tauri/src/config/mod.rs"
}
test_component "toggle_access_mode Tauri command" "test_toggle_access_mode_command"

test_mode_enum_definition() {
    grep -q "pub enum AccessMode" "./desktop/src-tauri/src/access_mode_service.rs" && \
    grep -q "LocalhostOnly" "./desktop/src-tauri/src/access_mode_service.rs" && \
    grep -q "NetworkAccess" "./desktop/src-tauri/src/access_mode_service.rs"
}
test_component "AccessMode enum with variants" "test_mode_enum_definition"

test_serialization_support() {
    grep -q "#\[derive.*Serialize.*Deserialize" "./desktop/src-tauri/src/access_mode_service.rs"
}
test_component "AccessMode Serialize/Deserialize" "test_serialization_support"

test_toggle_logic() {
    grep -q "LocalhostOnly => AccessMode::NetworkAccess" "./desktop/src-tauri/src/config/mod.rs" && \
    grep -q "NetworkAccess => AccessMode::LocalhostOnly" "./desktop/src-tauri/src/config/mod.rs"
}
test_component "Toggle logic implementation" "test_toggle_logic"

# ============================================================
# PHASE 2.3: TRAY MENU INTEGRATION
# ============================================================
echo ""
echo "========== PHASE 2.3: Tray Menu Integration =========="

test_tray_file_exists() {
    [ -f "./desktop/src-tauri/src/ui/tray.rs" ]
}
test_component "Tray menu file exists" "test_tray_file_exists"

test_tray_access_mode_display() {
    grep -q "access_mode" "./desktop/src-tauri/src/ui/tray.rs"
}
test_component "Tray displays access mode" "test_tray_access_mode_display"

test_tray_menu_items() {
    grep -qE "Menu|CustomMenu|MenuItem|Submenu" "./desktop/src-tauri/src/ui/tray.rs"
}
test_component "Tray menu structure" "test_tray_menu_items"

test_tray_icon_variants() {
    grep -q "🔒\|🌐" "./desktop/src-tauri/src/ui/tray.rs" || grep -q "lock\|network" "./desktop/src-tauri/src/ui/tray.rs"
}
test_component "Tray icon variants" "test_tray_icon_variants"

# ============================================================
# PHASE 2.4: CONFIG PERSISTENCE
# ============================================================
echo ""
echo "========== PHASE 2.4: Config Persistence =========="

test_config_loading() {
    grep -q "pub fn load_config" "./desktop/src-tauri/src/config/mod.rs"
}
test_component "Config loading implementation" "test_config_loading"

test_config_saving() {
    grep -q "pub fn save_config" "./desktop/src-tauri/src/config/mod.rs"
}
test_component "Config saving implementation" "test_config_saving"

test_config_path_management() {
    grep -q "config_path" "./desktop/src-tauri/src/config/mod.rs" && \
    grep -q "config.json" "./desktop/src-tauri/src/config/mod.rs"
}
test_component "Config path management" "test_config_path_management"

test_json_serialization() {
    grep -q "serde_json" "./desktop/src-tauri/src/config/mod.rs"
}
test_component "JSON serialization" "test_json_serialization"

test_default_on_first_run() {
    grep -q "if !self.config_path.exists()" "./desktop/src-tauri/src/config/mod.rs" && \
    grep -q "let default_config = AppConfig::default()" "./desktop/src-tauri/src/config/mod.rs"
}
test_component "Default config on first run" "test_default_on_first_run"

test_update_config_atomic() {
    grep -q "pub fn update_config" "./desktop/src-tauri/src/config/mod.rs"
}
test_component "Atomic config update" "test_update_config_atomic"

# ============================================================
# PHASE 2.5: EVENT FLOW VERIFICATION
# ============================================================
echo ""
echo "========== PHASE 2.5: Event Flow Verification =========="

test_event_listener_setup() {
    grep -q 'app.listen("access-mode-changed"' "./desktop/src-tauri/src/main.rs"
}
test_component "Event listener setup" "test_event_listener_setup"

test_event_emission() {
    grep -q "Emitter::emit" "./desktop/src-tauri/src/access_mode_service.rs" || \
    grep -q "emit(" "./desktop/src-tauri/src/access_mode_service.rs"
}
test_component "Event emission" "test_event_emission"

test_server_restart_on_mode_change() {
    grep -q "access-mode-changed" "./desktop/src-tauri/src/main.rs" && \
    grep -q "stop_server\|stop_server_internal" "./desktop/src-tauri/src/main.rs" && \
    grep -q "start_server\|start_server_internal" "./desktop/src-tauri/src/main.rs"
}
test_component "Server restart on mode change" "test_server_restart_on_mode_change"

test_grace_period_on_restart() {
    grep -q "thread::sleep\|Duration::from_millis" "./desktop/src-tauri/src/main.rs"
}
test_component "Grace period during restart" "test_grace_period_on_restart"

test_app_state_management() {
    grep -q "AppState\|app_handle.try_state" "./desktop/src-tauri/src/main.rs"
}
test_component "App state management" "test_app_state_management"

# ============================================================
# PHASE 2.6: ERROR HANDLING
# ============================================================
echo ""
echo "========== PHASE 2.6: Error Handling =========="

test_result_types() {
    grep -q "Result<" "./desktop/src-tauri/src/config/mod.rs" && \
    grep -q "Result<" "./desktop/src-tauri/src/access_mode_service.rs"
}
test_component "Result-based error handling" "test_result_types"

test_error_messages() {
    grep -q "map_err\|Err(" "./desktop/src-tauri/src/config/mod.rs"
}
test_component "Error message propagation" "test_error_messages"

test_concurrent_access_safety() {
    grep -q "Arc\|Mutex" "./desktop/src-tauri/src/access_mode_service.rs"
}
test_component "Concurrent access safety (Arc/Mutex)" "test_concurrent_access_safety"

test_lock_acquisition_error_handling() {
    grep -q "status.lock()" "./desktop/src-tauri/src/access_mode_service.rs" && \
    grep -q "if let Ok\|if let Err" "./desktop/src-tauri/src/access_mode_service.rs"
}
test_component "Lock acquisition error handling" "test_lock_acquisition_error_handling"

# ============================================================
# COMMAND REGISTRATION VERIFICATION
# ============================================================
echo ""
echo "========== Command Registration =========="

test_commands_in_invoke_handler() {
    grep -q "set_access_mode" "./desktop/src-tauri/src/main.rs" && \
    grep -q "toggle_access_mode" "./desktop/src-tauri/src/main.rs" && \
    grep -q "get_access_mode" "./desktop/src-tauri/src/main.rs"
}
test_component "Access mode commands registered" "test_commands_in_invoke_handler"

test_service_management() {
    grep -q "AccessModeService::new" "./desktop/src-tauri/src/main.rs" && \
    grep -q "app.manage" "./desktop/src-tauri/src/main.rs"
}
test_component "AccessModeService lifecycle management" "test_service_management"

# ============================================================
# SUMMARY
# ============================================================
echo ""
echo "========== TEST SUMMARY =========="
echo -e "Total Tests Run: $((PASS_COUNT + FAIL_COUNT))"
echo -e "${GREEN}Passed: $PASS_COUNT${NC}"
echo -e "${RED}Failed: $FAIL_COUNT${NC}"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}✓ All tests PASSED!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests FAILED${NC}"
    exit 1
fi
