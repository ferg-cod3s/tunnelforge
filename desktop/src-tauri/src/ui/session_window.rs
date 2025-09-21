// Native Tauri Session Window Implementation
// This provides the session management interface for TunnelForge

use tauri::{AppHandle, Manager, Window, WindowBuilder, WindowUrl};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionWindowState {
    pub title: String,
    pub width: f64,
    pub height: f64,
    pub resizable: bool,
    pub always_on_top: bool,
    pub visible: bool,
    pub session_id: Option<String>,
}

impl Default for SessionWindowState {
    fn default() -> Self {
        Self {
            title: "TunnelForge Session".to_string(),
            width: 1000.0,
            height: 700.0,
            resizable: true,
            always_on_top: false,
            visible: false,
            session_id: None,
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

    pub fn create_window(&mut self, app_handle: &AppHandle, session_id: String) -> Result<(), String> {
        let title = format!("TunnelForge - Session: {}", &session_id[..8]);
        
        let window = WindowBuilder::new(
            app_handle,
            format!("session-{}", session_id),
            WindowUrl::App(format!("session.html?session={}", session_id).into())
        )
        .title(&title)
        .inner_size(self.state.width, self.state.height)
        .resizable(self.state.resizable)
        .always_on_top(self.state.always_on_top)
        .visible(self.state.visible)
        .decorations(true)
        .skip_taskbar(false)
        .build()
        .map_err(|e| format!("Failed to create session window: {}", e))?;

        self.window = Some(window);
        self.state.session_id = Some(session_id);
        self.state.title = title;
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
            // Apply state changes to existing window
            let _ = window.set_title(&self.state.title);
            let _ = window.set_resizable(self.state.resizable);
            let _ = window.set_always_on_top(self.state.always_on_top);
        }
    }

    pub fn get_session_id(&self) -> Option<&str> {
        self.state.session_id.as_deref()
    }
}

// Tauri commands for session window management
#[tauri::command]
pub async fn show_session_window(app_handle: AppHandle, session_id: String) -> Result<(), String> {
    let session_window = app_handle.state::<SessionWindow>();
    let mut session_window = session_window.inner().lock()
        .map_err(|e| format!("Failed to lock session window: {}", e))?;
    
    // If window doesn't exist or is for different session, create new one
    if session_window.get_window().is_none() || 
       session_window.get_session_id() != Some(&session_id) {
        session_window.create_window(&app_handle, session_id)?;
    }
    
    session_window.show()
}

#[tauri::command]
pub async fn hide_session_window(app_handle: AppHandle) -> Result<(), String> {
    let session_window = app_handle.state::<SessionWindow>();
    let session_window = session_window.inner();
    session_window.hide()
}

#[tauri::command]
pub async fn close_session_window(app_handle: AppHandle) -> Result<(), String> {
    let session_window = app_handle.state::<SessionWindow>();
    let session_window = session_window.inner();
    session_window.close()
}

#[tauri::command]
pub async fn get_session_window_state(app_handle: AppHandle) -> Result<SessionWindowState, String> {
    let session_window = app_handle.state::<SessionWindow>();
    let session_window = session_window.inner();
    Ok(session_window.state.clone())
}

#[tauri::command]
pub async fn update_session_window_state(
    app_handle: AppHandle,
    new_state: SessionWindowState
) -> Result<(), String> {
    let session_window = app_handle.state::<SessionWindow>();
    let mut session_window = session_window.inner().lock()
        .map_err(|e| format!("Failed to lock session window: {}", e))?;
    session_window.update_state(new_state);
    Ok(())
}
