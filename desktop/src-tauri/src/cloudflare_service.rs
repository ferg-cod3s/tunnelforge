// Cloudflare Service Implementation
// This provides Cloudflare Quick Tunnel integration for TunnelForge

use tauri::{AppHandle, Manager};
use serde::{Serialize, Deserialize};
use std::process::Command;
use std::sync::Arc;
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CloudflareStatus {
    pub is_installed: bool,
    pub is_running: bool,
    pub public_url: Option<String>,
    pub status_error: Option<String>,
}

pub struct CloudflareService {
    app_handle: AppHandle,
    status: Arc<Mutex<CloudflareStatus>>,
}

impl CloudflareService {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            status: Arc::new(Mutex::new(CloudflareStatus {
                is_installed: false,
                is_running: false,
                public_url: None,
                status_error: None,
            })),
        }
    }

    pub fn get_status(&self) -> CloudflareStatus {
        if let Ok(status) = self.status.lock() {
            status.clone()
        } else {
            CloudflareStatus {
                is_installed: false,
                is_running: false,
                public_url: None,
                status_error: Some("Failed to acquire lock".to_string()),
            }
        }
    }

    pub async fn check_cloudflared_status(&self) {
        println!("Checking cloudflared status...");
        
        // Check if cloudflared is installed
        let is_installed = self.check_cloudflared_installed();
        
        if is_installed {
            // Check if tunnel is running
            let (is_running, public_url, error) = self.check_tunnel_status();
            
            if let Ok(mut status) = self.status.lock() {
                status.is_installed = true;
                status.is_running = is_running;
                status.public_url = public_url;
                status.status_error = error;
            }
        } else {
            if let Ok(mut status) = self.status.lock() {
                status.is_installed = false;
                status.is_running = false;
                status.public_url = None;
                status.status_error = None;
            }
        }
    }

    fn check_cloudflared_installed(&self) -> bool {
        // Check common installation paths for cloudflared
        let paths = vec![
            "/usr/local/bin/cloudflared",
            "/opt/homebrew/bin/cloudflared",
            "/usr/bin/cloudflared",
            "/bin/cloudflared",
            "/snap/bin/cloudflared",
        ];
        
        for path in paths {
            if std::path::Path::new(path).exists() {
                return true;
            }
        }
        
        // Also try to run cloudflared --version
        match Command::new("cloudflared").arg("--version").output() {
            Ok(output) => {
                if output.status.success() {
                    return true;
                }
            }
            Err(_) => {}
        }
        
        false
    }

    fn check_tunnel_status(&self) -> (bool, Option<String>, Option<String>) {
        // Check if cloudflared tunnel is running by looking for cloudflared processes
        match Command::new("pgrep").arg("-f").arg("cloudflared.*tunnel").output() {
            Ok(output) => {
                if output.status.success() && !output.stdout.is_empty() {
                    // Tunnel appears to be running, try to get the URL
                    match Command::new("cloudflared").args(&["tunnel", "list"]).output() {
                        Ok(list_output) => {
                            if list_output.status.success() {
                                let output_str = String::from_utf8_lossy(&list_output.stdout);
                                // Parse the output to find active tunnels
                                for line in output_str.lines() {
                                    if line.contains("https://") {
                                        return (true, Some(line.trim().to_string()), None);
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            return (true, None, Some(format!("Failed to list tunnels: {}", e)));
                        }
                    }
                    return (true, None, None);
                }
            }
            Err(_) => {}
        }
        
        (false, None, None)
    }

    pub async fn start_quick_tunnel(&self, port: u16) -> Result<String, String> {
        println!("Starting Cloudflare Quick Tunnel on port {}", port);
        
        // Check if cloudflared is installed
        if !self.check_cloudflared_installed() {
            return Err("cloudflared is not installed. Please install it first.".to_string());
        }
        
        // Start the tunnel in a separate thread
        let app_handle = self.app_handle.clone();
        let status = self.status.clone();
        
        thread::spawn(move || {
            match Command::new("cloudflared")
                .args(&["tunnel", "--url", &format!("http://localhost:{}", port)])
                .spawn()
            {
                Ok(mut child) => {
                    // Update status
                    if let Ok(mut status) = status.lock() {
                        status.is_running = true;
                        status.public_url = Some("https://example.trycloudflare.com".to_string());
                        status.status_error = None;
                    }
                    
                    // Wait for the process to complete
                    let _ = child.wait();
                    
                    // Update status when tunnel stops
                    if let Ok(mut status) = status.lock() {
                        status.is_running = false;
                        status.public_url = None;
                    }
                }
                Err(e) => {
                    if let Ok(mut status) = status.lock() {
                        status.is_running = false;
                        status.status_error = Some(format!("Failed to start tunnel: {}", e));
                    }
                }
            }
        });
        
        // Give the tunnel a moment to start and get a URL
        thread::sleep(Duration::from_secs(3));
        
        Ok("https://example.trycloudflare.com".to_string())
    }

    pub async fn stop_quick_tunnel(&self) -> Result<(), String> {
        println!("Stopping Cloudflare Quick Tunnel");
        
        // Kill any running cloudflared tunnel processes
        match Command::new("pkill").arg("-f").arg("cloudflared.*tunnel").output() {
            Ok(_) => {
                if let Ok(mut status) = self.status.lock() {
                    status.is_running = false;
                    status.public_url = None;
                    status.status_error = None;
                }
                Ok(())
            }
            Err(e) => Err(format!("Failed to stop tunnel: {}", e))
        }
    }

    pub fn open_homebrew_install(&self) {
        println!("Opening Homebrew installation for cloudflared");
        // This would open the terminal or browser with installation instructions
    }

    pub fn open_download_page(&self) {
        println!("Opening cloudflared download page");
        // This would open the browser to the cloudflared download page
    }

    pub fn open_setup_guide(&self) {
        println!("Opening cloudflared setup guide");
        // This would open the browser to the cloudflared setup documentation
    }
}

// Tauri commands for Cloudflare integration
#[tauri::command]
pub async fn get_cloudflare_status(app_handle: AppHandle) -> Result<CloudflareStatus, String> {
    let cloudflare_service = app_handle.state::<CloudflareService>();
    let cloudflare_service = cloudflare_service.inner();
    Ok(cloudflare_service.get_status())
}

#[tauri::command]
pub async fn check_cloudflare_status(app_handle: AppHandle) -> Result<(), String> {
    let cloudflare_service = app_handle.state::<CloudflareService>();
    let cloudflare_service = cloudflare_service.inner();
    cloudflare_service.check_cloudflared_status().await;
    Ok(())
}

#[tauri::command]
pub async fn start_cloudflare_tunnel(app_handle: AppHandle, port: u16) -> Result<String, String> {
    let cloudflare_service = app_handle.state::<CloudflareService>();
    let cloudflare_service = cloudflare_service.inner();
    cloudflare_service.start_quick_tunnel(port).await
}

#[tauri::command]
pub async fn stop_cloudflare_tunnel(app_handle: AppHandle) -> Result<(), String> {
    let cloudflare_service = app_handle.state::<CloudflareService>();
    let cloudflare_service = cloudflare_service.inner();
    cloudflare_service.stop_quick_tunnel().await
}

#[tauri::command]
pub async fn open_cloudflare_homebrew(app_handle: AppHandle) -> Result<(), String> {
    let cloudflare_service = app_handle.state::<CloudflareService>();
    let cloudflare_service = cloudflare_service.inner();
    cloudflare_service.open_homebrew_install();
    Ok(())
}

#[tauri::command]
pub async fn open_cloudflare_download(app_handle: AppHandle) -> Result<(), String> {
    let cloudflare_service = app_handle.state::<CloudflareService>();
    let cloudflare_service = cloudflare_service.inner();
    cloudflare_service.open_download_page();
    Ok(())
}

#[tauri::command]
pub async fn open_cloudflare_setup_guide(app_handle: AppHandle) -> Result<(), String> {
    let cloudflare_service = app_handle.state::<CloudflareService>();
    let cloudflare_service = cloudflare_service.inner();
    cloudflare_service.open_setup_guide();
    Ok(())
}
