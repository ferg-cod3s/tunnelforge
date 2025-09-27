// Native Settings Window Implementation with secure credential storage
// This provides the settings window functionality for TunnelForge

use tauri::{AppHandle, Manager, WebviewWindow, WebviewWindowBuilder, WebviewUrl};
use serde::{Serialize, Deserialize};
use log::{info, error};

use crate::security::{CredentialStore, InputValidator, SecurityError};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SettingsConfig {
    pub autostart: bool,
    pub show_in_dock: bool,
    pub prevent_sleep: bool,
    pub server_port: String,
    pub access_mode: String,
    pub notifications_enabled: bool,
    pub notification_sound: bool,
    pub show_in_notification_center: bool,
    pub notification_session_start: bool,
    pub notification_session_exit: bool,
    pub notification_command_error: bool,
    pub notification_command_completion: bool,
    pub notification_bell: bool,
    pub notification_claude_turn: bool,
    pub tailscale_enabled: bool,
    pub cloudflare_enabled: bool,
    pub ngrok_enabled: bool,
    // Note: Sensitive fields like auth tokens are not stored in this struct
}

impl Default for SettingsConfig {
    fn default() -> Self {
        Self {
            autostart: false,
            show_in_dock: true,
            prevent_sleep: true,
            server_port: "4020".to_string(),
            access_mode: "localhost".to_string(),
            notifications_enabled: true,
            notification_sound: true,
            show_in_notification_center: true,
            notification_session_start: true,
            notification_session_exit: true,
            notification_command_error: true,
            notification_command_completion: false,
            notification_bell: false,
            notification_claude_turn: false,
            tailscale_enabled: false,
            cloudflare_enabled: false,
            ngrok_enabled: false,
        }
    }
}

#[derive(Clone)]
pub struct SettingsWindow {
    window: Option<WebviewWindow>,
    credential_store: CredentialStore,
    validator: InputValidator,
}

impl SettingsWindow {
    pub fn new() -> Self {
        Self {
            window: None,
            credential_store: CredentialStore::new("tunnelforge"),
            validator: InputValidator::new(),
        }
    }

    pub fn create_window(&mut self, app_handle: &AppHandle) -> Result<(), String> {
        // Check if window already exists
        if self.window.is_some() {
            return Ok(());
        }
        
        let window = WebviewWindowBuilder::new(
            app_handle,
            "settings",
            WebviewUrl::External("http://localhost:4021/settings".parse().unwrap())
        )
        .title("TunnelForge Settings")
        .inner_size(600.0, 700.0)
        .min_inner_size(500.0, 600.0)
        .resizable(true)
        .user_agent("TunnelForge-Desktop/1.0 (Tauri)")
        .center()
        .build()
        .map_err(|e| format!("Failed to create settings window: {}", e))?;

        self.window = Some(window);
        Ok(())
    }

    pub fn show(&self) -> Result<(), String> {
        if let Some(window) = &self.window {
            window.show()
                .map_err(|e| format!("Failed to show settings window: {}", e))?;
            window.set_focus()
                .map_err(|e| format!("Failed to focus settings window: {}", e))?;
        }
        Ok(())
    }

    pub fn hide(&self) -> Result<(), String> {
        if let Some(window) = &self.window {
            window.hide()
                .map_err(|e| format!("Failed to hide settings window: {}", e))?;
        }
        Ok(())
    }

    pub fn close(&mut self) -> Result<(), String> {
        if let Some(window) = &self.window {
            window.close()
                .map_err(|e| format!("Failed to close settings window: {}", e))?;
        }
        self.window = None;
        Ok(())
    }

    pub fn is_visible(&self) -> bool {
        if let Some(window) = &self.window {
            window.is_visible().unwrap_or(false)
        } else {
            false
        }
    }

    // Secure credential management
    fn store_credential(&self, key: &str, value: &str) -> Result<(), SecurityError> {
        // Validate input before storage
        self.validator.validate_token(value)?;
        self.credential_store.store_credential(key, value)
    }

    fn get_credential(&self, key: &str) -> Result<String, SecurityError> {
        self.credential_store.get_credential(key)
    }

    fn delete_credential(&self, key: &str) -> Result<(), SecurityError> {
        self.credential_store.delete_credential(key)
    }
}

// Tauri commands for settings window management
#[tauri::command]
pub async fn show_settings_window(app_handle: AppHandle) -> Result<(), String> {
    let settings_window = app_handle.state::<SettingsWindow>();
    let mut settings_window = settings_window.inner().clone();
    
    if settings_window.window.is_none() {
        settings_window.create_window(&app_handle)?;
    }
    
    settings_window.show()
}

#[tauri::command]
pub async fn hide_settings_window(app_handle: AppHandle) -> Result<(), String> {
    let settings_window = app_handle.state::<SettingsWindow>();
    let settings_window = settings_window.inner();
    settings_window.hide()
}

#[tauri::command]
pub async fn close_settings_window(app_handle: AppHandle) -> Result<(), String> {
    let settings_window = app_handle.state::<SettingsWindow>();
    let mut settings_window = settings_window.inner().clone();
    settings_window.close()
}

#[tauri::command]
pub async fn get_settings_window_state(app_handle: AppHandle) -> Result<bool, String> {
    let settings_window = app_handle.state::<SettingsWindow>();
    let settings_window = settings_window.inner();
    Ok(settings_window.is_visible())
}

#[tauri::command]
pub async fn update_settings_window_state(app_handle: AppHandle, visible: bool) -> Result<(), String> {
    let settings_window = app_handle.state::<SettingsWindow>();
    let mut settings_window = settings_window.inner().clone();
    
    if visible {
        if settings_window.window.is_none() {
            settings_window.create_window(&app_handle)?;
        }
        settings_window.show()
    } else {
        settings_window.hide()
    }
}

// Settings configuration commands
#[tauri::command]
pub async fn get_settings_config(_app_handle: AppHandle) -> Result<SettingsConfig, String> {
    // TODO: Load from persistent storage
    Ok(SettingsConfig::default())
}

#[tauri::command]
pub async fn save_settings_config(_app_handle: AppHandle, config: SettingsConfig) -> Result<(), String> {
    // TODO: Save to persistent storage
    info!("Saving settings config: {:?}", config);
    Ok(())
}

// Service integration commands with secure credential storage
#[tauri::command]
pub async fn toggle_tailscale_integration(app_handle: AppHandle, enabled: bool) -> Result<(), String> {
    let settings_window = app_handle.state::<SettingsWindow>();
    let settings_window = settings_window.inner();

    if !enabled {
        // Remove stored credentials when disabling
        if let Err(e) = settings_window.delete_credential("tailscale_key") {
            error!("Failed to delete Tailscale credentials: {}", e);
        }
    }

    info!("Setting Tailscale integration to: {}", enabled);
    Ok(())
}

#[tauri::command]
pub async fn toggle_cloudflare_integration(app_handle: AppHandle, enabled: bool) -> Result<(), String> {
    let settings_window = app_handle.state::<SettingsWindow>();
    let settings_window = settings_window.inner();

    if !enabled {
        // Remove stored credentials when disabling
        if let Err(e) = settings_window.delete_credential("cloudflare_token") {
            error!("Failed to delete Cloudflare credentials: {}", e);
        }
    }

    info!("Setting Cloudflare integration to: {}", enabled);
    Ok(())
}

#[tauri::command]
pub async fn toggle_ngrok_integration(app_handle: AppHandle, enabled: bool) -> Result<(), String> {
    let settings_window = app_handle.state::<SettingsWindow>();
    let settings_window = settings_window.inner();

    if !enabled {
        // Remove stored credentials when disabling
        if let Err(e) = settings_window.delete_credential("ngrok_token") {
            error!("Failed to delete ngrok credentials: {}", e);
        }
    }

    info!("Setting ngrok integration to: {}", enabled);
    Ok(())
}

#[tauri::command]
pub async fn set_ngrok_auth_token(app_handle: AppHandle, token: String) -> Result<(), String> {
    let settings_window = app_handle.state::<SettingsWindow>();
    let settings_window = settings_window.inner();

    // Store token securely
    settings_window.store_credential("ngrok_token", &token)
        .map_err(|e| format!("Failed to store ngrok token: {}", e))?;

    info!("Ngrok auth token stored securely");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_credential_storage() {
        let settings = SettingsWindow::new();

        // Test storing valid token
        assert!(settings.store_credential("test_key", "valid-token-12345678901234567890").is_ok());

        // Test retrieving stored token
        let retrieved = settings.get_credential("test_key");
        assert!(retrieved.is_ok());
        assert_eq!(retrieved.unwrap(), "valid-token-12345678901234567890");

        // Test deleting token
        assert!(settings.delete_credential("test_key").is_ok());

        // Test storing invalid token
        assert!(settings.store_credential("test_key", "invalid!@#$").is_err());
    }

    #[test]
    fn test_settings_config() {
        let config = SettingsConfig::default();

        // Verify default values
        assert!(!config.autostart);
        assert!(config.show_in_dock);
        assert_eq!(config.server_port, "4020");
        assert_eq!(config.access_mode, "localhost");
    }
}
