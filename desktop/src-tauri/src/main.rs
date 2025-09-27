// TunnelForge Desktop - Native Tauri v2 Application
// This provides a native desktop interface that directly integrates with the Go server

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_log::{Target, TargetKind};
use futures::future::join_all;

// Import the library modules
use tunnelforge_desktop::{
    init_app_state, setup_app, config, notifications, power, system, ui,
    access_mode_service, ngrok_service, cloudflare_service, server, sessions,
    metrics::{StartupTimer, StartupMetrics}
};

// Feature flags for startup optimizations
const ENABLE_PARALLEL_UI_INIT: bool = true;
const ENABLE_STARTUP_METRICS: bool = true;

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

#[tauri::command]
async fn get_startup_metrics() -> Result<StartupMetrics, String> {
    if !ENABLE_STARTUP_METRICS {
        return Err("Startup metrics are disabled".to_string());
    }

    let startup_timer = STARTUP_TIMER.get().ok_or("Startup timer not initialized")?;
    Ok(startup_timer.get_metrics())
}

// Global startup timer
static STARTUP_TIMER: once_cell::sync::OnceCell<Arc<StartupTimer>> = once_cell::sync::OnceCell::new();

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize startup timer
    let startup_timer = Arc::new(StartupTimer::new());
    let _ = STARTUP_TIMER.set(startup_timer.clone());

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
            // Configuration commands
            config::get_config,
            config::save_config,
            config::update_server_port,
            config::toggle_auto_start,
            config::set_theme,

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
            get_startup_metrics,

            // Server management commands
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

            // UI commands
            ui::show_main_window,
            ui::hide_main_window,
            ui::close_main_window,
            ui::get_window_state,
            ui::update_window_state,

            ui::show_settings_window,
            ui::hide_settings_window,
            ui::close_settings_window,
            ui::get_settings_window_state,
            ui::update_settings_window_state,

            ui::show_session_window,
            ui::hide_session_window,
            ui::close_session_window,
            ui::get_session_window_state,
            ui::update_session_window_state,

            ui::update_tray_status,
            ui::set_tray_tooltip,
            ui::set_tray_icon,

            // Service integration commands
            ui::toggle_tailscale_integration,
            ui::toggle_cloudflare_integration,
            ui::toggle_ngrok_integration,
            ui::set_ngrok_auth_token,

            // Access mode commands
            access_mode_service::get_access_mode_status,
            access_mode_service::check_network_access,
            access_mode_service::set_access_mode,
            access_mode_service::get_current_binding,
            access_mode_service::test_network_connectivity,
        ]);

    // Parallel UI initialization if enabled
    if ENABLE_PARALLEL_UI_INIT {
        let app = app.setup(move |app| {
            let app_handle = app.handle();
            
            // Create services that need AppHandle during setup
            let futures = vec![
                Box::pin(async move {
                    app.manage(access_mode_service::AccessModeService::new(app_handle.clone()));
                }),
                Box::pin(async move {
                    app.manage(ngrok_service::NgrokService::new(app_handle.clone()));
                }),
                Box::pin(async move {
                    app.manage(cloudflare_service::CloudflareService::new(app_handle.clone()));
                }),
                Box::pin(async move {
                    app.manage(ui::MainWindow::new());
                }),
                Box::pin(async move {
                    app.manage(ui::SettingsWindow::new());
                }),
                Box::pin(async move {
                    app.manage(ui::SessionWindow::new());
                }),
            ];

            // Run all initialization futures in parallel
            tokio::runtime::Runtime::new()
                .unwrap()
                .block_on(async {
                    join_all(futures).await;
                });

            startup_timer.record_ui_init();
            setup_app(app)
        });

        app.run(tauri::generate_context!())
            .expect("error while running tauri application");
    } else {
        // Sequential initialization (original behavior)
        let app = app.setup(|app| {
            let app_handle = app.handle();
            
            app.manage(access_mode_service::AccessModeService::new(app_handle.clone()));
            app.manage(ngrok_service::NgrokService::new(app_handle.clone()));
            app.manage(cloudflare_service::CloudflareService::new(app_handle.clone()));
            app.manage(ui::MainWindow::new());
            app.manage(ui::SettingsWindow::new());
            app.manage(ui::SessionWindow::new());

            startup_timer.record_ui_init();
            setup_app(app)
        });

        app.run(tauri::generate_context!())
            .expect("error while running tauri application");
    }
}

fn main() {
    run();
}
