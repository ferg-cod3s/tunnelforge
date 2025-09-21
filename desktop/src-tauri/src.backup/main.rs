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
}