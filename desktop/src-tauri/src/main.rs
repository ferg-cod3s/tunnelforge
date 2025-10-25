// TunnelForge Desktop - Native Tauri v2 Application
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;
use tauri::{Manager, Listener};
use tauri_plugin_log::{Target, TargetKind};
use sentry;
use once_cell::sync::OnceCell;

mod config;
mod notifications;
mod power;
mod system;
mod ui;
mod access_mode_service;
mod ngrok_service;
mod cloudflare_service;
mod server;
mod sessions;
mod metrics;

use tunnelforge_desktop::{init_app_state, setup_app};
use crate::metrics::{StartupTimer, StartupMetrics};

const ENABLE_PARALLEL_UI_INIT: bool = true;
const ENABLE_STARTUP_METRICS: bool = true;

#[tauri::command]
async fn check_cli_installation() -> Result<bool, String> {
    let paths = vec![
        "/usr/local/bin/tunnelforge",
        "/opt/homebrew/bin/tunnelforge",
    ];

    for path in paths {
        if std::path::Path::new(path).exists() {
            return Ok(true);
        }
    }

    Ok(false)
}

#[tauri::command]
async fn install_cli_tool() -> Result<(), String> {
    Err("CLI installation is not yet supported on this platform".to_string())
}

#[tauri::command]
async fn test_sentry_integration() -> Result<String, String> {
    use log::info;

    info!("Testing Sentry integration...");
    sentry::capture_message("Test message from Tauri app", sentry::Level::Info);

    let dsn = std::env::var("SENTRY_DSN").unwrap_or_default();
    if dsn.is_empty() {
        return Err("SENTRY_DSN not configured".to_string());
    }

    info!("Sentry integration test completed successfully");
    Ok("Sentry integration working".to_string())
}

#[tauri::command]
async fn open_external_url(url: String) -> Result<(), String> {
    use log::{info, error};

    info!("Attempting to open URL: {}", url);

    match tauri_plugin_opener::open_url(&url, None::<&str>) {
        Ok(_) => {
            info!("URL opened successfully");
            Ok(())
        }
        Err(e) => {
            error!("Failed to open URL: {}", e);
            Err(format!("Failed to open URL: {}", e))
        }
    }
}

#[tauri::command]
async fn get_startup_metrics() -> Result<StartupMetrics, String> {
    if !ENABLE_STARTUP_METRICS {
        return Err("Startup metrics are disabled".to_string());
    }

    let startup_timer = STARTUP_TIMER.get().ok_or("Startup timer not initialized")?;
    Ok(startup_timer.get_metrics())
}

#[tauri::command]
async fn write_diagnostics(path: String, content: String) -> Result<(), String> {
    use std::io::Write;
    
    log::info!("📝 Writing diagnostics to: {}", path);
    
    let mut file = std::fs::File::create(&path)
        .map_err(|e| format!("Failed to create file: {}", e))?;
    
    file.write_all(content.as_bytes())
        .map_err(|e| format!("Failed to write content: {}", e))?;
    
    log::info!("✅ Diagnostics written successfully to: {}", path);
    Ok(())
}

#[tauri::command]
async fn test_rust_command() -> Result<String, String> {
    log::info!("🧪 test_rust_command called from JavaScript");
    
    let test_data = serde_json::json!({
        "status": "success",
        "message": "Rust command executed successfully",
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "tauri_available": true
    });
    
    // Write to file for verification
    std::fs::write("/tmp/tauri-command-test.json", test_data.to_string())
        .unwrap_or_else(|e| log::error!("Failed to write test file: {}", e));
    
    log::info!("✅ test_rust_command completed");
    Ok(test_data.to_string())
}

static STARTUP_TIMER: OnceCell<Arc<StartupTimer>> = OnceCell::new();

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let sentry_dsn = std::env::var("SENTRY_DSN").unwrap_or_default();
    if !sentry_dsn.is_empty() {
        sentry::init((
            sentry_dsn,
            sentry::ClientOptions {
                release: sentry::release_name!(),
                environment: Some(std::env::var("SENTRY_ENVIRONMENT").unwrap_or_else(|_| "development".into()).into()),
                traces_sample_rate: 1.0,
                ..Default::default()
            }
        ));
        log::info!("Sentry initialized for error tracking");
    } else {
        log::warn!("SENTRY_DSN not set, Sentry error reporting disabled");
    }

    let startup_timer = Arc::new(StartupTimer::new());
    let _ = STARTUP_TIMER.set(startup_timer.clone());
    let startup_timer_clone = startup_timer.clone();

    let app = tauri::Builder::default()
        .manage(init_app_state())
        .plugin(tauri_plugin_log::Builder::new()
            .targets([
                Target::new(TargetKind::Stdout),
                Target::new(TargetKind::LogDir { file_name: Some("tunnelforge".to_string()) }),
                Target::new(TargetKind::Webview),
            ])
            .level(log::LevelFilter::Debug)
            .build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            config::get_config,
            config::save_config,
            config::update_server_port,
            config::toggle_auto_start,
            config::set_theme,
            config::set_access_mode,
            config::get_access_mode,
            config::toggle_access_mode,

            power::start_power_monitoring,
            power::stop_power_monitoring,
            power::is_power_monitoring_active,
            power::get_power_settings,
            power::update_power_settings,

            system::get_system_settings,
            system::update_system_settings,

            check_cli_installation,
            install_cli_tool,
            test_sentry_integration,
            open_external_url,
            get_startup_metrics,
            write_diagnostics,
            test_rust_command,

            server::start_server,
            server::stop_server,
            server::get_server_status,
            // server::rebuild_go_server, // TODO: Not implemented yet

            notifications::show_notification,
            notifications::get_notification_settings,
            notifications::update_notification_settings,
            notifications::test_notification,
            notifications::open_notification_settings,
            // notifications::request_notification_permission, // TODO: Not implemented
            // notifications::is_notification_enabled, // TODO: Not implemented

            ngrok_service::get_ngrok_status,
            ngrok_service::check_ngrok_status,
            ngrok_service::start_ngrok_tunnel,
            ngrok_service::stop_ngrok_tunnel,
            ngrok_service::open_ngrok_download,
            ngrok_service::open_ngrok_setup_guide,

            sessions::get_sessions,
            sessions::create_session,
            sessions::delete_session,
            sessions::get_session_details,
            // sessions::open_session, // TODO: Not implemented
            // sessions::connect_websocket, // TODO: Check implementation
            // sessions::disconnect_websocket, // TODO: Check implementation
            // sessions::send_websocket_message, // TODO: Not implemented

            ui::show_settings_window,
            ui::hide_settings_window,
            ui::close_settings_window,
            ui::get_settings_window_state,
            ui::update_settings_window_state,
            ui::save_settings_config,

            ui::show_session_window,
            ui::hide_session_window,
            ui::close_session_window,
            ui::get_session_window_state,
            ui::update_session_window_state,

            ui::update_tray_status,
            ui::set_tray_tooltip,
            ui::set_tray_icon,

            ui::toggle_tailscale_integration,
            ui::toggle_cloudflare_integration,
            ui::toggle_ngrok_integration,
            ui::set_ngrok_auth_token,

            cloudflare_service::get_cloudflare_status,
            cloudflare_service::check_cloudflare_status,
            cloudflare_service::start_cloudflare_tunnel,
            cloudflare_service::stop_cloudflare_tunnel,
            cloudflare_service::open_cloudflare_homebrew,
            cloudflare_service::open_cloudflare_download,
            cloudflare_service::open_cloudflare_setup_guide,
            cloudflare_service::save_cloudflare_credentials,
            cloudflare_service::load_cloudflare_credentials,
            cloudflare_service::validate_cloudflare_credentials,
            cloudflare_service::create_named_cloudflare_tunnel,
            cloudflare_service::stop_named_cloudflare_tunnel,
            cloudflare_service::delete_named_cloudflare_tunnel,
            cloudflare_service::list_named_cloudflare_tunnels,

            access_mode_service::get_access_mode_status,
            access_mode_service::check_network_access,
            access_mode_service::set_access_mode_command,
            access_mode_service::get_current_binding,
            access_mode_service::test_network_connectivity,
        ])
        .setup(move |app| {
            let app_handle = app.handle();
            
            app.manage(access_mode_service::AccessModeService::new(app_handle.clone()));
// TunnelForge Desktop - Cross-Platform Tauri v2 Application
// This manages the Go-based TunnelForge server and provides a native desktop interface.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri_plugin_log::{Target, TargetKind};

// Import the library modules
use tunnelforge_desktop::{
    init_app_state, setup_app,
    config,
    notifications,
    power,
    system,
};

use tunnelforge_desktop::{server, sessions};

// Additional CLI-specific Tauri commands
#[tauri::command]
async fn check_cli_installation() -> Result<bool, String> {
    // Check if tunnelforge CLI is installed
    let paths = vec![
        "/usr/local/bin/tunnelforge",
        "/opt/homebrew/bin/tunnelforge",
    ];

    for path in paths {
        if std::path::Path::new(path).exists() {
            return Ok(true);
        }
    }

    Ok(false)
}

#[tauri::command]
async fn install_cli_tool() -> Result<(), String> {
    use std::process::Command;
    use log::info;

    info!("Installing CLI tool...");

    #[cfg(target_os = "macos")]
    {
        // For now, we'll create a simple shell script that connects to the local server
        // In a production app, this would download the actual TunnelForge CLI

        let install_path = "/usr/local/bin/tunnelforge";

        // Create a simple CLI script content
        let cli_script_content = r#"#!/bin/bash
# TunnelForge CLI (Desktop App Version)
# This is a simple wrapper that connects to the TunnelForge server

case "$1" in
    "start")
        echo "Starting TunnelForge session..."
        curl -s "http://localhost:4021/api/sessions" | head -5
        ;;
    "list")
        echo "Active TunnelForge sessions:"
        curl -s "http://localhost:4021/api/sessions" 2>/dev/null || echo "Server not running on localhost:4021"
        ;;
    "join")
        if [ -z "$2" ]; then
            echo "Usage: tunnelforge join <session-id>"
            exit 1
        fi
        echo "Joining session $2..."
        open "http://localhost:4021/session/$2"
        ;;
    *)
        echo "TunnelForge CLI (Desktop Version)"
        echo "Usage:"
        echo "  tunnelforge start     - Start a new session"
        echo "  tunnelforge list      - List active sessions"
        echo "  tunnelforge join <id> - Join a session"
        ;;
esac
"#;

        // Write the script to a temporary file first
        let temp_path = "/tmp/tunnelforge_cli_install";
        std::fs::write(temp_path, cli_script_content)
            .map_err(|e| format!("Failed to create temporary CLI script: {}", e))?;

        // Install with administrator privileges
        let status = Command::new("osascript")
            .arg("-e")
            .arg(format!(
                "do shell script \"cp '{}' '{}' && chmod +x '{}' && rm '{}'\" with administrator privileges",
                temp_path,
                install_path,
                install_path,
                temp_path
            ))
            .status()
            .map_err(|e| format!("Failed to execute install command: {}", e))?;

        if status.success() {
            info!("CLI tool installed successfully to {}", install_path);
            Ok(())
        } else {
            Err("CLI installation failed or was cancelled by user".to_string())
        }
    }

    #[cfg(target_os = "windows")]
    {
        Err("CLI installation is not yet supported on Windows".to_string())
    }

    #[cfg(target_os = "linux")]
    {
        Err("CLI installation is not yet supported on Linux".to_string())
    }
}

#[tauri::command]
async fn open_external_url(url: String) -> Result<(), String> {
    use log::{info, error};

    info!("Attempting to open URL: {}", url);

    // Try using the tauri_plugin_opener first
    match tauri_plugin_opener::open_url(&url, None::<&str>) {
        Ok(_) => {
            info!("URL opened successfully with tauri_plugin_opener");
            Ok(())
        }
        Err(e) => {
            error!("tauri_plugin_opener failed: {}", e);

            // Fallback to system open command
            #[cfg(target_os = "macos")]
            {
                info!("Trying fallback: macOS 'open' command");
                let status = std::process::Command::new("open")
                    .arg(&url)
                    .status()
                    .map_err(|e| {
                        error!("Failed to execute 'open' command: {}", e);
                        format!("Failed to execute 'open' command: {}", e)
                    })?;

                if status.success() {
                    info!("URL opened successfully with 'open' command");
                    Ok(())
                } else {
                    error!("'open' command failed with exit code: {:?}", status.code());
                    Err(format!("'open' command failed with exit code: {:?}", status.code()))
                }
            }

            #[cfg(target_os = "windows")]
            {
                let status = std::process::Command::new("cmd")
                    .args(&["/C", "start", &url])
                    .status()
                    .map_err(|e| format!("Failed to execute 'start' command: {}", e))?;

                if status.success() {
                    Ok(())
                } else {
                    Err(format!("'start' command failed with exit code: {:?}", status.code()))
                }
            }

            #[cfg(target_os = "linux")]
            {
                let status = std::process::Command::new("xdg-open")
                    .arg(&url)
                    .status()
                    .map_err(|e| format!("Failed to execute 'xdg-open' command: {}", e))?;

                if status.success() {
                    Ok(())
                } else {
                    Err(format!("'xdg-open' command failed with exit code: {:?}", status.code()))
                }
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(init_app_state())
        .plugin(tauri_plugin_log::Builder::new()
            .targets([
                Target::new(TargetKind::Stdout),
                Target::new(TargetKind::LogDir { file_name: Some("tunnelforge".to_string()) }),
                Target::new(TargetKind::Webview),
            ])
            .level(log::LevelFilter::Debug)
            .build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            // Configuration commands
            config::get_config,
            config::save_config,
            config::update_server_port,
            config::toggle_auto_start,
            config::set_theme,

            // Notification commands
            notifications::show_notification,
            notifications::show_server_notification,
            notifications::get_notification_settings,
            notifications::update_notification_settings,

            // Power management commands
            power::start_power_monitoring,
            power::stop_power_monitoring,
            power::is_power_monitoring_active,
            power::get_power_settings,
            power::update_power_settings,

            // System commands
            system::get_system_settings,
            system::update_system_settings,

            // CLI and utility commands
            check_cli_installation,
            install_cli_tool,
            open_external_url,
            // TODO: Fix duplicate command macro issue
            // get_app_version,
            // get_backend_logs,

            // Server management commands (core VibeTunnel functionality)
            server::start_server,
            server::stop_server,
            server::get_server_status,
            server::get_server_url,
            server::restart_server,

            // Session management commands
            sessions::get_sessions,
            sessions::create_session,
            sessions::delete_session,
            sessions::get_session_details,
        ])
        .setup(|app| {
            setup_app(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}// TunnelForge Windows - Tauri Application
// 
// This is the main entry point for the TunnelForge Windows desktop application built with Tauri.
// It provides Windows-specific integrations while sharing core functionality with the Linux version.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Child, Command};
use std::sync::{Arc, Mutex};

use tauri::{
    AppHandle, State
};
use serde::{Deserialize, Serialize};
use log::{error, info};

#[cfg(target_os = "windows")]
use {
    winreg::enums::*,
    winreg::RegKey,
    windows::Win32::UI::Shell::*,
};

// Application state
struct AppState {
    server_process: Arc<Mutex<Option<Child>>>,
    server_port: u16,
    is_quitting: Arc<Mutex<bool>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ServerStatus {
    running: bool,
    port: u16,
    pid: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
struct AppSettings {
    auto_start: bool,
    minimize_to_tray: bool,
    server_port: u16,
    enable_logging: bool,
    start_on_boot: bool,
    enable_windows_service: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            auto_start: true,
            minimize_to_tray: true,
            server_port: 4021,
            enable_logging: true,
            start_on_boot: false,
            enable_windows_service: false,
        }
    }
}

#[tauri::command]
fn get_server_status(state: State<AppState>) -> ServerStatus {
    let server_process = state.server_process.lock().unwrap();
    let running = server_process.is_some();
    let pid = server_process.as_ref().map(|p| p.id());
    
    ServerStatus {
        running,
        port: state.server_port,
        pid,
    }
}

#[tauri::command]
async fn start_server(handle: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let mut server_process = state.server_process.lock().unwrap();
    
    if server_process.is_some() {
        return Err("Server is already running".to_string());
    }

    info!("Starting TunnelForge server...");
    
    let mut cmd = Command::new("tunnelforge-server");
    cmd.current_dir("../bin");
    
    match cmd.spawn() {
        Ok(child) => {
            *server_process = Some(child);
            info!("TunnelForge server started successfully");
            Ok(())
        }
        Err(e) => {
            error!("Failed to start server: {}", e);
            Err(format!("Failed to start server: {}", e))
        }
    }
}

#[tauri::command]
async fn stop_server(state: State<'_, AppState>) -> Result<(), String> {
    let mut server_process = state.server_process.lock().unwrap();
    
    if let Some(mut child) = server_process.take() {
        info!("Stopping TunnelForge server...");
        
        match child.kill() {
            Ok(()) => {
                info!("TunnelForge server stopped successfully");
                Ok(())
            }
            Err(e) => {
                error!("Failed to stop server: {}", e);
                Err(format!("Failed to stop server: {}", e))
            }
        }
    } else {
        Err("Server is not running".to_string())
    }
}

#[tauri::command]
fn get_settings() -> AppSettings {
    // TODO: Load from registry or config file
    AppSettings::default()
}

#[tauri::command]
fn save_settings(settings: AppSettings) -> Result<(), String> {
    // TODO: Save to registry or config file
    info!("Settings saved: {:?}", settings);
    Ok(())
}

#[cfg(target_os = "windows")]
fn setup_windows_registry() -> Result<(), Box<dyn std::error::Error>> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let path = r"Software\TunnelForge";
    
    let (key, _disp) = hkcu.create_subkey(path)?;
    
    // Set some default values
    key.set_value("AutoStart", &1u32)?;
    key.set_value("MinimizeToTray", &1u32)?;
    key.set_value("ServerPort", &4021u32)?;
    
    Ok(())
}

#[cfg(target_os = "windows")]
fn add_to_startup() -> Result<(), Box<dyn std::error::Error>> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let path = r"Software\Microsoft\Windows\CurrentVersion\Run";
    
    let (key, _disp) = hkcu.create_subkey(path)?;
    let exe_path = std::env::current_exe()?;
    
    key.set_value("TunnelForge", &exe_path.to_string_lossy().to_string())?;
    
    Ok(())
}

fn main() {
    env_logger::init();
    
    info!("Starting TunnelForge Windows application");
    
    #[cfg(target_os = "windows")]
    {
        if let Err(e) = setup_windows_registry() {
            error!("Failed to setup Windows registry: {}", e);
        }
    }
    
    let app_state = AppState {
        server_process: Arc::new(Mutex::new(None)),
        server_port: 4021,
        is_quitting: Arc::new(Mutex::new(false)),
    };
    
    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            get_server_status,
            start_server,
            stop_server,
            get_settings,
            save_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
// TunnelForge Linux - Tauri Application
// 
// This is the main entry point for the TunnelForge Linux desktop application built with Tauri.
// It provides a lightweight, fast alternative to Electron with native system integration.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Child, Command};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, RunEvent, State};
use serde::{Deserialize, Serialize};
use log::{error, info, debug, warn};

mod settings;
mod services;

// Application state
struct AppState {
    server_process: Arc<Mutex<Option<Child>>>,
    server_port: u16,
    is_quitting: Arc<Mutex<bool>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ServerStatus {
    running: bool,
    port: u16,
    pid: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppSettings {
    auto_start: bool,
    show_in_dock: bool,
    server_port: u16,
    access_mode: String,
    notifications_enabled: bool,
    notification_sound: bool,
    session_start_notification: bool,
    session_end_notification: bool,
    error_notification: bool,
    prevent_sleep: bool,
    power_monitoring: bool,
    tailscale_enabled: bool,
    cloudflare_enabled: bool,
    ngrok_enabled: bool,
    ngrok_auth_token: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            auto_start: false,
            show_in_dock: true,
            server_port: 4021,
            access_mode: "local".to_string(),
            notifications_enabled: true,
            notification_sound: true,
            session_start_notification: true,
            session_end_notification: true,
            error_notification: true,
            prevent_sleep: false,
            power_monitoring: false,
            tailscale_enabled: false,
            cloudflare_enabled: false,
            ngrok_enabled: false,
            ngrok_auth_token: String::new(),
        }
    }
}

// Tauri commands
#[tauri::command]
async fn get_server_status(state: State<'_, AppState>) -> Result<ServerStatus, String> {
    debug!("Getting server status...");
    let server_process = state.server_process.lock().unwrap();
    
    match &*server_process {
        Some(child) => {
            let status = ServerStatus {
                running: true,
                port: state.server_port,
                pid: Some(child.id()),
            };
            info!("Server status: {:?}", status);
            Ok(status)
        }
        None => {
            let status = ServerStatus {
                running: false,
                port: state.server_port,
                pid: None,
            };
            info!("Server status: {:?}", status);
            Ok(status)
        },
    }
}

#[tauri::command]
async fn restart_server(state: State<'_, AppState>, app: AppHandle) -> Result<(), String> {
    info!("Restarting server...");
    
    // Stop current server
    stop_server_internal(&state)?;
    
    // Wait a moment
    thread::sleep(Duration::from_millis(1000));
    
    // Start new server
    start_server_internal(&state, &app)?;
    
    Ok(())
}

#[tauri::command]
async fn get_app_settings() -> Result<AppSettings, String> {
    // TODO: Load from config file
    Ok(AppSettings::default())
}

#[tauri::command]
async fn update_app_settings(settings: AppSettings) -> Result<(), String> {
    info!("Updating app settings: {:?}", settings);
    // TODO: Save to config file
    Ok(())
}

#[tauri::command]
async fn create_new_session(app: AppHandle) -> Result<(), String> {
    info!("Creating new session...");
    
    // Show main window and focus it
    if let Some(window) = app.get_webview_window("main") {
        debug!("Found main window, showing and focusing...");
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        
        // Emit event to web interface to create new session
        debug!("Emitting create-session event to web interface...");
        window.emit("create-session", {}).map_err(|e| e.to_string())?;
    } else {
        warn!("Main window not found!");
        return Err("Main window not found".to_string());
    }
    
    Ok(())
}

#[tauri::command]
async fn copy_server_url(state: State<'_, AppState>) -> Result<String, String> {
    let url = format!("http://localhost:{}", state.server_port);
    info!("Generated server URL: {}", url);
    
    // Copy to clipboard via tauri's clipboard API would be here
    // For now, just return URL for frontend to handle
    Ok(url)
}

// Internal server management
fn start_server_internal(state: &State<AppState>, app: &AppHandle) -> Result<(), String> {
    let mut server_process = state.server_process.lock().unwrap();
    
    if server_process.is_some() {
        return Err("Server is already running".to_string());
    }
    
    // Get the path to the bundled Go server
    let server_path = get_server_binary_path(app)?;
    
    info!("Starting Go server at: {}", server_path);
    
    // Set up environment variables
    let mut cmd = Command::new(&server_path);
    cmd.env("HOST", "127.0.0.1")
        .env("PORT", state.server_port.to_string())
        .env("ENABLE_RATE_LIMIT", "false")
        .env("ENABLE_REQUEST_LOG", if cfg!(debug_assertions) { "true" } else { "false" });
    
    // Start the process
    match cmd.spawn() {
        Ok(child) => {
            let child_id = child.id();
            info!("Go server started with PID: {}", child_id);
            *server_process = Some(child);
            
            // Emit status change event
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.emit("server-status-changed", ServerStatus {
                    running: true,
                    port: state.server_port,
                    pid: Some(child_id),
                });
            }
            
            Ok(())
        }
        Err(e) => {
            error!("Failed to start Go server: {}", e);
            Err(format!("Failed to start server: {}", e))
        }
    }
}

fn stop_server_internal(state: &State<AppState>) -> Result<(), String> {
    let mut server_process = state.server_process.lock().unwrap();
    
    if let Some(mut child) = server_process.take() {
        info!("Stopping Go server (PID: {})...", child.id());
        
        // Try graceful shutdown first
        match child.kill() {
            Ok(_) => {
                // Wait for process to exit
                let _ = child.wait();
                info!("Go server stopped successfully");
                Ok(())
            }
            Err(e) => {
                error!("Failed to stop Go server: {}", e);
                Err(format!("Failed to stop server: {}", e))
            }
        }
    } else {
        Ok(()) // Already stopped
    }
}

fn get_server_binary_path(app: &AppHandle) -> Result<String, String> {
    // In development, use the development server
    if cfg!(debug_assertions) {
        // Look for development Go server
        let dev_paths = [
            "../development/go-server/tunnelforge-server",
            "../../development/go-server/tunnelforge-server",
            "../../../development/go-server/tunnelforge-server",
        ];
        
        for path in &dev_paths {
            if std::path::Path::new(path).exists() {
                return Ok(path.to_string());
            }
        }
        
        return Err("Development server binary not found. Please build the Go server first.".to_string());
    }
    
    // In production, use bundled binary
    let resource_dir = app.path().resource_dir().map_err(|_| "Resource directory not found")?;
    let server_path = resource_dir.join("bin/tunnelforge-server");
    
    server_path.to_str()
        .ok_or_else(|| "Invalid server binary path".to_string())
        .map(|s| s.to_string())
}

// Application setup
fn setup_app(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    info!("Setting up TunnelForge application...");
    
    // Initialize app state
    let state = AppState {
    // Initialize app state
    let state = AppState {
        server_process: Arc<Mutex>::new(None), // Don't start server - connect to existing one
        server_port: 4021,
        is_quitting: Arc<Mutex>::new(false),
    };
    
    app.manage(state);
    
    info!("Connecting to existing Go server at port {}", state.server_port);
    
    // Show window immediately since we're not starting a server
    let app_handle_clone = app.handle();
    tauri::async_runtime::spawn(async move {
        // Wait a moment for frontend to load, then show window
        tokio::time::sleep(Duration::from_millis(1000)).await;
        
        if let Some(window) = app_handle_clone.get_webview_window("main") {
            if let Err(e) = window.show() {
                error!("Failed to show main window: {}", e);
            }
        }
    });
    
    Ok(())
}
                });
                
                // Event 2: Traditional page-load event
                let window_load = window.clone();
                window.listen("tauri://page-load", move |_event| {
                    log::info!("📄 tauri://page-load event detected!");
                    let inject_script = r#"
                        console.log('🎯 Page-load script executing!');
                        if (window.__TAURI_INVOKE__) {
                            window.__TAURI_INVOKE__('write_diagnostics', {
                                path: '/tmp/tauri-page-load.json',
                                content: JSON.stringify({ event: 'page-load', timestamp: new Date().toISOString(), tauriAvailable: true }, null, 2)
                            }).catch(e => console.error('Page-load event write failed:', e));
                        }
                    "#;
                    if let Err(e) = window_load.eval(inject_script) {
                        log::error!("Page-load inject failed: {}", e);
                    }
                });
                
                // Event 3: webview-created event
                let window_webview = window_clone.clone();
                window_clone.listen("tauri://webview-created", move |_event| {
                    log::info!("📄 tauri://webview-created event detected!");
                    let inject_script = r#"
                        console.log('🎯 Webview-created script executing!');
                        if (window.__TAURI_INVOKE__) {
                            window.__TAURI_INVOKE__('write_diagnostics', {
                                path: '/tmp/tauri-webview-created.json',
                                content: JSON.stringify({ event: 'webview-created', timestamp: new Date().toISOString(), tauriAvailable: true }, null, 2)
                            }).catch(e => console.error('Webview-created event write failed:', e));
                        }
                    "#;
                    if let Err(e) = window_webview.eval(inject_script) {
                        log::error!("Webview-created inject failed: {}", e);
                    }
                });
                
                log::info!("✅ All page load event listeners registered (3 events)");
            }
            
            app.manage(main_window);
            app.manage(ui::SettingsWindow::new());
            app.manage(ui::SessionWindow::new());

            let mut tray_manager = ui::TrayManager::new(app_handle.clone());
            tray_manager.setup_tray()?;
            app.manage(tray_manager);

            // Listen for access mode changes and restart the server with new binding
            let app_handle_clone = app_handle.clone();
            app.listen("access-mode-changed", move |_event| {
                log::info!("Received access-mode-changed event, restarting server with new binding...");
                
                let app_handle = app_handle_clone.clone();
                
                // Spawn a task to restart the server
                #[cfg(not(mobile))]
                {
                    std::thread::spawn(move || {
                        // Stop the server
                        if let Some(state) = app_handle.try_state::<tunnelforge_desktop::AppState>() {
                            if let Err(e) = server::stop_server_internal(&state) {
                                log::error!("Failed to stop server during restart: {}", e);
                            }
                        }
                        
                        // Wait a moment for clean shutdown
                        std::thread::sleep(std::time::Duration::from_millis(1000));
                        
                        // Start the server with new binding
                        if let Some(state) = app_handle.try_state::<tunnelforge_desktop::AppState>() {
                            match server::start_server_internal(&state, &app_handle) {
                                Ok(_) => log::info!("Server restarted successfully with new access mode"),
                                Err(e) => log::error!("Failed to restart server: {}", e),
                            }
                        }
                    });
                }
            });

            startup_timer_clone.record_ui_init();
            setup_app(app).map_err(|e| Box::new(std::io::Error::new(std::io::ErrorKind::Other, e)) as Box<dyn std::error::Error>)
        });

    app.run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
    // Initialize logging
    env_logger::Builder::from_default_env()
        .filter_level(if cfg!(debug_assertions) {
            log::LevelFilter::Debug
        } else {
            log::LevelFilter::Info
        })
        .init();
    
    info!("Starting TunnelForge Linux v{}", env!("CARGO_PKG_VERSION"));
    info!("System: {} {}", std::env::consts::OS, std::env::consts::ARCH);
    info!("Debug assertions: {}", cfg!(debug_assertions));
    
    tauri::Builder::default()
        .setup(setup_app)
        .invoke_handler(tauri::generate_handler![
            get_server_status,
            restart_server,
            get_app_settings,
            update_app_settings,
            create_new_session,
            copy_server_url,
            settings::general::get_general_settings,
            settings::general::update_general_settings,
            settings::general::toggle_launch_at_login,
            settings::general::install_cli,
            settings::general::uninstall_cli,
            settings::general::is_cli_installed,
            settings::dashboard::get_dashboard_settings,
            settings::dashboard::update_dashboard_settings,
            settings::dashboard::get_server_metrics,
            settings::dashboard::get_system_resources,
            settings::dashboard::ping_server,
            settings::remote_access::get_remote_access_settings,
            settings::remote_access::get_tailscale_status,
            settings::remote_access::connect_tailscale,
            settings::remote_access::disconnect_tailscale,
            settings::remote_access::start_ngrok_tunnel,
            settings::remote_access::stop_ngrok_tunnel,
            settings::remote_access::authenticate_cloudflare,
            settings::remote_access::start_cloudflare_tunnel,
            settings::remote_access::stop_cloudflare_tunnel,
            services::terminal::detect_available_terminals,
            services::terminal::get_terminal_preferences,
            services::terminal::update_terminal_preferences,
            services::terminal::launch_terminal,
            services::terminal::get_default_shell,
            services::terminal::detect_desktop_environment,
            services::startup::is_startup_enabled,
            services::startup::enable_startup,
            services::startup::disable_startup,
            services::startup::get_startup_service_status,
            services::keyring::store_credential,
            services::keyring::get_credential,
            services::keyring::delete_credential,
            services::keyring::list_credentials,
            services::keyring::is_keyring_available,
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            match event {
                RunEvent::ExitRequested { .. } => {
                    cleanup_app(app_handle);
                }
                _ => {}
            }
        });
}
