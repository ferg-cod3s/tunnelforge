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
use log::{error, info};

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
struct AppSettings {
    auto_start: bool,
    minimize_to_tray: bool,
    server_port: u16,
    enable_logging: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            auto_start: false,
            minimize_to_tray: true,
            server_port: 4021,
            enable_logging: false,
        }
    }
}

// Tauri commands
#[tauri::command]
async fn get_server_status(state: State<'_, AppState>) -> Result<ServerStatus, String> {
    let server_process = state.server_process.lock().unwrap();
    
    match &*server_process {
        Some(child) => {
            Ok(ServerStatus {
                running: true,
                port: state.server_port,
                pid: Some(child.id()),
            })
        }
        None => Ok(ServerStatus {
            running: false,
            port: state.server_port,
            pid: None,
        }),
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
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        
        // Emit event to web interface to create new session
        window.emit("create-session", {}).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
async fn copy_server_url(state: State<'_, AppState>) -> Result<String, String> {
    let url = format!("http://localhost:{}", state.server_port);
    
    // Copy to clipboard via tauri's clipboard API would be here
    // For now, just return the URL for the frontend to handle
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
        server_process: Arc::new(Mutex::new(None)),
        server_port: 4021,
        is_quitting: Arc::new(Mutex::new(false)),
    };
    
    app.manage(state);
    
    // Start the Go server
    let app_handle = app.handle();
    
    // Clone the app handle for use in the async closure
    let app_handle_clone = app_handle.clone();
    
    tauri::async_runtime::spawn(async move {
        let app_state = app_handle_clone.state::<AppState>();
        if let Err(e) = start_server_internal(&app_state, &app_handle_clone) {
            error!("Failed to start server during setup: {}", e);
        }
        
        // Wait a moment for server to start, then show window
        tokio::time::sleep(Duration::from_millis(2000)).await;
        
        if let Some(window) = app_handle_clone.get_webview_window("main") {
            if let Err(e) = window.show() {
                error!("Failed to show main window: {}", e);
            }
        }
    });
    
    Ok(())
}

// Application cleanup
fn cleanup_app(app: &AppHandle) {
    info!("Cleaning up TunnelForge application...");
    
    let state = app.state::<AppState>();
    *state.is_quitting.lock().unwrap() = true;
    
    if let Err(e) = stop_server_internal(&state) {
        error!("Error during server cleanup: {}", e);
    }
}

fn main() {
    // Initialize logging
    env_logger::Builder::from_default_env()
        .filter_level(if cfg!(debug_assertions) {
            log::LevelFilter::Debug
        } else {
            log::LevelFilter::Info
        })
        .init();
    
    info!("Starting TunnelForge Linux v{}", env!("CARGO_PKG_VERSION"));
    
    tauri::Builder::default()
        .setup(setup_app)
        .invoke_handler(tauri::generate_handler![
            get_server_status,
            restart_server,
            get_app_settings,
            update_app_settings,
            create_new_session,
            copy_server_url
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
