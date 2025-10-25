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

// Helper function to check if server is already running on port
fn is_server_running(port: u16) -> bool {
    use std::net::{TcpStream, SocketAddr};
    use std::time::Duration;

    let addr = format!("127.0.0.1:{}", port);
    if let Ok(socket_addr) = addr.parse::<SocketAddr>() {
        TcpStream::connect_timeout(&socket_addr, Duration::from_millis(1000)).is_ok()
    } else {
        false
    }
}

// Tauri commands
#[tauri::command]
async fn get_server_status(state: State<'_, AppState>) -> Result<ServerStatus, String> {
    debug!("Getting server status...");
    let server_process = state.server_process.lock().unwrap();
    let port_running = is_server_running(state.server_port);

    match &*server_process {
        Some(child) => {
            // Check if our managed process is still running AND the port is accessible
            // Note: We can't call try_wait() on a &Child, so we just check if port is accessible
            let status = ServerStatus {
                running: port_running,
                port: state.server_port,
                pid: Some(child.id()),
            };
            info!("Server status: {:?}", status);
            Ok(status)
        }
        None => {
            // No managed process, but check if server is running on port anyway
            let status = ServerStatus {
                running: port_running,
                port: state.server_port,
                pid: None, // We don't know the PID if we didn't start it
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
        info!("Server process already exists in state");
        return Ok(());
    }

    // Check if server is already running on the port
    if is_server_running(state.server_port) {
        info!("Server is already running on port {}, not starting a new one", state.server_port);
        return Ok(());
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
    let server_port = 4021;
    let state = AppState {
        server_process: Arc::new(Mutex::new(None)), // Don't start server - connect to existing one
        server_port,
        is_quitting: Arc::new(Mutex::new(false)),
    };
    
    info!("Connecting to existing Go server at port {}", server_port);
    
app.manage(state);
    
    info!("Connecting to existing Go server at port {}", server_port);
    
    // Show window immediately since we're not starting a server
    let app_handle = app.handle().clone();
    tauri::async_runtime::spawn(async move {
        // Wait a moment for frontend to load, then show window
        tokio::time::sleep(Duration::from_millis(1000)).await;
        
        if let Some(window) = app_handle.get_webview_window("main") {
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
