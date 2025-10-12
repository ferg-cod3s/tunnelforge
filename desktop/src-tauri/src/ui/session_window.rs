// Native Tauri Session Window Implementation
// This provides a native interface for managing terminal sessions

use tauri::{AppHandle, Manager, WebviewWindow, WebviewWindowBuilder, WebviewUrl};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

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
    window: Mutex<Option<WebviewWindow>>,
    state: Mutex<SessionWindowState>,
}

impl SessionWindow {
    pub fn new() -> Self {
        Self {
            window: Mutex::new(None),
            state: Mutex::new(SessionWindowState::default()),
        }
    }

    pub fn create_window(&self, app_handle: &AppHandle) -> Result<(), String> {
        let mut window_guard = self.window.lock().unwrap();
        
        // Check if window already exists
        if window_guard.is_some() {
            return Ok(());
        }
        
        let state = self.state.lock().unwrap();

        let window = WebviewWindowBuilder::new(
            app_handle,
            "sessions",
            WebviewUrl::External("http://localhost:4021/sessions".parse().unwrap())
        )
        .title(&state.title)
        .inner_size(state.width, state.height)
        .min_inner_size(800.0, 600.0)
        .resizable(state.resizable)
        .always_on_top(state.always_on_top)
        .visible(state.visible)
        .decorations(true)
        .user_agent("TunnelForge-Desktop/1.0 (Tauri)")
        .center()
        .build()
        .map_err(|e| format!("Failed to create session window: {}", e))?;

        *window_guard = Some(window);
        Ok(())
    }

    pub fn show(&self) -> Result<(), String> {
        let window = self.window.lock().unwrap();
        if let Some(window) = window.as_ref() {
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
        let window = self.window.lock().unwrap();
        if let Some(window) = window.as_ref() {
            window.hide()
                .map_err(|e| format!("Failed to hide session window: {}", e))?;
            Ok(())
        } else {
            Err("Session window not created".to_string())
        }
    }

    pub fn close(&self) -> Result<(), String> {
        let window = self.window.lock().unwrap();
        if let Some(window) = window.as_ref() {
            window.close()
                .map_err(|e| format!("Failed to close session window: {}", e))?;
            Ok(())
        } else {
            Err("Session window not created".to_string())
        }
    }

    pub fn get_window(&self) -> Option<WebviewWindow> {
        self.window.lock().unwrap().as_ref().cloned()
    }

    pub fn update_state(&self, new_state: SessionWindowState) {
        let mut state = self.state.lock().unwrap();
        *state = new_state.clone();
        let window = self.window.lock().unwrap();
        if let Some(window) = window.as_ref() {
            let _ = window.set_title(&state.title);
            let _ = window.set_resizable(state.resizable);
            let _ = window.set_always_on_top(state.always_on_top);
        }
    }

    pub fn select_session(&self, session_id: Option<String>) {
        let mut state = self.state.lock().unwrap();
        state.selected_session = session_id;
    }

    pub fn get_state(&self) -> SessionWindowState {
        self.state.lock().unwrap().clone()
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
    Ok(window_manager.get_state())
}

#[tauri::command]
pub async fn update_session_window_state(
    app_handle: AppHandle,
    new_state: SessionWindowState
) -> Result<(), String> {
    let window_manager = app_handle.state::<SessionWindow>();
    let window_manager = window_manager.inner();
    window_manager.update_state(new_state);
    Ok(())
}

#[tauri::command]
pub async fn select_session_in_window(
    app_handle: AppHandle,
    session_id: Option<String>
) -> Result<(), String> {
    let window_manager = app_handle.state::<SessionWindow>();
    let window_manager = window_manager.inner();
    window_manager.select_session(session_id);
    Ok(())
}
