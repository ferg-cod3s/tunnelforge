// Native Tauri Main Window Implementation
// This provides the main application window for TunnelForge

use tauri::{AppHandle, Manager, WebviewWindow, WebviewWindowBuilder, WebviewUrl};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowState {
    pub title: String,
    pub width: f64,
    pub height: f64,
    pub resizable: bool,
    pub always_on_top: bool,
    pub visible: bool,
}

impl Default for WindowState {
    fn default() -> Self {
        Self {
            title: "TunnelForge".to_string(),
            width: 1200.0,
            height: 800.0,
            resizable: true,
            always_on_top: false,
            visible: true,
        }
    }
}

pub struct MainWindow {
    window: Mutex<Option<WebviewWindow>>,
    state: Mutex<WindowState>,
}

impl MainWindow {
    pub fn new() -> Self {
        Self {
            window: Mutex::new(None),
            state: Mutex::new(WindowState::default()),
        }
    }

    pub fn create_window(&self, app_handle: &AppHandle) -> Result<(), String> {
        let mut window = self.window.lock().unwrap();
        
        // Check if window already exists
        if window.is_some() {
            return Ok(());
        }
        
        let state = self.state.lock().unwrap();
        
        // Create a window that loads the local settings HTML
        let webview_window = WebviewWindowBuilder::new(
            app_handle,
            "main",
            WebviewUrl::App("index.html".into())
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
        .map_err(|e| format!("Failed to create main window: {}", e))?;
        
        // Open devtools in debug mode for debugging
        #[cfg(debug_assertions)]
        {
            webview_window.open_devtools();
        }

        *window = Some(webview_window);
        Ok(())
    }

    pub fn show(&self) -> Result<(), String> {
        let window = self.window.lock().unwrap();
        if let Some(window) = window.as_ref() {
            window.show()
                .map_err(|e| format!("Failed to show main window: {}", e))?;
            window.set_focus()
                .map_err(|e| format!("Failed to focus main window: {}", e))?;
            Ok(())
        } else {
            Err("Main window not created".to_string())
        }
    }

    pub fn hide(&self) -> Result<(), String> {
        let window = self.window.lock().unwrap();
        if let Some(window) = window.as_ref() {
            window.hide()
                .map_err(|e| format!("Failed to hide main window: {}", e))?;
            Ok(())
        } else {
            Err("Main window not created".to_string())
        }
    }

    pub fn close(&self) -> Result<(), String> {
        let window = self.window.lock().unwrap();
        if let Some(window) = window.as_ref() {
            window.close()
                .map_err(|e| format!("Failed to close main window: {}", e))?;
            Ok(())
        } else {
            Err("Main window not created".to_string())
        }
    }

    pub fn get_window(&self) -> Option<WebviewWindow> {
        self.window.lock().unwrap().as_ref().cloned()
    }

    pub fn update_state(&self, new_state: WindowState) {
        let mut state = self.state.lock().unwrap();
        *state = new_state.clone();
        let window = self.window.lock().unwrap();
        if let Some(window) = window.as_ref() {
            // Apply state changes to existing window
            let _ = window.set_title(&new_state.title);
            let _ = window.set_resizable(new_state.resizable);
            let _ = window.set_always_on_top(new_state.always_on_top);
        }
    }

    pub fn get_state(&self) -> WindowState {
        self.state.lock().unwrap().clone()
    }
}

// Tauri commands for window management
#[tauri::command]
pub async fn show_main_window(app_handle: AppHandle) -> Result<(), String> {
    let window_manager = app_handle.state::<MainWindow>();
    let window_manager = window_manager.inner();
    window_manager.show()
}

#[tauri::command]
pub async fn hide_main_window(app_handle: AppHandle) -> Result<(), String> {
    let window_manager = app_handle.state::<MainWindow>();
    let window_manager = window_manager.inner();
    window_manager.hide()
}

#[tauri::command]
pub async fn close_main_window(app_handle: AppHandle) -> Result<(), String> {
    let window_manager = app_handle.state::<MainWindow>();
    let window_manager = window_manager.inner();
    window_manager.close()
}

#[tauri::command]
pub async fn get_window_state(app_handle: AppHandle) -> Result<WindowState, String> {
    let window_manager = app_handle.state::<MainWindow>();
    let window_manager = window_manager.inner();
    Ok(window_manager.get_state())
}

#[tauri::command]
pub async fn update_window_state(
    app_handle: AppHandle,
    new_state: WindowState
) -> Result<(), String> {
    let window_manager = app_handle.state::<MainWindow>();
    let window_manager = window_manager.inner();
    window_manager.update_state(new_state);
    Ok(())
}
