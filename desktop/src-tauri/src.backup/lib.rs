// TunnelForge Desktop - Tauri v2 Core Library
// This library contains the main application logic for the TunnelForge desktop application

use tauri::{AppHandle, Manager};
use std::sync::{Arc, Mutex};
use std::process::Child;
use serde::{Deserialize, Serialize};

// Platform integration trait for cross-platform features
pub trait PlatformIntegration {
    fn setup_auto_launch(&self, enabled: bool) -> Result<(), String>;
    fn setup_system_tray(&self, app_handle: &AppHandle) -> Result<(), String>;
    fn setup_notifications(&self) -> Result<(), String>;
    fn setup_power_management(&self) -> Result<(), String>;
}

pub mod config;
pub mod notifications;
pub mod power;
pub mod system;

pub mod server;
pub mod sessions;

// Re-export platform-specific modules
#[cfg(target_os = "macos")]
pub mod macos_platform;

#[cfg(target_os = "windows")]
pub mod windows_platform;

#[cfg(target_os = "linux")]
pub mod linux_platform;

// Application state
#[derive(Debug)]
pub struct AppState {
    pub server_process: Arc<Mutex<Option<Child>>>,
    pub server_port: u16,
    pub config: Arc<Mutex<config::AppConfig>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerStatus {
    pub running: bool,
    pub port: u16,
    pub pid: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: String,
    pub level: String,
    pub message: String,
}

// Initialize the application with proper state management
pub fn init_app_state() -> AppState {
    AppState {
        server_process: Arc::new(Mutex::new(None)),
        server_port: 4021, // Connect to Go server on port 4021
        config: Arc::new(Mutex::new(config::AppConfig::default())),
    }
}

// Central logging system
static LOG_BUFFER: std::sync::Mutex<Vec<LogEntry>> = std::sync::Mutex::new(Vec::new());

pub fn add_log_entry(level: &str, message: &str) {
    let entry = LogEntry {
        timestamp: chrono::Utc::now().format("%H:%M:%S").to_string(),
        level: level.to_string(),
        message: message.to_string(),
    };

    if let Ok(mut buffer) = LOG_BUFFER.lock() {
        buffer.push(entry);
        // Keep only the last 200 entries
        if buffer.len() > 200 {
            buffer.remove(0);
        }
    }
}

// Backend log and version access functions (non-Tauri commands for now)
pub async fn get_backend_logs_internal(limit: Option<usize>) -> Result<Vec<LogEntry>, String> {
    let mut logs = if let Ok(buffer) = LOG_BUFFER.lock() {
        buffer.clone()
    } else {
        add_log_entry("error", "Failed to access log buffer");
        vec![LogEntry {
            timestamp: chrono::Utc::now().format("%H:%M:%S").to_string(),
            level: "error".to_string(),
            message: "Failed to access log buffer".to_string(),
        }]
    };

    // Apply limit if specified
    if let Some(limit) = limit {
        let start = if logs.len() > limit { logs.len() - limit } else { 0 };
        logs = logs[start..].to_vec();
    }

    Ok(logs)
}

pub async fn get_app_version_internal() -> Result<String, String> {
    Ok(env!("CARGO_PKG_VERSION").to_string())
}

// App setup function
pub fn setup_app(app: &mut tauri::App) -> Result<(), String> {
    add_log_entry("info", "TunnelForge Desktop starting up...");
    add_log_entry("info", &format!("App version: {}", env!("CARGO_PKG_VERSION")));

    // Initialize logging
    log::info!("Setting up TunnelForge Desktop app");

    // Set up system tray (VibeTunnel-style menu bar app)
    add_log_entry("info", "Setting up system tray interface");
    use crate::system::tray::TrayManager;
    let tray_manager = TrayManager::new(app.handle().clone());
    if let Err(e) = tray_manager.setup_tray() {
        add_log_entry("error", &format!("Failed to setup system tray: {}", e));
        log::error!("Failed to setup system tray: {}", e);
    }

    // Check if server is already running before attempting to start
    let state = app.state::<AppState>();
    let server_port = state.server_port;
    
    if server::is_server_running(server_port) {
        add_log_entry("info", &format!("Server already running on port {}, skipping startup", server_port));
        log::info!("Server already running on port {}, skipping startup", server_port);
    } else {
        add_log_entry("info", "Attempting to start TunnelForge server...");
        let app_handle = app.handle().clone();
        if let Err(e) = server::start_server_internal(&state, &app_handle) {
            let msg = format!("Failed to start server during setup: {}", e);
            log::error!("{}", msg);
            add_log_entry("error", &msg);
            // Don't fail the app startup if server fails to start
        }
    }

    add_log_entry("info", "TunnelForge Desktop initialization complete");
    Ok(())
}
