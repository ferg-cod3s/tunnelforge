use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GeneralSettings {
    pub launch_at_login: bool,
    pub cli_installed: bool,
    pub minimize_to_tray: bool,
}

impl Default for GeneralSettings {
    fn default() -> Self {
        Self {
            launch_at_login: false,
            cli_installed: false,
            minimize_to_tray: true,
        }
    }
}

#[tauri::command]
pub async fn get_general_settings() -> Result<GeneralSettings, String> {
    Ok(GeneralSettings::default())
}

#[tauri::command]
pub async fn update_general_settings(settings: GeneralSettings) -> Result<(), String> {
    log::info!("Updating general settings: {:?}", settings);
    Ok(())
}

#[tauri::command]
pub async fn toggle_launch_at_login(enabled: bool) -> Result<(), String> {
    log::info!("Setting launch at login: {}", enabled);
    
    if enabled {
        install_autostart().map_err(|e| format!("Failed to enable autostart: {}", e))?;
    } else {
        uninstall_autostart().map_err(|e| format!("Failed to disable autostart: {}", e))?;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn install_cli() -> Result<(), String> {
    log::info!("Installing CLI");
    
    let cli_install_path = get_cli_install_path()?;
    let source_path = get_cli_source_path()?;
    
    if !std::path::Path::new(&source_path).exists() {
        return Err("CLI binary not found in application bundle".to_string());
    }
    
    fs::copy(&source_path, &cli_install_path)
        .map_err(|e| format!("Failed to copy CLI: {}", e))?;
    
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&cli_install_path)
            .map_err(|e| format!("Failed to get CLI permissions: {}", e))?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&cli_install_path, perms)
            .map_err(|e| format!("Failed to set CLI permissions: {}", e))?;
    }
    
    log::info!("CLI installed successfully to {}", cli_install_path);
    Ok(())
}

#[tauri::command]
pub async fn uninstall_cli() -> Result<(), String> {
    log::info!("Uninstalling CLI");
    
    let cli_install_path = get_cli_install_path()?;
    
    if std::path::Path::new(&cli_install_path).exists() {
        fs::remove_file(&cli_install_path)
            .map_err(|e| format!("Failed to remove CLI: {}", e))?;
        log::info!("CLI uninstalled successfully");
    }
    
    Ok(())
}

#[tauri::command]
pub async fn is_cli_installed() -> Result<bool, String> {
    let cli_install_path = get_cli_install_path()?;
    Ok(std::path::Path::new(&cli_install_path).exists())
}

fn get_cli_install_path() -> Result<String, String> {
    let home = std::env::var("HOME")
        .map_err(|_| "HOME environment variable not set".to_string())?;
    Ok(format!("{}/.local/bin/tunnelforge", home))
}

fn get_cli_source_path() -> Result<String, String> {
    Ok("/usr/bin/tunnelforge".to_string())
}

fn install_autostart() -> Result<(), String> {
    let autostart_dir = get_autostart_dir()?;
    fs::create_dir_all(&autostart_dir)
        .map_err(|e| format!("Failed to create autostart directory: {}", e))?;
    
    let desktop_file_path = format!("{}/tunnelforge.desktop", autostart_dir);
    let desktop_content = create_desktop_file_content()?;
    
    let mut file = fs::File::create(&desktop_file_path)
        .map_err(|e| format!("Failed to create autostart file: {}", e))?;
    
    file.write_all(desktop_content.as_bytes())
        .map_err(|e| format!("Failed to write autostart file: {}", e))?;
    
    log::info!("Autostart enabled: {}", desktop_file_path);
    Ok(())
}

fn uninstall_autostart() -> Result<(), String> {
    let autostart_dir = get_autostart_dir()?;
    let desktop_file_path = format!("{}/tunnelforge.desktop", autostart_dir);
    
    if std::path::Path::new(&desktop_file_path).exists() {
        fs::remove_file(&desktop_file_path)
            .map_err(|e| format!("Failed to remove autostart file: {}", e))?;
        log::info!("Autostart disabled");
    }
    
    Ok(())
}

fn get_autostart_dir() -> Result<String, String> {
    let home = std::env::var("HOME")
        .map_err(|_| "HOME environment variable not set".to_string())?;
    
    let xdg_config_home = std::env::var("XDG_CONFIG_HOME")
        .unwrap_or_else(|_| format!("{}/.config", home));
    
    Ok(format!("{}/autostart", xdg_config_home))
}

fn create_desktop_file_content() -> Result<String, String> {
    let exec_path = get_app_executable_path()?;
    
    Ok(format!(
        r#"[Desktop Entry]
Type=Application
Name=TunnelForge
Comment=Secure tunnel management tool
Exec={}
Icon=tunnelforge
Terminal=false
Categories=Network;Development;
StartupNotify=false
X-GNOME-Autostart-enabled=true
"#,
        exec_path
    ))
}

fn get_app_executable_path() -> Result<String, String> {
    std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?
        .to_str()
        .ok_or_else(|| "Invalid executable path".to_string())
        .map(|s| s.to_string())
}
