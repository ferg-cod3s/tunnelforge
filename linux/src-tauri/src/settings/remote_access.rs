use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RemoteAccessSettings {
    pub tailscale_enabled: bool,
    pub ngrok_enabled: bool,
    pub cloudflare_enabled: bool,
}

impl Default for RemoteAccessSettings {
    fn default() -> Self {
        Self {
            tailscale_enabled: false,
            ngrok_enabled: false,
            cloudflare_enabled: false,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TailscaleStatus {
    pub installed: bool,
    pub connected: bool,
    pub ip_address: Option<String>,
    pub hostname: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NgrokStatus {
    pub installed: bool,
    pub authenticated: bool,
    pub active_tunnels: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CloudflareStatus {
    pub authenticated: bool,
    pub active_tunnels: Vec<String>,
}

#[tauri::command]
pub async fn get_remote_access_settings() -> Result<RemoteAccessSettings, String> {
    Ok(RemoteAccessSettings::default())
}

#[tauri::command]
pub async fn update_remote_access_settings(settings: RemoteAccessSettings) -> Result<(), String> {
    log::info!("Updating remote access settings: {:?}", settings);
    Ok(())
}

#[tauri::command]
pub async fn get_tailscale_status() -> Result<TailscaleStatus, String> {
    let installed = is_tailscale_installed();
    
    if !installed {
        return Ok(TailscaleStatus {
            installed: false,
            connected: false,
            ip_address: None,
            hostname: None,
        });
    }
    
    let output = Command::new("tailscale")
        .args(&["status", "--json"])
        .output()
        .map_err(|e| format!("Failed to execute tailscale: {}", e))?;
    
    if !output.status.success() {
        return Ok(TailscaleStatus {
            installed: true,
            connected: false,
            ip_address: None,
            hostname: None,
        });
    }
    
    let status_json: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse tailscale status: {}", e))?;
    
    let connected = status_json["BackendState"].as_str() == Some("Running");
    let ip_address = status_json["Self"]["TailscaleIPs"]
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|ip| ip.as_str())
        .map(|s| s.to_string());
    let hostname = status_json["Self"]["HostName"]
        .as_str()
        .map(|s| s.to_string());
    
    Ok(TailscaleStatus {
        installed: true,
        connected,
        ip_address,
        hostname,
    })
}

#[tauri::command]
pub async fn connect_tailscale() -> Result<(), String> {
    if !is_tailscale_installed() {
        return Err("Tailscale is not installed".to_string());
    }
    
    let output = Command::new("tailscale")
        .arg("up")
        .output()
        .map_err(|e| format!("Failed to connect to Tailscale: {}", e))?;
    
    if !output.status.success() {
        return Err(format!(
            "Failed to connect to Tailscale: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    
    log::info!("Connected to Tailscale");
    Ok(())
}

#[tauri::command]
pub async fn disconnect_tailscale() -> Result<(), String> {
    if !is_tailscale_installed() {
        return Err("Tailscale is not installed".to_string());
    }
    
    let output = Command::new("tailscale")
        .arg("down")
        .output()
        .map_err(|e| format!("Failed to disconnect from Tailscale: {}", e))?;
    
    if !output.status.success() {
        return Err(format!(
            "Failed to disconnect from Tailscale: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    
    log::info!("Disconnected from Tailscale");
    Ok(())
}

#[tauri::command]
pub async fn get_ngrok_status() -> Result<NgrokStatus, String> {
    let installed = is_ngrok_installed();
    
    if !installed {
        return Ok(NgrokStatus {
            installed: false,
            authenticated: false,
            active_tunnels: vec![],
        });
    }
    
    Ok(NgrokStatus {
        installed: true,
        authenticated: false,
        active_tunnels: vec![],
    })
}

#[tauri::command]
pub async fn start_ngrok_tunnel(port: u16) -> Result<String, String> {
    if !is_ngrok_installed() {
        return Err("ngrok is not installed".to_string());
    }
    
    log::info!("Starting ngrok tunnel for port {}", port);
    
    Ok(format!("https://example.ngrok.io"))
}

#[tauri::command]
pub async fn stop_ngrok_tunnel() -> Result<(), String> {
    log::info!("Stopping ngrok tunnel");
    Ok(())
}

#[tauri::command]
pub async fn get_cloudflare_status() -> Result<CloudflareStatus, String> {
    Ok(CloudflareStatus {
        authenticated: false,
        active_tunnels: vec![],
    })
}

#[tauri::command]
pub async fn authenticate_cloudflare(_token: String) -> Result<(), String> {
    log::info!("Authenticating with Cloudflare");
    Ok(())
}

#[tauri::command]
pub async fn start_cloudflare_tunnel(port: u16, name: String) -> Result<String, String> {
    log::info!("Starting Cloudflare tunnel '{}' for port {}", name, port);
    Ok(format!("https://{}.example.com", name))
}

#[tauri::command]
pub async fn stop_cloudflare_tunnel(name: String) -> Result<(), String> {
    log::info!("Stopping Cloudflare tunnel '{}'", name);
    Ok(())
}

fn is_tailscale_installed() -> bool {
    Command::new("which")
        .arg("tailscale")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn is_ngrok_installed() -> bool {
    Command::new("which")
        .arg("ngrok")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}
