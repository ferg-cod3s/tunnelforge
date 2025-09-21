// System-level functionality for VibeTunnel clone

pub mod tray;

pub use tray::*;

use serde::{Deserialize, Serialize};


use crate::add_log_entry;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemSettings {
    pub auto_start_enabled: bool,
    pub minimize_to_tray: bool,
    pub start_minimized: bool,
    pub theme: String,
}

impl Default for SystemSettings {
    fn default() -> Self {
        Self {
            auto_start_enabled: false,
            minimize_to_tray: true,
            start_minimized: false,
            theme: "system".to_string(),
        }
    }
}

// Tauri commands for system settings
#[tauri::command]
pub async fn get_system_settings() -> Result<SystemSettings, String> {
    // In a real implementation, this would load from persistent storage
    add_log_entry("info", "Getting system settings");
    Ok(SystemSettings::default())
}

#[tauri::command]
pub async fn update_system_settings(_settings: SystemSettings) -> Result<(), String> {
    // In a real implementation, this would update the stored settings
    // and apply changes like enabling/disabling auto-start
    use crate::add_log_entry;
    add_log_entry("info", "System settings updated");
    Ok(())
}
