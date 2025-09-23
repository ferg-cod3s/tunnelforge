// Native Notification System Implementation
// This provides the notification functionality for TunnelForge

use tauri::{AppHandle, Manager};
use serde::{Serialize, Deserialize};
use std::sync::Arc;
use std::sync::Mutex;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NotificationPreferences {
    pub enabled: bool,
    pub sound_enabled: bool,
    pub show_in_notification_center: bool,
    pub session_start: bool,
    pub session_exit: bool,
    pub command_error: bool,
    pub command_completion: bool,
    pub bell: bool,
    pub claude_turn: bool,
}

impl Default for NotificationPreferences {
    fn default() -> Self {
        Self {
            enabled: true,
            sound_enabled: true,
            show_in_notification_center: true,
            session_start: true,
            session_exit: true,
            command_error: true,
            command_completion: false,
            bell: false,
            claude_turn: false,
        }
    }
}

impl NotificationPreferences {
    pub fn from_config(config: &crate::ui::settings_window::SettingsConfig) -> Self {
        Self {
            enabled: config.notifications_enabled,
            sound_enabled: config.notification_sound,
            show_in_notification_center: config.show_in_notification_center,
            session_start: config.notification_session_start,
            session_exit: config.notification_session_exit,
            command_error: config.notification_command_error,
            command_completion: config.notification_command_completion,
            bell: config.notification_bell,
            claude_turn: config.notification_claude_turn,
        }
    }
}

pub struct NotificationService {
    app_handle: AppHandle,
    preferences: Arc<Mutex<NotificationPreferences>>,
    sse_connected: Arc<Mutex<bool>>,
}

impl NotificationService {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            preferences: Arc::new(Mutex::new(NotificationPreferences::default())),
            sse_connected: Arc::new(Mutex::new(false)),
        }
    }

    pub fn update_preferences(&self, preferences: NotificationPreferences) {
        if let Ok(mut prefs) = self.preferences.lock() {
            *prefs = preferences;
        }
    }

    pub fn get_preferences(&self) -> NotificationPreferences {
        if let Ok(prefs) = self.preferences.lock() {
            prefs.clone()
        } else {
            NotificationPreferences::default()
        }
    }

    pub fn is_sse_connected(&self) -> bool {
        if let Ok(connected) = self.sse_connected.lock() {
            *connected
        } else {
            false
        }
    }

    pub fn set_sse_connected(&self, connected: bool) {
        if let Ok(mut sse_connected) = self.sse_connected.lock() {
            *sse_connected = connected;
        }
    }

    pub async fn request_permission_and_show_test_notification(&self) -> bool {
        // TODO: Implement native permission request
        // For now, just show a test notification
        self.show_notification(
            "TunnelForge",
            "Notifications enabled",
            "You will now receive notifications for session events.",
            None
        ).await;
        true
    }

    pub async fn start(&self) {
        // TODO: Start SSE connection for real-time notifications
        self.set_sse_connected(true);
        println!("Notification service started");
    }

    pub fn stop(&self) {
        // TODO: Stop SSE connection
        self.set_sse_connected(false);
        println!("Notification service stopped");
    }

    pub async fn show_notification(
        &self,
        title: &str,
        body: &str,
        subtitle: &str,
        icon: Option<&str>
    ) {
        let preferences = self.get_preferences();

        if !preferences.enabled {
            return;
        }

        // TODO: Implement native notification with sound and notification center
        println!("Notification: {} - {}", title, body);

        // Use Tauri v2 notification plugin API
        // Note: In Tauri v2, notifications are typically handled via the notification plugin
        // For now, we'll use a simple implementation that can be enhanced later
        println!("Notification would be shown: {} - {}", title, body);
    }

    pub async fn show_session_start_notification(&self, session_id: &str) {
        let preferences = self.get_preferences();

        if !preferences.session_start {
            return;
        }

        self.show_notification(
            "Session Started",
            &format!("Session {} has started", session_id),
            "A new terminal session is now active",
            None
        ).await;
    }

    pub async fn show_session_exit_notification(&self, session_id: &str, exit_code: i32) {
        let preferences = self.get_preferences();

        if !preferences.session_exit {
            return;
        }

        let body = if exit_code == 0 {
            format!("Session {} completed successfully", session_id)
        } else {
            format!("Session {} exited with code {}", session_id, exit_code)
        };

        self.show_notification(
            "Session Ended",
            &body,
            "Terminal session has finished",
            None
        ).await;
    }

    pub async fn show_command_error_notification(&self, command: &str, error: &str) {
        let preferences = self.get_preferences();

        if !preferences.command_error {
            return;
        }

        self.show_notification(
            "Command Failed",
            &format!("Command failed: {}", command),
            error,
            None
        ).await;
    }

    pub async fn show_command_completion_notification(&self, command: &str, duration_ms: u64) {
        let preferences = self.get_preferences();

        if !preferences.command_completion {
            return;
        }

        let duration_sec = duration_ms / 1000;
        self.show_notification(
            "Command Completed",
            &format!("Command completed in {:.1}s", duration_sec as f64),
            command,
            None
        ).await;
    }

    pub async fn show_bell_notification(&self) {
        let preferences = self.get_preferences();

        if !preferences.bell {
            return;
        }

        self.show_notification(
            "Terminal Bell",
            "Terminal bell activated",
            "🔔 Terminal bell (^G) received",
            None
        ).await;
    }

    pub async fn show_claude_turn_notification(&self) {
        let preferences = self.get_preferences();

        if !preferences.claude_turn {
            return;
        }

        self.show_notification(
            "Claude AI Ready",
            "Claude has finished responding",
            "Waiting for your input...",
            None
        ).await;
    }

    pub async fn send_server_test_notification(&self) {
        self.show_notification(
            "Test Notification",
            "This is a test notification from TunnelForge",
            "Notifications are working correctly!",
            None
        ).await;
    }

    pub fn open_notification_settings(&self) {
        // TODO: Open system notification settings
        println!("Opening system notification settings");
    }
}

// Tauri commands for notification management
#[tauri::command]
pub async fn show_notification(
    app_handle: AppHandle,
    title: String,
    body: String,
    subtitle: Option<String>,
    icon: Option<String>
) -> Result<(), String> {
    let notification_service = app_handle.state::<NotificationService>();
    let notification_service = notification_service.inner();
    notification_service.show_notification(&title, &body, subtitle.as_deref().unwrap_or(""), icon.as_deref()).await;
    Ok(())
}

#[tauri::command]
pub async fn show_server_notification(
    app_handle: AppHandle,
    notification_type: String,
    data: serde_json::Value
) -> Result<(), String> {
    let notification_service = app_handle.state::<NotificationService>();
    let notification_service = notification_service.inner();

    match notification_type.as_str() {
        "session_start" => {
            if let Some(session_id) = data.get("session_id").and_then(|v| v.as_str()) {
                notification_service.show_session_start_notification(session_id).await;
            }
        }
        "session_exit" => {
            if let (Some(session_id), Some(exit_code)) = (
                data.get("session_id").and_then(|v| v.as_str()),
                data.get("exit_code").and_then(|v| v.as_i64()).map(|v| v as i32)
            ) {
                notification_service.show_session_exit_notification(session_id, exit_code).await;
            }
        }
        "command_error" => {
            if let (Some(command), Some(error)) = (
                data.get("command").and_then(|v| v.as_str()),
                data.get("error").and_then(|v| v.as_str())
            ) {
                notification_service.show_command_error_notification(command, error).await;
            }
        }
        "command_completion" => {
            if let (Some(command), Some(duration)) = (
                data.get("command").and_then(|v| v.as_str()),
                data.get("duration_ms").and_then(|v| v.as_u64())
            ) {
                notification_service.show_command_completion_notification(command, duration).await;
            }
        }
        "bell" => {
            notification_service.show_bell_notification().await;
        }
        "claude_turn" => {
            notification_service.show_claude_turn_notification().await;
        }
        _ => {}
    }

    Ok(())
}

#[tauri::command]
pub async fn get_notification_settings(app_handle: AppHandle) -> Result<NotificationPreferences, String> {
    let notification_service = app_handle.state::<NotificationService>();
    let notification_service = notification_service.inner();
    Ok(notification_service.get_preferences())
}

#[tauri::command]
pub async fn update_notification_settings(
    app_handle: AppHandle,
    preferences: NotificationPreferences
) -> Result<(), String> {
    let notification_service = app_handle.state::<NotificationService>();
    let notification_service = notification_service.inner();
    notification_service.update_preferences(preferences);
    Ok(())
}

#[tauri::command]
pub async fn test_notification(app_handle: AppHandle) -> Result<(), String> {
    let notification_service = app_handle.state::<NotificationService>();
    let notification_service = notification_service.inner();
    notification_service.send_server_test_notification().await;
    Ok(())
}

#[tauri::command]
pub async fn open_notification_settings(app_handle: AppHandle) -> Result<(), String> {
    let notification_service = app_handle.state::<NotificationService>();
    let notification_service = notification_service.inner();
    notification_service.open_notification_settings();
    Ok(())
}
