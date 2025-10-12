// TunnelForge Desktop - Native Tauri v2 Application
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;
use tauri::Manager;
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
            access_mode_service::set_access_mode,
            access_mode_service::get_current_binding,
            access_mode_service::test_network_connectivity,
        ])
        .setup(move |app| {
            let app_handle = app.handle();
            
            app.manage(access_mode_service::AccessModeService::new(app_handle.clone()));
            app.manage(ngrok_service::NgrokService::new(app_handle.clone()));
            app.manage(cloudflare_service::CloudflareService::new(app_handle.clone()));
            app.manage(ui::MainWindow::new());
            app.manage(ui::SettingsWindow::new());
            app.manage(ui::SessionWindow::new());

            startup_timer_clone.record_ui_init();
            setup_app(app).map_err(|e| Box::new(std::io::Error::new(std::io::ErrorKind::Other, e)) as Box<dyn std::error::Error>)
        });

    app.run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
