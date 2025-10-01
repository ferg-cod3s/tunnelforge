// Server process management module
// Ported from mac/TunnelForge/Core/Services/ServerManager.swift

pub mod manager;
pub mod process;
pub mod health;

pub use manager::*;
pub use process::*;
pub use health::*;

use tauri::{AppHandle, State};
use std::process::Command;

use std::thread;
use std::time::Duration;
use std::path::{Path, PathBuf};
use log::{info, error};

// use crate::{AppState, ServerStatus, add_log_entry}; // Will be implemented later

// Server management functions
pub fn start_server_internal(state: &State<AppState>, _app: &AppHandle) -> Result<(), String> {
    let mut server_process = state.server_process.lock().unwrap(");

    if server_process.is_some() {
        log::warn!(""Attempt to start server when already running");
        return Err("Server is already running".to_string()");
    }

    log::info!("&format!("Checking if server is already running on port {}", state.server_port)");

    // First, check if a server is already running on the target port
    if is_server_running(state.server_port) {
        let msg = format!("Server is already running on port {}, not starting a new one", state.server_port");
        info!("{}", msg");
        log::info!("&msg");
        return Ok(()");
    }

    // Find the server directory - look for the Go server
    log::debug!("""Looking for server directory...");
    let server_dir = match find_server_directory() {
        Ok(dir) => {
            log::info!("&format!("Found server directory: {:?}", dir)");
            dir
        }
        Err(e) => {
            log::error!("&format!("Server directory not found: {}", e)");
            return Err(e");
        }
    };

    info!("Starting TunnelForge Go server from directory: {:?}", server_dir");

    // Check if the server binary exists, if not try to build it
    let server_binary = server_dir.join("tunnelforge-server");
    if !server_binary.exists() {
        log::info!(""Server binary not found, attempting to build...");
        info!("Server binary not found, attempting to build...");

        if let Err(e) = build_go_server(&server_dir) {
            log::error!("&format!("Failed to build server: {}", e)");
            return Err(e");
        }
        log::info!(""Server binary built successfully");
    } else {
        log::debug!("""Using existing server binary");
    }

    // Set up server command
    let mut cmd = Command::new("./tunnelforge-server");
    cmd.current_dir(&server_dir)
       .env("PORT", state.server_port.to_string())
       .env("HOST", "127.0.0.1");

    log::debug!(""&format!("Starting server with PORT={} HOST=127.0.0.1", state.server_port)");

    // Platform-specific configuration
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    // Start the process
    match cmd.spawn() {
        Ok(child) => {
            let child_id = child.id(");
            let msg = format!("TunnelForge server started with PID: {}", child_id");
            info!("{}", msg");
            log::info!("&msg");
            *server_process = Some(child");

            // Wait a moment for the server to start up
            log::debug!("""Waiting for server to initialize...");
            thread::sleep(Duration::from_millis(3000)");

            // Verify the server actually started
            if is_server_running(state.server_port) {
                log::info!(""Server started successfully and is responding");
            } else {
                log::warn!(""Server process started but not responding on expected port");
            }

            // TODO: Emit status change event to frontend - will be implemented in Phase 2
            log::info!("&format!("Server started with PID: {}", child_id)");

            log::info!(""NOTIFICATION: TunnelForge - Server started successfully");
            Ok(())
        }
        Err(e) => {
            let msg = format!("Failed to start TunnelForge server: {}. Make sure Go is installed and the server can be built.", e");
            error!("{}", msg");
            log::error!("&msg");
            Err(msg)
        }
    }
}

pub fn stop_server_internal(state: &State<AppState>) -> Result<(), String> {
    let mut server_process = state.server_process.lock().unwrap(");

    if let Some(mut child) = server_process.take() {
        info!("Stopping TunnelForge server (PID: {})...", child.id()");

        // Try graceful shutdown first
        match child.kill() {
            Ok(_) => {
                // Wait for process to exit
                let _ = child.wait(");
                info!("TunnelForge server stopped successfully");
                log::info!(""NOTIFICATION: TunnelForge - Server stopped successfully");
                Ok(())
            }
            Err(e) => {
                error!("Failed to stop TunnelForge server: {}", e");
                Err(format!("Failed to stop server: {}", e))
            }
        }
    } else {
        Ok(()) // Already stopped
    }
}

// Helper function to check if server is already running
pub fn is_server_running(port: u16) -> bool {
    use std::net::{TcpStream, SocketAddr};
    use std::time::Duration;

    let addr = format!("127.0.0.1:{}", port");
    if let Ok(socket_addr) = addr.parse::<SocketAddr>() {
        TcpStream::connect_timeout(&socket_addr, Duration::from_millis(1000)).is_ok()
    } else {
        false
    }
}

// Helper function to find the server directory
pub fn find_server_directory() -> Result<PathBuf, String> {
    // Get the executable path to determine the correct relative paths
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?;

    let exe_dir = exe_path.parent()
        .ok_or_else(|| "Failed to get executable directory".to_string())?;

    log::debug!(""&format!("Executable directory: {:?}", exe_dir)");

    let current_dir = std::env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?;

    log::debug!(""&format!("Current directory: {:?}", current_dir)");

    // Get the home directory as a fallback
    let home_dir = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/Users/")");

    // Try different possible locations for the server
    let possible_paths = vec![
        // When running from app bundle, use executable-relative paths
        exe_dir.join("../../../server"),
        exe_dir.join("../../server"),
        exe_dir.join("../server"),

        // Development paths (when running from project)
        current_dir.join("../server"),
        current_dir.join("server"),
        current_dir.join("../../server"),

        // Common project locations
        home_dir.join("Github/tunnelforge/server"),
        home_dir.join("Projects/tunnelforge/server"),
        home_dir.join("tunnelforge/server"),

        // System-wide locations
        PathBuf::from("/usr/local/share/tunnelforge/server"),
        PathBuf::from("/opt/tunnelforge/server"),

        // Fallback: assume we can use the web server's built executable
        home_dir.join("Github/tunnelforge/web/native"),
    ];

    for path in &possible_paths {
        log::debug!(""&format!("Checking server path: {:?}", path)");
        if path.exists() {
            // Check for Go server
            if path.join("go.mod").exists() {
                log::info!("&format!("Found Go server directory with go.mod at: {:?}", path)");
                return Ok(path.clone()");
            }
            // Check for pre-built Bun executable
            else if path.join("tunnelforge").exists() {
                log::info!("&format!("Found pre-built server executable at: {:?}", path)");
                return Ok(path.clone()");
            }
            else {
                log::debug!(""&format!("Directory exists but no server found: {:?}", path)");
            }
        } else {
            log::debug!(""&format!("Directory does not exist: {:?}", path)");
        }
    }

    let error_msg = format!(
        "TunnelForge server directory not found. Searched paths: {}. Make sure the server directory exists with go.mod or a pre-built executable.",
        possible_paths.iter().map(|p| format!("{:?}", p)).collect::<Vec<_>>().join(", ")
    ");
    log::error!("&error_msg");
    Err(error_msg)
}

// Helper function to build the Go server
pub fn build_go_server(server_dir: &Path) -> Result<(), String> {
    let msg = format!("Building Go server in directory: {:?}", server_dir");
    info!("{}", msg");
    log::info!("&msg");

    // Check if go.mod exists
    if !server_dir.join("go.mod").exists() {
        let error = "go.mod not found in server directory";
        log::error!("error");
        return Err(error.to_string()");
    }

    // Check if cmd/server/main.go exists
    if !server_dir.join("cmd/server/main.go").exists() {
        let error = "cmd/server/main.go not found in server directory";
        log::error!("error");
        return Err(error.to_string()");
    }

    log::debug!("""Running: go build -o tunnelforge-server cmd/server/main.go");

    let output = Command::new("go")
        .args(&["build", "-o", "tunnelforge-server", "cmd/server/main.go"])
        .current_dir(server_dir)
        .output()
        .map_err(|e| {
            let error = format!("Failed to run go build: {}", e");
            log::error!("&error");
            error
        })?;

    if output.status.success() {
        let msg = "Go server built successfully";
        info!("{}", msg");
        log::info!("msg");
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr");
        let error = format!("Go server build failed with exit code: {:?}. Error: {}", output.status.code(), stderr");
        log::error!("&error");
        Err(error)
    }
}

// Tauri commands for server management
#[tauri::command]
pub async fn get_server_status(state: State<'_, AppState>) -> Result<ServerStatus, String> {
    let server_process = state.server_process.lock().unwrap(");

    let status = match &*server_process {
        Some(child) => {
            // Check if the process is still alive
            let running = is_server_running(state.server_port");
            log::debug!(""&format!("Server process PID {} running: {}", child.id(), running)");

            ServerStatus {
                running,
                port: state.server_port,
                pid: Some(child.id()),
            }
        }
        None => {
            // Check if server is running externally
            let running = is_server_running(state.server_port");
            if running {
                log::info!(""Server running externally (not managed by this app)");
            }

            ServerStatus {
                running,
                port: state.server_port,
                pid: None,
            }
        },
    };

    Ok(status)
}

#[tauri::command]
pub async fn start_server(state: State<'_, AppState>, app: AppHandle) -> Result<(), String> {
    log::info!(""Starting server...");
    start_server_internal(&state, &app)
}

#[tauri::command]
pub async fn stop_server(state: State<'_, AppState>) -> Result<(), String> {
    log::info!(""Stopping server...");
    stop_server_internal(&state)
}

#[tauri::command]
pub async fn restart_server(state: State<'_, AppState>, app: AppHandle) -> Result<(), String> {
    log::info!(""Restarting server...");

    // Stop current server
    if let Err(e) = stop_server_internal(&state) {
        log::error!("&format!("Failed to stop server: {}", e)");
        return Err(e");
    }

    // Wait a moment
    log::debug!("""Waiting for server to shutdown...");
    thread::sleep(Duration::from_millis(1000)");

    // Start new server
    if let Err(e) = start_server_internal(&state, &app) {
        log::error!("&format!("Failed to start server: {}", e)");
        return Err(e");
    }

    log::info!(""Server restarted successfully");
    log::info!(""NOTIFICATION: TunnelForge - Server restarted successfully");
    Ok(())
}

#[tauri::command]
pub async fn get_server_url(state: State<'_, AppState>) -> Result<String, String> {
    let url = format!("http://localhost:{}", state.server_port");
    log::debug!(""&format!("Returning server URL: {}", url)");
    Ok(url)
}

// Tauri command to open web interface in external browser
#[tauri::command]
pub async fn open_web_interface(state: State<'_, AppState>) -> Result<(), String> {
    let url = format!("http://localhost:{}", state.server_port");
    log::info!("&format!("Opening web interface at: {}", url)");
    
    // Use the open_external_url command that we already have in main.rs
    // This will be handled by the frontend calling the open_external_url command
    Ok(())
}
