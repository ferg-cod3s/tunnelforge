// Native Tauri Session Window Implementation
// This provides a native interface for managing terminal sessions

use tauri::{AppHandle, Manager, Window, WindowBuilder, WindowUrl};
use serde::{Deserialize, Serialize};
use crate::sessions::Session;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionWindowState {
    pub title: String,
    pub width: f64,
    pub height: f64,
    pub resizable: bool,
    pub always_on_top: bool,
    pub visible: bool,
    pub selected_session: Option<String>,
}

impl Default for SessionWindowState {
    fn default() -> Self {
        Self {
            title: "TunnelForge - Sessions".to_string(),
            width: 1000.0,
            height: 700.0,
            resizable: true,
            always_on_top: false,
            visible: false,
            selected_session: None,
        }
    }
}

pub struct SessionWindow {
    window: Option<Window>,
    state: SessionWindowState,
}

impl SessionWindow {
    pub fn new() -> Self {
        Self {
            window: None,
            state: SessionWindowState::default(),
        }
    }

    pub fn create_window(&mut self, app_handle: &AppHandle) -> Result<(), String> {
        // Create a native window for session management
        let window = WindowBuilder::new(
            app_handle,
            "sessions",
            WindowUrl::default() // Native window, no web content
        )
        .title(&self.state.title)
        .inner_size(self.state.width, self.state.height)
        .resizable(self.state.resizable)
        .always_on_top(self.state.always_on_top)
        .visible(self.state.visible)
        .decorations(true)
        .skip_taskbar(false)
        .build()
        .map_err(|e| format!("Failed to create session window: {}", e))?;

        self.window = Some(window);
        Ok(())
    }

    pub fn show(&self) -> Result<(), String> {
        if let Some(window) = &self.window {
            window.show()
                .map_err(|e| format!("Failed to show session window: {}", e))?;
            window.set_focus()
                .map_err(|e| format!("Failed to focus session window: {}", e))?;
            Ok(())
        } else {
            Err("Session window not created".to_string())
        }
    }

    pub fn hide(&self) -> Result<(), String> {
        if let Some(window) = &self.window {
            window.hide()
                .map_err(|e| format!("Failed to hide session window: {}", e))?;
            Ok(())
        } else {
            Err("Session window not created".to_string())
        }
    }

    pub fn close(&self) -> Result<(), String> {
        if let Some(window) = &self.window {
            window.close()
                .map_err(|e| format!("Failed to close session window: {}", e))?;
            Ok(())
        } else {
            Err("Session window not created".to_string())
        }
    }

    pub fn get_window(&self) -> Option<&Window> {
        self.window.as_ref()
    }

    pub fn update_state(&mut self, new_state: SessionWindowState) {
        self.state = new_state;
        if let Some(window) = &self.window {
            let _ = window.set_title(&self.state.title);
            let _ = window.set_resizable(self.state.resizable);
            let _ = window.set_always_on_top(self.state.always_on_top);
        }
    }

    pub fn select_session(&mut self, session_id: Option<String>) {
        self.state.selected_session = session_id;
    }
}

// Tauri commands for session window management
#[tauri::command]
pub async fn show_session_window(app_handle: AppHandle) -> Result<(), String> {
    let window_manager = app_handle.state::<SessionWindow>();
    let window_manager = window_manager.inner();
    window_manager.show()
}

#[tauri::command]
pub async fn hide_session_window(app_handle: AppHandle) -> Result<(), String> {
    let window_manager = app_handle.state::<SessionWindow>();
    let window_manager = window_manager.inner();
    window_manager.hide()
}

#[tauri::command]
pub async fn close_session_window(app_handle: AppHandle) -> Result<(), String> {
    let window_manager = app_handle.state::<SessionWindow>();
    let window_manager = window_manager.inner();
    window_manager.close()
}

#[tauri::command]
pub async fn get_session_window_state(app_handle: AppHandle) -> Result<SessionWindowState, String> {
    let window_manager = app_handle.state::<SessionWindow>();
    let window_manager = window_manager.inner();
    Ok(window_manager.state.clone())
}

#[tauri::command]
pub async fn update_session_window_state(
    app_handle: AppHandle,
    new_state: SessionWindowState
) -> Result<(), String> {
    let window_manager = app_handle.state::<SessionWindow>();
    let mut window_manager = window_manager.inner().lock()
        .map_err(|e| format!("Failed to lock session window manager: {}", e))?;
    window_manager.update_state(new_state);
    Ok(())
}

#[tauri::command]
pub async fn select_session_in_window(
    app_handle: AppHandle,
    session_id: Option<String>
) -> Result<(), String> {
    let window_manager = app_handle.state::<SessionWindow>();
    let mut window_manager = window_manager.inner().lock()
        .map_err(|e| format!("Failed to lock session window manager: {}", e))?;
    window_manager.select_session(session_id);
    Ok(())
}
