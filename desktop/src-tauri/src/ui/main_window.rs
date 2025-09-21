// Native Tauri Main Window Implementation
// This provides the main application window for TunnelForge

use tauri::{AppHandle, Manager, Window, WindowBuilder, WindowUrl};
use serde::{Deserialize, Serialize};

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
    window: Option<Window>,
    state: WindowState,
}

impl MainWindow {
    pub fn new() -> Self {
        Self {
            window: None,
            state: WindowState::default(),
        }
    }

    pub fn create_window(&mut self, app_handle: &AppHandle) -> Result<(), String> {
        let window = WindowBuilder::new(
            app_handle,
            "main",
            WindowUrl::App("index.html".into())
        )
        .title(&self.state.title)
        .inner_size(self.state.width, self.state.height)
        .resizable(self.state.resizable)
        .always_on_top(self.state.always_on_top)
        .visible(self.state.visible)
        .decorations(true)
        .skip_taskbar(false)
        .build()
        .map_err(|e| format!("Failed to create main window: {}", e))?;

        self.window = Some(window);
        Ok(())
    }

    pub fn show(&self) -> Result<(), String> {
        if let Some(window) = &self.window {
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
        if let Some(window) = &self.window {
            window.hide()
                .map_err(|e| format!("Failed to hide main window: {}", e))?;
            Ok(())
        } else {
            Err("Main window not created".to_string())
        }
    }

    pub fn close(&self) -> Result<(), String> {
        if let Some(window) = &self.window {
            window.close()
                .map_err(|e| format!("Failed to close main window: {}", e))?;
            Ok(())
        } else {
            Err("Main window not created".to_string())
        }
    }

    pub fn get_window(&self) -> Option<&Window> {
        self.window.as_ref()
    }

    pub fn update_state(&mut self, new_state: WindowState) {
        self.state = new_state;
        if let Some(window) = &self.window {
            // Apply state changes to existing window
            let _ = window.set_title(&self.state.title);
            let _ = window.set_resizable(self.state.resizable);
            let _ = window.set_always_on_top(self.state.always_on_top);
        }
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
    Ok(window_manager.state.clone())
}

#[tauri::command]
pub async fn update_window_state(
    app_handle: AppHandle,
    new_state: WindowState
) -> Result<(), String> {
    let window_manager = app_handle.state::<MainWindow>();
    let mut window_manager = window_manager.inner().lock()
        .map_err(|e| format!("Failed to lock window manager: {}", e))?;
    window_manager.update_state(new_state);
    Ok(())
}
