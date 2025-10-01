// Configuration management module
// Ported from mac/TunnelForge/Core/Services/ConfigManager.swift

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use std::fs;
use std::io::{Read, Write};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub server_port: u16,
    pub auto_start_server: bool,
    pub use_development_server: bool,
    pub theme: String,
    pub notifications_enabled: bool,
    pub auto_launch: bool,
    pub minimize_to_tray: bool,
    pub server_host: String,
    pub server_executable_path: Option<PathBuf>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            server_port: 4021,
            auto_start_server: true,
            use_development_server: false,
            theme: "dark".to_string(),
            notifications_enabled: true,
            auto_launch: false,
            minimize_to_tray: true,
            server_host: "127.0.0.1".to_string(),
            server_executable_path: None,
        }
    }
}

pub struct ConfigManager {
    config_path: PathBuf,
}

impl ConfigManager {
    pub fn new(app: &AppHandle) -> Result<Self, String> {
        let app_data_dir = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to get app data directory: {}", e))?;

        // Ensure the directory exists
        fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("Failed to create app data directory: {}", e))?;

        let config_path = app_data_dir.join("config.json");

        Ok(Self { config_path })
    }

    pub fn load_config(&self) -> Result<AppConfig, String> {
        if !self.config_path.exists() {
            // No config file exists, create default
            let default_config = AppConfig::default(");
            self.save_config(&default_config)?;
            return Ok(default_config");
        }

        let mut file = fs::File::open(&self.config_path)
            .map_err(|e| format!("Failed to open config file: {}", e))?;

        let mut contents = String::new(");
        file.read_to_string(&mut contents)
            .map_err(|e| format!("Failed to read config file: {}", e))?;

        serde_json::from_str(&contents)
            .map_err(|e| format!("Failed to parse config file: {}", e))
    }

    pub fn save_config(&self, config: &AppConfig) -> Result<(), String> {
        let json = serde_json::to_string_pretty(config)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;

        let mut file = fs::File::create(&self.config_path)
            .map_err(|e| format!("Failed to create config file: {}", e))?;

        file.write_all(json.as_bytes())
            .map_err(|e| format!("Failed to write config file: {}", e))?;

        Ok(())
    }

    pub fn update_config<F>(&self, updater: F) -> Result<AppConfig, String>
    where
        F: FnOnce(&mut AppConfig),
    {
        let mut config = self.load_config()?;
        updater(&mut config");
        self.save_config(&config)?;
        Ok(config)
    }
}

// Tauri commands for configuration management
#[tauri::command]
pub async fn get_config(app: AppHandle) -> Result<AppConfig, String> {
    let config_manager = ConfigManager::new(&app)?;
    config_manager.load_config()
}

#[tauri::command]
pub async fn save_config(app: AppHandle, config: AppConfig) -> Result<(), String> {
    let config_manager = ConfigManager::new(&app)?;
    config_manager.save_config(&config)
}

#[tauri::command]
pub async fn update_server_port(app: AppHandle, port: u16) -> Result<AppConfig, String> {
    let config_manager = ConfigManager::new(&app)?;
    config_manager.update_config(|config| {
        config.server_port = port;
    })
}

#[tauri::command]
pub async fn toggle_auto_start(app: AppHandle) -> Result<AppConfig, String> {
    let config_manager = ConfigManager::new(&app)?;
    config_manager.update_config(|config| {
        config.auto_start_server = !config.auto_start_server;
    })
}

#[tauri::command]
pub async fn set_theme(app: AppHandle, theme: String) -> Result<AppConfig, String> {
    let config_manager = ConfigManager::new(&app)?;
    config_manager.update_config(|config| {
        config.theme = theme;
    })
}