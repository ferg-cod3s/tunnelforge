// Native Tauri Settings Window Implementation
// This provides the settings interface for TunnelForge

use tauri::{AppHandle, Manager, Window, WindowBuilder, WindowUrl};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsWindowState {
    pub title: String,
    pub width: f64,
    pub height: f64,
    pub resizable: bool,
    pub always_on_top: bool,
    pub visible: bool,
}

impl Default for SettingsWindowState {
    fn default() -> Self {
        Self {
            title: "TunnelForge Settings".to_string(),
            width: 800.0,
            height: 600.0,
            resizable: true,
            always_on_top: false,
            visible: false,
        }
    }
}

pub struct SettingsWindow {
    window: Option<Window>,
    state: SettingsWindowState,
}

impl SettingsWindow {
    pub fn new() -> Self {
        Self {
            window: None,
            state: SettingsWindowState::default(),
        }
    }

    pub fn create_window(&mut self, app_handle: &AppHandle) -> Result<(), String> {
        let window = WindowBuilder::new(
            app_handle,
            "settings",
            WindowUrl::App("settings.html".into())
        )
        .title(&self.state.title)
        .inner_size(self.state.width, self.state.height)
        .resizable(self.state.resizable)
        .always_on_top(self.state.always_on_top)
        .visible(self.state.visible)
        .decorations(true)
        .skip_taskbar(false)
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
            Ok(())
        } else {
            Err("Settings window not created".to_string())
        }
    }

    pub fn hide(&self) -> Result<(), String> {
        if let Some(window) = &self.window {
            window.hide()
                .map_err(|e| format!("Failed to hide settings window: {}", e))?;
            Ok(())
        } else {
            Err("Settings window not created".to_string())
        }
    }

    pub fn close(&self) -> Result<(), String> {
        if let Some(window) = &self.window {
            window.close()
                .map_err(|e| format!("Failed to close settings window: {}", e))?;
            Ok(())
        } else {
            Err("Settings window not created".to_string())
        }
    }

    pub fn get_window(&self) -> Option<&Window> {
        self.window.as_ref()
    }

    pub fn update_state(&mut self, new_state: SettingsWindowState) {
        self.state = new_state;
        if let Some(window) = &self.window {
            // Apply state changes to existing window
            let _ = window.set_title(&self.state.title);
            let _ = window.set_resizable(self.state.resizable);
            let _ = window.set_always_on_top(self.state.always_on_top);
        }
    }
}

// Tauri commands for settings window management
#[tauri::command]
pub async fn show_settings_window(app_handle: AppHandle) -> Result<(), String> {
    let settings_window = app_handle.state::<SettingsWindow>();
    let settings_window = settings_window.inner();
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
    let settings_window = settings_window.inner();
    settings_window.close()
}

#[tauri::command]
pub async fn get_settings_window_state(app_handle: AppHandle) -> Result<SettingsWindowState, String> {
    let settings_window = app_handle.state::<SettingsWindow>();
    let settings_window = settings_window.inner();
    Ok(settings_window.state.clone())
}

#[tauri::command]
pub async fn update_settings_window_state(
    app_handle: AppHandle,
    new_state: SettingsWindowState
) -> Result<(), String> {
    let settings_window = app_handle.state::<SettingsWindow>();
    let mut settings_window = settings_window.inner().lock()
        .map_err(|e| format!("Failed to lock settings window: {}", e))?;
    settings_window.update_state(new_state);
    Ok(())
}
