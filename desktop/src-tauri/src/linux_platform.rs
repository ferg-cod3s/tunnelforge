// Linux-specific platform integration for TunnelForge

use super::PlatformIntegration;
use tauri::AppHandle;
use log::{info, warn};

pub struct LinuxPlatform;

impl LinuxPlatform {
    pub fn new() -> Self {
        LinuxPlatform
    }

    fn get_autostart_dir() -> Result<std::path::PathBuf, Box<dyn std::error::Error>> {
        let config_dir = dirs::config_dir()
            .ok_or("Could not find config directory")?;
        Ok(config_dir.join("autostart"))
    }

    fn create_desktop_entry(&self, enable: bool) -> Result<(), Box<dyn std::error::Error>> {
        let autostart_dir = Self::get_autostart_dir()?;
        let desktop_file = autostart_dir.join("tunnelforge.desktop");

        if enable {
            // Create autostart directory if it doesn't exist
            std::fs::create_dir_all(&autostart_dir)?;

            let exe_path = std::env::current_exe()?;
            let desktop_entry = format!(
                r#"[Desktop Entry]
Name=TunnelForge
Comment=Terminal sharing made simple
Exec={}
Icon=tunnelforge
Type=Application
Categories=Development;Network;
StartupNotify=true
X-GNOME-Autostart-enabled=true
Hidden=false
"#,
                exe_path.display()
            ");

            std::fs::write(&desktop_file, desktop_entry)?;
            log::info!("Created Linux autostart desktop entry");
        } else {
            if desktop_file.exists() {
                std::fs::remove_file(&desktop_file)?;
                log::info!("Removed Linux autostart desktop entry");
            }
        }

        Ok(())
    }
}

impl PlatformIntegration for LinuxPlatform {
    fn setup_auto_launch(&self, enabled: bool) -> Result<(), String> {
        self.create_desktop_entry(enabled)
            .map_err(|e| format!("Failed to setup auto launch: {}", e))
    }

    fn setup_system_tray(&self, _app_handle: &AppHandle) -> Result<(), String> {
        // System tray is handled by Tauri's built-in tray support on Linux
        info!("System tray setup for Linux (handled by Tauri)");
        Ok(())
    }

    fn setup_notifications(&self) -> Result<(), String> {
        // Notifications are handled by Tauri's notification plugin
        log::info!("Notification setup for Linux");
        Ok(())
    }

    fn setup_power_management(&self) -> Result<(), String> {
        // Power management is handled by the system on Linux
        info!("Power management setup for Linux (system default)");
        Ok(())
    }

    fn get_platform_name() -> &'static str {
        "linux"
    }

    fn is_supported() -> bool {
        true
    }

    fn get_config_paths() -> Vec<std::path::PathBuf> {
        vec![
            dirs::home_dir().unwrap_or_default().join(".config").join("tunnelforge"),
            std::env::temp_dir().join("tunnelforge"),
        ]
    }
}
