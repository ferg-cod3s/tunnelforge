use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StartupConfig {
    pub enabled: bool,
    pub service_type: String,
}

#[tauri::command]
pub async fn is_startup_enabled() -> Result<bool, String> {
    let systemd_path = get_systemd_service_path()?;
    Ok(systemd_path.exists())
}

#[tauri::command]
pub async fn enable_startup() -> Result<(), String> {
    let service_content = create_systemd_service_file()?;
    let service_path = get_systemd_service_path()?;
    
    fs::create_dir_all(service_path.parent().unwrap())
        .map_err(|e| format!("Failed to create systemd directory: {}", e))?;
    
    let mut file = fs::File::create(&service_path)
        .map_err(|e| format!("Failed to create service file: {}", e))?;
    
    file.write_all(service_content.as_bytes())
        .map_err(|e| format!("Failed to write service file: {}", e))?;
    
    std::process::Command::new("systemctl")
        .args(["--user", "daemon-reload"])
        .output()
        .map_err(|e| format!("Failed to reload systemd: {}", e))?;
    
    std::process::Command::new("systemctl")
        .args(["--user", "enable", "tunnelforge.service"])
        .output()
        .map_err(|e| format!("Failed to enable service: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn disable_startup() -> Result<(), String> {
    std::process::Command::new("systemctl")
        .args(["--user", "disable", "tunnelforge.service"])
        .output()
        .map_err(|e| format!("Failed to disable service: {}", e))?;
    
    let service_path = get_systemd_service_path()?;
    if service_path.exists() {
        fs::remove_file(&service_path)
            .map_err(|e| format!("Failed to remove service file: {}", e))?;
    }
    
    std::process::Command::new("systemctl")
        .args(["--user", "daemon-reload"])
        .output()
        .map_err(|e| format!("Failed to reload systemd: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn get_startup_service_status() -> Result<String, String> {
    let output = std::process::Command::new("systemctl")
        .args(["--user", "is-active", "tunnelforge.service"])
        .output()
        .map_err(|e| format!("Failed to check service status: {}", e))?;
    
    let status = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(status)
}

fn get_systemd_service_path() -> Result<PathBuf, String> {
    let home = std::env::var("HOME")
        .map_err(|_| "HOME environment variable not set".to_string())?;
    
    Ok(PathBuf::from(format!("{}/.config/systemd/user/tunnelforge.service", home)))
}

fn get_app_binary_path() -> Result<String, String> {
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?;
    
    exe_path.to_str()
        .ok_or_else(|| "Invalid executable path".to_string())
        .map(|s| s.to_string())
}

fn create_systemd_service_file() -> Result<String, String> {
    let binary_path = get_app_binary_path()?;
    
    Ok(format!(
        r#"[Unit]
Description=TunnelForge Terminal Session Manager
After=network.target

[Service]
Type=simple
ExecStart={}
Restart=on-failure
RestartSec=5
Environment="DISPLAY=:0"
Environment="WAYLAND_DISPLAY=wayland-0"

[Install]
WantedBy=default.target
"#,
        binary_path
    ))
}
