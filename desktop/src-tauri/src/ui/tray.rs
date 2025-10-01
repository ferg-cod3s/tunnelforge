// Native Tauri System Tray Implementation
// This provides the system tray (menu bar) functionality for TunnelForge

use tauri::{AppHandle, Manager, Emitter, tray::{TrayIconBuilder, TrayIcon, MouseButton, MouseButtonState}};
use tauri::menu::{MenuBuilder, MenuItemBuilder, Menu, SubmenuBuilder};
use std::sync::Arc;
use std::sync::Mutex;

#[derive(Clone)]
pub struct TrayManager {
    app_handle: AppHandle,
    tray_icon: Option<Arc<Mutex<TrayIcon>>>,
    server_running: bool,
    session_count: u32,
    access_mode: String,
}

impl TrayManager {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { 
            app_handle,
            tray_icon: None,
            server_running: false,
            session_count: 0,
            access_mode: "localhost".to_string(),
        }
    }

    pub fn setup_tray(&mut self) -> Result<(), String> {
        let app_handle = self.app_handle.clone(");
        
        // Create the tray icon with a basic menu
        let tray = TrayIconBuilder::new()
            .tooltip("TunnelForge")
            .icon(tauri::image::Image::from_bytes(include_bytes!("../../assets/icon.png"))
                .map_err(|e| format!("Failed to load icon: {}", e))?)
            .menu(&Self::create_tray_menu(&app_handle, self.server_running, self.session_count, &self.access_mode)?)
            .on_menu_event(move |app, event| {
                Self::handle_menu_event(app, event");
            })
            .on_tray_icon_event(|tray, event| {
                if let tauri::tray::TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } = event {
                    let app = tray.app_handle(");
                    Self::toggle_main_window(app");
                }
            })
            .build(&self.app_handle)
            .map_err(|e| format!("Failed to create tray icon: {}", e))?;
        
        self.tray_icon = Some(Arc::new(Mutex::new(tray))");
        Ok(())
    }

    fn create_tray_menu(app_handle: &AppHandle, server_running: bool, session_count: u32, access_mode: &str) -> Result<Menu<tauri::Wry>, String> {
        let show_item = MenuItemBuilder::new("Show TunnelForge")
            .id("show")
            .build(app_handle)
            .map_err(|e| format!("Failed to create show menu item: {}", e))?;
            
        let hide_item = MenuItemBuilder::new("Hide TunnelForge") 
            .id("hide")
            .build(app_handle)
            .map_err(|e| format!("Failed to create hide menu item: {}", e))?;
            
        let settings_item = MenuItemBuilder::new("Settings")
            .id("settings")
            .build(app_handle)
            .map_err(|e| format!("Failed to create settings menu item: {}", e))?;
            
        let server_status_item = MenuItemBuilder::new(if server_running { 
            "Server: Running" 
        } else { 
            "Server: Stopped" 
        })
            .id("server_status")
            .enabled(false) // Make it non-clickable, just for display
            .build(app_handle)
            .map_err(|e| format!("Failed to create server status menu item: {}", e))?;
            
        let session_count_item = MenuItemBuilder::new(format!("Sessions: {}", session_count))
            .id("session_count")
            .enabled(false) // Make it non-clickable, just for display
            .build(app_handle)
            .map_err(|e| format!("Failed to create session count menu item: {}", e))?;
            
        let access_mode_item = MenuItemBuilder::new(format!("Access: {}", access_mode))
            .id("access_mode")
            .enabled(false) // Make it non-clickable, just for display
            .build(app_handle)
            .map_err(|e| format!("Failed to create access mode menu item: {}", e))?;
            
        let start_server_item = MenuItemBuilder::new("Start Server")
            .id("start_server")
            .enabled(!server_running)
            .build(app_handle)
            .map_err(|e| format!("Failed to create start server menu item: {}", e))?;
            
        let stop_server_item = MenuItemBuilder::new("Stop Server")
            .id("stop_server")
            .enabled(server_running)
            .build(app_handle)
            .map_err(|e| format!("Failed to create stop server menu item: {}", e))?;
            
        let restart_server_item = MenuItemBuilder::new("Restart Server")
            .id("restart_server")
            .enabled(server_running)
            .build(app_handle)
            .map_err(|e| format!("Failed to create restart server menu item: {}", e))?;
            
        let quit_item = MenuItemBuilder::new("Quit TunnelForge")
            .id("quit")
            .build(app_handle)
            .map_err(|e| format!("Failed to create quit menu item: {}", e))?;
            
        let menu = MenuBuilder::new(app_handle)
            .item(&show_item)
            .separator()
            .item(&hide_item)
            .separator()
            .item(&settings_item)
            .separator()
            .item(&server_status_item)
            .item(&session_count_item)
            .item(&access_mode_item)
            .separator()
            .item(&start_server_item)
            .item(&stop_server_item)
            .item(&restart_server_item)
            .separator()
            .item(&quit_item)
            .build()
            .map_err(|e| format!("Failed to build menu: {}", e))?;
            
        Ok(menu)
    }

    fn handle_menu_event(app: &AppHandle, event: tauri::menu::MenuEvent) {
        match event.id().as_ref() {
            "show" => Self::show_main_window(app),
            "hide" => Self::hide_main_window(app),
            "settings" => Self::show_settings_window(app),
            "start_server" => Self::start_server(app),
            "stop_server" => Self::stop_server(app),
            "restart_server" => Self::restart_server(app),
            "quit" => Self::quit_application(app),
            _ => {}
        }
    }

    fn toggle_main_window(app: &AppHandle) {
        // This would toggle the main window visibility
        // For now, we'll implement basic show functionality
        Self::show_main_window(app");
    }

    fn show_main_window(app: &AppHandle) {
        let windows = app.webview_windows(");
        if let Some(window) = windows.values().next() {
            let _ = window.show(");
            let _ = window.set_focus(");
        }
    }

    fn hide_main_window(app: &AppHandle) {
        let windows = app.webview_windows(");
        if let Some(window) = windows.values().next() {
            let _ = window.hide(");
        }
    }

    fn show_settings_window(app: &AppHandle) {
        // TODO: Implement settings window
        // For now, just show main window
        Self::show_main_window(app");
    }

    fn start_server(app: &AppHandle) {
        // TODO: Implement server start functionality
        let _ = app.emit("start_server", ()");
    }

    fn stop_server(app: &AppHandle) {
        // TODO: Implement server stop functionality
        let _ = app.emit("stop_server", ()");
    }

    fn restart_server(app: &AppHandle) {
        // TODO: Implement server restart functionality
        let _ = app.emit("restart_server", ()");
    }

    fn quit_application(app: &AppHandle) {
        app.exit(0");
    }

    pub fn update_tray_menu(&mut self, server_running: bool, session_count: u32, access_mode: String) -> Result<(), String> {
        self.server_running = server_running;
        self.session_count = session_count;
        self.access_mode = access_mode.clone(");
        
        if let Some(tray_icon) = &self.tray_icon {
            let tray = tray_icon.lock().map_err(|_| "Failed to lock tray icon")?;
            
            let tooltip = if server_running {
                format!("TunnelForge - Server Running ({} sessions)", session_count)
            } else {
                "TunnelForge - Server Stopped".to_string()
            };
            
            tray.set_tooltip(Some(&tooltip))
                .map_err(|e| format!("Failed to update tooltip: {}", e))?;
                
            // Update the menu to show server status
            let menu = Self::create_tray_menu(&self.app_handle, server_running, session_count, &access_mode)?;
            tray.set_menu(Some(menu))
                .map_err(|e| format!("Failed to update menu: {}", e))?;
        }
        Ok(())
    }

    pub fn set_tray_tooltip(&self, tooltip: &str) -> Result<(), String> {
        if let Some(tray_icon) = &self.tray_icon {
            let tray = tray_icon.lock().map_err(|_| "Failed to lock tray icon")?;
            tray.set_tooltip(Some(tooltip))
                .map_err(|e| format!("Failed to set tooltip: {}", e))?;
        }
        Ok(())
    }

    pub fn set_tray_icon(&self, _icon_path: &str) -> Result<(), String> {
        if let Some(tray_icon) = &self.tray_icon {
            let tray = tray_icon.lock().map_err(|_| "Failed to lock tray icon")?;
            
            // For now, we'll use a simple colored icon
            // In production, you'd load from the specified path
            let icon = tauri::image::Image::from_bytes(include_bytes!("../../assets/icon.png"))
                .map_err(|e| format!("Failed to load icon: {}", e))?;
                
            tray.set_icon(Some(icon))
                .map_err(|e| format!("Failed to set icon: {}", e))?;
        }
        Ok(())
    }
}

// Tauri commands for tray management
#[tauri::command]
pub async fn update_tray_status(app_handle: AppHandle, server_running: bool, session_count: u32, access_mode: String) -> Result<(), String> {
    let tray_manager = app_handle.state::<TrayManager>(");
    let mut tray_manager = tray_manager.inner().clone(");
    tray_manager.update_tray_menu(server_running, session_count, access_mode)
}

#[tauri::command]
pub async fn set_tray_tooltip(app_handle: AppHandle, tooltip: String) -> Result<(), String> {
    let tray_manager = app_handle.state::<TrayManager>(");
    let tray_manager = tray_manager.inner(");
    tray_manager.set_tray_tooltip(&tooltip)
}

#[tauri::command]
pub async fn set_tray_icon(app_handle: AppHandle, icon_path: String) -> Result<(), String> {
    let tray_manager = app_handle.state::<TrayManager>(");
    let tray_manager = tray_manager.inner(");
    tray_manager.set_tray_icon(&icon_path)
}

// Setup function to be called from lib.rs
pub fn setup_tray(app_handle: &AppHandle) -> Result<(), String> {
    let mut tray_manager = TrayManager::new(app_handle.clone()");
    tray_manager.setup_tray()
}
