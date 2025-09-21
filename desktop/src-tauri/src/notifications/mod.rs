// Port of NotificationService.swift functionality



use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use log::info;

use crate::add_log_entry;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationSettings {
    pub enabled: bool,
    pub sound_enabled: bool,
    pub show_in_dock: bool,
    pub show_server_status: bool,
}

impl Default for NotificationSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            sound_enabled: true,
            show_in_dock: true,
            show_server_status: true,
        }
    }
}

// Tauri commands for notifications
#[tauri::command]
pub async fn show_notification(
    app: AppHandle,
    title: String,
    message: String
) -> Result<(), String> {
    add_log_entry("info", &format!("Showing notification: {} - {}", title, message));
    info!("Showing notification: {} - {}", title, message);

    // Use Tauri's notification plugin
    use tauri_plugin_notification::NotificationExt;
    app.notification()
        .builder()
        .title(title)
        .body(message)
        .show()
        .map_err(|e| format!("Failed to show notification: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn show_server_notification(
    app: AppHandle,
    server_status: String,
    message: String
) -> Result<(), String> {
    add_log_entry("info", &format!("Showing server notification: {} - {}", server_status, message));
    info!("Showing server notification: {} - {}", server_status, message);

    // Use Tauri's notification plugin
    use tauri_plugin_notification::NotificationExt;
    app.notification()
        .builder()
        .title(format!("TunnelForge Server - {}", server_status))
        .body(message)
        .show()
        .map_err(|e| format!("Failed to show server notification: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn get_notification_settings() -> Result<NotificationSettings, String> {
    // In a real implementation, this would load from persistent storage
    add_log_entry("info", "Getting notification settings");
    Ok(NotificationSettings::default())
}

#[tauri::command]
pub async fn update_notification_settings(_settings: NotificationSettings) -> Result<(), String> {
    // In a real implementation, this would update the stored settings
    add_log_entry("info", "Notification settings updated via command");
    Ok(())
}
