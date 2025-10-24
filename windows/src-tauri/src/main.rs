// TunnelForge Windows - Tauri Application
// 
// This is the main entry point for the TunnelForge Windows desktop application built with Tauri.
// It provides Windows-specific integrations while sharing core functionality with the Linux version.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Child, Command};
use std::sync::{Arc, Mutex};
use std::fs;

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

// ===== DIAGNOSTIC COMMANDS FOR JAVASCRIPT TESTING =====

#[tauri::command]
async fn write_diagnostics(path: String, content: String) -> Result<(), String> {
    let temp_path = if cfg!(target_os = "windows") {
        // Use Windows temp directory
        std::env::var("TEMP").unwrap_or_else(|_| "C:\\temp".to_string())
    } else {
        "/tmp".to_string()
    };
    
    let full_path = if path.starts_with('/') || path.starts_with('\\') || path.contains(':') {
        path.clone()
    } else {
        format!("{}\\{}", temp_path, path)
    };
    
    match fs::write(&full_path, content) {
        Ok(_) => {
            info!("Diagnostics written to: {}", full_path);
            Ok(())
        }
        Err(e) => {
            error!("Failed to write diagnostics to {}: {}", full_path, e);
            Err(format!("Failed to write diagnostics: {}", e))
        }
    }
}

#[tauri::command]
async fn test_rust_command() -> Result<String, String> {
    let response = serde_json::json!({
        "status": "success",
        "message": "Rust command executed successfully",
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "platform": "windows",
        "tauri_version": "2.8"
    });
    
    Ok(response.to_string())
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
            save_settings,
            // Diagnostic commands for JavaScript testing
            write_diagnostics,
            test_rust_command
        ])
        .setup(|app| {
            // Write initialization diagnostics
            let temp_path = if cfg!(target_os = "windows") {
                std::env::var("TEMP").unwrap_or_else(|_| "C:\\temp".to_string())
            } else {
                "/tmp".to_string()
            };
            
            let init_data = serde_json::json!({
                "source": "rust_initialization",
                "timestamp": chrono::Utc::now().to_rfc3339(),
                "platform": "windows",
                "tauri_available": true,
                "app_handle_created": true
            });
            
            if let Err(e) = fs::write(format!("{}\\tauri-rust-init.json", temp_path), init_data.to_string()) {
                error!("Failed to write init diagnostics: {}", e);
            } else {
                info!("Initialization diagnostics written to: {}\\tauri-rust-init.json", temp_path);
            }
            
            Ok(())
        })
        .on_page_load(|webview, _payload| {
            // Inject JavaScript after page loads
            let js = r#"
                setTimeout(() => {
                    if (window.__TAURI_INVOKE__) {
                        window.__TAURI_INVOKE__('write_diagnostics', {
                            path: 'tauri-post-load.json',
                            content: JSON.stringify({
                                source: 'page_load_event',
                                timestamp: new Date().toISOString(),
                                tauri_invoke_available: true,
                                platform: 'windows'
                            })
                        }).catch(err => {
                            console.error('Failed to write post-load diagnostics:', err);
                        });
                    } else {
                        console.error('Tauri invoke not available in page load');
                    }
                }, 1000);
            "#;
            
            if let Err(e) = webview.eval(js) {
                log::error!("❌ Page load injection failed: {}", e);
            } else {
                info!("JavaScript injection scheduled for page load");
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}