// System tray functionality for TunnelForge

use tauri::{AppHandle, menu::{MenuBuilder, MenuItem, PredefinedMenuItem}, tray::{TrayIconBuilder, TrayIconEvent}, Emitter, Manager};
use log::info;

use crate::add_log_entry;

pub struct TrayManager {
    app: AppHandle,
}

impl TrayManager {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }

    pub fn setup_tray(&self) -> Result<(), String> {
        add_log_entry("info", "Setting up TunnelForge system tray");
        info!("Setting up TunnelForge system tray");

        // Create tray menu items like VibeTunnel
        let open_dashboard = MenuItem::with_id(&self.app, "open_dashboard", "Open Dashboard", true, None::<&str>)
            .map_err(|e| format!("Failed to create menu item: {}", e))?;
        let server_status = MenuItem::with_id(&self.app, "server_status", "Server: Starting...", false, None::<&str>)
            .map_err(|e| format!("Failed to create menu item: {}", e))?;
        let separator1 = PredefinedMenuItem::separator(&self.app)
            .map_err(|e| format!("Failed to create separator: {}", e))?;
        let start_server = MenuItem::with_id(&self.app, "start_server", "Start Server", true, None::<&str>)
            .map_err(|e| format!("Failed to create menu item: {}", e))?;
        let stop_server = MenuItem::with_id(&self.app, "stop_server", "Stop Server", false, None::<&str>)
            .map_err(|e| format!("Failed to create menu item: {}", e))?;
        let restart_server = MenuItem::with_id(&self.app, "restart_server", "Restart Server", false, None::<&str>)
            .map_err(|e| format!("Failed to create menu item: {}", e))?;
        let separator2 = PredefinedMenuItem::separator(&self.app)
            .map_err(|e| format!("Failed to create separator: {}", e))?;
        let preferences = MenuItem::with_id(&self.app, "preferences", "Preferences...", true, None::<&str>)
            .map_err(|e| format!("Failed to create menu item: {}", e))?;
        let separator3 = PredefinedMenuItem::separator(&self.app)
            .map_err(|e| format!("Failed to create separator: {}", e))?;
        let quit = MenuItem::with_id(&self.app, "quit", "Quit TunnelForge", true, None::<&str>)
            .map_err(|e| format!("Failed to create menu item: {}", e))?;

        let menu = MenuBuilder::new(&self.app)
            .item(&open_dashboard)
            .item(&server_status)
            .item(&separator1)
            .item(&start_server)
            .item(&stop_server)
            .item(&restart_server)
            .item(&separator2)
            .item(&preferences)
            .item(&separator3)
            .item(&quit)
            .build()
            .map_err(|e| format!("Failed to build menu: {}", e))?;

        let _tray = TrayIconBuilder::with_id("main_tray")
            .tooltip("TunnelForge - Terminal Sharing")
            .icon(self.app.default_window_icon().unwrap().clone())
            .menu(&menu)
            .on_tray_icon_event(|tray, event| {
                match event {
                    TrayIconEvent::Click { .. } => {
                        // Left click - show dashboard
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                }
            })
            .on_menu_event(|app, event| {
                match event.id.as_ref() {
                    "open_dashboard" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        } else {
                            // If window doesn't exist, open browser to dashboard
                            use tauri_plugin_opener::OpenerExt;
                            let _ = app.opener().open_url("http://localhost:4021", None::<&str>);
                        }
                    }
                    "start_server" => {
                        // Emit start server event
                        let _ = app.emit("tray-start-server", ());
                    }
                    "stop_server" => {
                        // Emit stop server event
                        let _ = app.emit("tray-stop-server", ());
                    }
                    "restart_server" => {
                        // Emit restart server event
                        let _ = app.emit("tray-restart-server", ());
                    }
                    "preferences" => {
                        // Show preferences window
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.eval("window.showPreferences()");
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                }
            })
            .build(&self.app)
            .map_err(|e| format!("Failed to build tray: {}", e))?;

        add_log_entry("info", "System tray created successfully");
        Ok(())
    }

    pub fn update_tray_status(&self, running: bool) -> Result<(), String> {
        let status = if running { "Server: Running ✓" } else { "Server: Stopped" };
        add_log_entry("debug", &format!("Updating tray server status to: {}", status));

        // Update tray menu to reflect server status
        let _tray = self.app.tray_by_id("main_tray");

        Ok(())
    }

    pub fn show_tray_notification(&self, message: &str) -> Result<(), String> {
        add_log_entry("info", &format!("Tray notification: {}", message));

        // Show native notification
        use tauri_plugin_notification::NotificationExt;
        let _ = self.app.notification()
            .builder()
            .title("TunnelForge")
            .body(message)
            .show();

        Ok(())
    }
}

// Tauri commands for tray management
#[tauri::command]
pub async fn setup_system_tray(app: AppHandle) -> Result<(), String> {
    let tray_manager = TrayManager::new(app);
    tray_manager.setup_tray()
}

#[tauri::command]
pub async fn update_tray_status(app: AppHandle, connected: bool) -> Result<(), String> {
    let tray_manager = TrayManager::new(app);
    tray_manager.update_tray_status(connected)
}
