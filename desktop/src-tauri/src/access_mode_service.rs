// Access Mode Service Implementation
// This provides access mode controls for TunnelForge (localhost vs network access)

use tauri::{AppHandle, Manager};
use serde::{Serialize, Deserialize};
use std::sync::Arc;
use std::sync::Mutex;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum AccessMode {
    LocalhostOnly,
    NetworkAccess,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AccessModeStatus {
    pub current_mode: AccessMode,
    pub server_port: u16,
    pub network_interfaces: Vec<String>,
    pub can_bind_network: bool,
    pub firewall_status: Option<String>,
}

pub struct AccessModeService {
    app_handle: AppHandle,
    status: Arc<Mutex<AccessModeStatus>>,
}

impl AccessModeService {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            status: Arc::new(Mutex::new(AccessModeStatus {
                current_mode: AccessMode::LocalhostOnly,
                server_port: 4021,
                network_interfaces: vec![],
                can_bind_network: false,
                firewall_status: None,
            })),
        }
    }

    pub fn get_status(&self) -> AccessModeStatus {
        if let Ok(status) = self.status.lock() {
            status.clone()
        } else {
            AccessModeStatus {
                current_mode: AccessMode::LocalhostOnly,
                server_port: 4021,
                network_interfaces: vec![],
                can_bind_network: false,
                firewall_status: Some("Failed to acquire lock".to_string()),
            }
        }
    }

    pub async fn check_network_access(&self) {
        println!("Checking network access capabilities...");
        
        // Get network interfaces
        let network_interfaces = self.get_network_interfaces();
        
        // Check if we can bind to network interfaces
        let can_bind_network = self.check_network_binding();
        
        // Check firewall status
        let firewall_status = self.check_firewall_status();
        
        if let Ok(mut status) = self.status.lock() {
            status.network_interfaces = network_interfaces;
            status.can_bind_network = can_bind_network;
            status.firewall_status = firewall_status;
        }
    }

    fn get_network_interfaces(&self) -> Vec<String> {
        // Get available network interfaces
        let mut interfaces = vec![];
        
        // Try to get network interfaces using system commands
        #[cfg(target_os = "macos")]
        {
            if let Ok(output) = std::process::Command::new("ifconfig").output() {
                if output.status.success() {
                    let output_str = String::from_utf8_lossy(&output.stdout);
                    for line in output_str.lines() {
                        if line.contains("inet ") && !line.contains("127.0.0.1") {
                            if let Some(ip) = line.split_whitespace().nth(1) {
                                interfaces.push(ip.to_string());
                            }
                        }
                    }
                }
            }
        }
        
        #[cfg(target_os = "linux")]
        {
            if let Ok(output) = std::process::Command::new("ip").args(&["addr", "show"]).output() {
                if output.status.success() {
                    let output_str = String::from_utf8_lossy(&output.stdout);
                    for line in output_str.lines() {
                        if line.contains("inet ") && !line.contains("127.0.0.1") {
                            if let Some(ip) = line.split_whitespace().nth(1) {
                                if let Some(addr) = ip.split('/').next() {
                                    interfaces.push(addr.to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
        
        #[cfg(target_os = "windows")]
        {
            if let Ok(output) = std::process::Command::new("ipconfig").output() {
                if output.status.success() {
                    let output_str = String::from_utf8_lossy(&output.stdout);
                    for line in output_str.lines() {
                        if line.contains("IPv4 Address") && line.contains(":") {
                            if let Some(ip) = line.split(':').nth(1) {
                                let ip = ip.trim();
                                if ip != "127.0.0.1" {
                                    interfaces.push(ip.to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
        
        interfaces
    }

    fn check_network_binding(&self) -> bool {
        // Test if we can bind to 0.0.0.0 (network access)
        match std::net::TcpListener::bind("0.0.0.0:0") {
            Ok(_) => true,
            Err(_) => false,
        }
    }

    fn check_firewall_status(&self) -> Option<String> {
        // Check firewall status
        #[cfg(target_os = "macos")]
        {
            match std::process::Command::new("defaults").args(&["read", "/Library/Preferences/com.apple.alf", "globalstate"]).output() {
                Ok(output) => {
                    if output.status.success() {
                        let output_str = String::from_utf8_lossy(&output.stdout);
                        let state = output_str.trim();
                        return Some(format!("macOS Firewall: {}", if state == "0" { "Disabled" } else { "Enabled" }));
                    }
                }
                Err(_) => {}
            }
        }
        
        #[cfg(target_os = "linux")]
        {
            match std::process::Command::new("ufw").arg("status").output() {
                Ok(output) => {
                    if output.status.success() {
                        return Some("UFW Firewall configured".to_string());
                    }
                }
                Err(_) => {}
            }
            
            match std::process::Command::new("firewall-cmd").arg("--state").output() {
                Ok(output) => {
                    if output.status.success() {
                        let output_str = String::from_utf8_lossy(&output.stdout);
                        return Some(format!("firewalld: {}", output_str.trim()));
                    }
                }
                Err(_) => {}
            }
        }
        
        #[cfg(target_os = "windows")]
        {
            match std::process::Command::new("netsh").args(&["advfirewall", "show", "allprofiles", "state"]).output() {
                Ok(output) => {
                    if output.status.success() {
                        return Some("Windows Firewall configured".to_string());
                    }
                }
                Err(_) => {}
            }
        }
        
        None
    }

    pub async fn set_access_mode(&self, mode: AccessMode, port: u16) -> Result<(), String> {
        println!("Setting access mode to {:?} on port {}", mode, port);
        
        if let Ok(mut status) = self.status.lock() {
            status.current_mode = mode;
            status.server_port = port;
        }
        
        // Here we would restart the server with the new binding configuration
        // For now, we'll just update the status
        
        Ok(())
    }

    pub async fn get_current_binding(&self) -> Result<String, String> {
        let status = self.get_status();
        
        match status.current_mode {
            AccessMode::LocalhostOnly => Ok(format!("127.0.0.1:{}", status.server_port)),
            AccessMode::NetworkAccess => {
                if status.can_bind_network {
                    Ok(format!("0.0.0.0:{}", status.server_port))
                } else {
                    Err("Cannot bind to network interfaces".to_string())
                }
            }
        }
    }

    pub async fn test_network_connectivity(&self) -> Result<Vec<String>, String> {
        let status = self.get_status();
        let mut results = vec![];
        
        for interface in status.network_interfaces {
            // Test connectivity to each interface
            match std::net::TcpListener::bind(&format!("{}:0", interface)) {
                Ok(_) => {
                    results.push(format!("✅ {} - Available", interface));
                }
                Err(e) => {
                    results.push(format!("❌ {} - {}", interface, e));
                }
            }
        }
        
        Ok(results)
    }
}

// Tauri commands for access mode controls
#[tauri::command]
pub async fn get_access_mode_status(app_handle: AppHandle) -> Result<AccessModeStatus, String> {
    let access_mode_service = app_handle.state::<AccessModeService>();
    let access_mode_service = access_mode_service.inner();
    Ok(access_mode_service.get_status())
}

#[tauri::command]
pub async fn check_network_access(app_handle: AppHandle) -> Result<(), String> {
    let access_mode_service = app_handle.state::<AccessModeService>();
    let access_mode_service = access_mode_service.inner();
    access_mode_service.check_network_access().await;
    Ok(())
}

#[tauri::command]
pub async fn set_access_mode(app_handle: AppHandle, mode: AccessMode, port: u16) -> Result<(), String> {
    let access_mode_service = app_handle.state::<AccessModeService>();
    let access_mode_service = access_mode_service.inner();
    access_mode_service.set_access_mode(mode, port).await
}

#[tauri::command]
pub async fn get_current_binding(app_handle: AppHandle) -> Result<String, String> {
    let access_mode_service = app_handle.state::<AccessModeService>();
    let access_mode_service = access_mode_service.inner();
    access_mode_service.get_current_binding().await
}

#[tauri::command]
pub async fn test_network_connectivity(app_handle: AppHandle) -> Result<Vec<String>, String> {
    let access_mode_service = app_handle.state::<AccessModeService>();
    let access_mode_service = access_mode_service.inner();
    access_mode_service.test_network_connectivity().await
}
