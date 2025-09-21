// Native Tauri System Tray Implementation
// This provides the system tray (menu bar) functionality for TunnelForge

use tauri::{AppHandle, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu, SystemTrayMenuItem, CustomMenuItem};
use tauri::api::version;
use std::sync::Arc;
use crate::server;

pub struct TrayManager {
    app_handle: AppHandle,
}

impl TrayManager {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }

    pub fn setup_tray(&self) -> Result<(), String> {
        let show_main = CustomMenuItem::new("show_main".to_string(), "Show Main Window");
        let show_settings = CustomMenuItem::new("show_settings".to_string(), "Settings");
        let create_session = CustomMenuItem::new("create_session".to_string(), "New Session");
        let quit = CustomMenuItem::new("quit".to_string(), "Quit TunnelForge");

        let tray_menu = SystemTrayMenu::new()
            .add_item(show_main)
            .add_item(show_settings)
            .add_native_item(SystemTrayMenuItem::Separator)
            .add_item(create_session)
            .add_native_item(SystemTrayMenuItem::Separator)
            .add_item(quit);

        let tray = SystemTray::new()
            .with_menu(tray_menu)
            .with_tooltip("TunnelForge - Terminal Sharing");

        // Set up system tray event handler
        let app_handle = self.app_handle.clone();
        tray.on_event(move |event| {
            match event {
                SystemTrayEvent::MenuItemClick { id, .. } => {
                    match id.as_str() {
                        "show_main" => {
                            let _ = app_handle.emit_all("show_main_window", ());
                        }
                        "show_settings" => {
                            let _ = app_handle.emit_all("show_settings_window", ());
                        }
                        "create_session" => {
                            let _ = app_handle.emit_all("create_new_session", ());
                        }
                        "quit" => {
                            let _ = app_handle.emit_all("quit_application", ());
                        }
                        _ => {}
                    }
                }
                SystemTrayEvent::LeftClick { .. } => {
                    let _ = app_handle.emit_all("tray_left_click", ());
                }
                SystemTrayEvent::RightClick { .. } => {
                    let _ = app_handle.emit_all("tray_right_click", ());
                }
                SystemTrayEvent::DoubleClick { .. } => {
                    let _ = app_handle.emit_all("tray_double_click", ());
                }
                _ => {}
            }
        });

        // Build the tray
        tray.build(&self.app_handle)
            .map_err(|e| format!("Failed to build system tray: {}", e))?;

        Ok(())
    }

    pub fn update_tray_menu(&self, server_running: bool) -> Result<(), String> {
        // Update tray menu based on server status
        // This would be called when server starts/stops
        Ok(())
    }

    pub fn set_tray_tooltip(&self, tooltip: &str) -> Result<(), String> {
        // Update tray tooltip
        Ok(())
    }

    pub fn set_tray_icon(&self, icon_path: &str) -> Result<(), String> {
        // Update tray icon
        Ok(())
    }
}

// Tauri commands for tray management
#[tauri::command]
pub async fn update_tray_status(app_handle: AppHandle, server_running: bool) -> Result<(), String> {
    let tray_manager = app_handle.state::<TrayManager>();
    let tray_manager = tray_manager.inner();
    tray_manager.update_tray_menu(server_running)
}

#[tauri::command]
pub async fn set_tray_tooltip(app_handle: AppHandle, tooltip: String) -> Result<(), String> {
    let tray_manager = app_handle.state::<TrayManager>();
    let tray_manager = tray_manager.inner();
    tray_manager.set_tray_tooltip(&tooltip)
}

#[tauri::command]
pub async fn set_tray_icon(app_handle: AppHandle, icon_path: String) -> Result<(), String> {
    let tray_manager = app_handle.state::<TrayManager>();
    let tray_manager = tray_manager.inner();
    tray_manager.set_tray_icon(&icon_path)
}
