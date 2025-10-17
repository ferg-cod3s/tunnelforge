use std::sync::{Arc, Mutex};
use std::process::Child;
use chrono::Utc;

// Platform integration trait
pub trait PlatformIntegration {
    fn get_platform_name() -> &'static str;
    fn is_supported() -> bool;
    fn get_config_paths() -> Vec<std::path::PathBuf>;
    fn setup_auto_launch(&self, enabled: bool) -> Result<(), String>;
    fn setup_system_tray(&self, app_handle: &tauri::AppHandle) -> Result<(), String>;
    fn setup_notifications(&self) -> Result<(), String>;
    fn setup_power_management(&self) -> Result<(), String>;
}

// Import modules
pub mod config;
pub mod access_mode_service;
mod linux_platform;
mod cloudflare_service; // Cloudflare tunnel integration
// mod security; // Temporarily disabled due to secrecy crate API changes

// Application state structure
#[derive(Debug)]
pub struct AppState {
    pub server_process: Arc<Mutex<Option<Child>>>,
    pub server_port: u16,
    pub config: Arc<Mutex<config::AppConfig>>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ServerStatus {
    pub running: bool,
    pub port: u16,
    pub pid: Option<u32>,
}

#[derive(Debug, Clone)]
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
        timestamp: Utc::now().format("%H:%M:%S").to_string(),
        level: level.to_string(),
        message: message.to_string(),
    };

    if let Ok(mut buffer) = LOG_BUFFER.lock() {
        buffer.push(entry);
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
        log::error!("Failed to access log buffer");
        vec![LogEntry {
            timestamp: Utc::now().format("%H:%M:%S").to_string(),
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
pub fn setup_app(_app: &mut tauri::App) -> Result<(), String> {
    log::info!("TunnelForge Desktop starting up...");
    log::info!("Version: {}", env!("CARGO_PKG_VERSION"));

    log::info!("Setting up TunnelForge Desktop app");


    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_state_initialization() {
        let state = init_app_state();
        assert_eq!(state.server_port, 4021);
    }

    #[test]
    fn test_logging() {
        add_log_entry("info", "test message");
        // Basic smoke test to ensure logging doesn't panic
    }
}
