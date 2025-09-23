// ngrok Service Implementation
// This provides ngrok tunnel integration for TunnelForge

use tauri::{AppHandle, Manager};
use serde::{Serialize, Deserialize};
use std::process::Command;
use std::sync::Arc;
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NgrokStatus {
    pub is_installed: bool,
    pub is_running: bool,
    pub public_url: Option<String>,
    pub auth_token_configured: bool,
    pub status_error: Option<String>,
}

pub struct NgrokService {
    app_handle: AppHandle,
    status: Arc<Mutex<NgrokStatus>>,
}

impl NgrokService {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            status: Arc::new(Mutex::new(NgrokStatus {
                is_installed: false,
                is_running: false,
                public_url: None,
                auth_token_configured: false,
                status_error: None,
            })),
        }
    }

    pub fn get_status(&self) -> NgrokStatus {
        if let Ok(status) = self.status.lock() {
            status.clone()
        } else {
            NgrokStatus {
                is_installed: false,
                is_running: false,
                public_url: None,
                auth_token_configured: false,
                status_error: Some("Failed to acquire lock".to_string()),
            }
        }
    }

    pub async fn check_ngrok_status(&self) {
        println!("Checking ngrok status...");
        
        // Check if ngrok is installed
        let is_installed = self.check_ngrok_installed();
        
        if is_installed {
            // Check if auth token is configured
            let auth_token_configured = self.check_auth_token();
            
            // Check if tunnel is running
            let (is_running, public_url, error) = self.check_tunnel_status();
            
            if let Ok(mut status) = self.status.lock() {
                status.is_installed = true;
                status.is_running = is_running;
                status.public_url = public_url;
                status.auth_token_configured = auth_token_configured;
                status.status_error = error;
            }
        } else {
            if let Ok(mut status) = self.status.lock() {
                status.is_installed = false;
                status.is_running = false;
                status.public_url = None;
                status.auth_token_configured = false;
                status.status_error = None;
            }
        }
    }

    fn check_ngrok_installed(&self) -> bool {
        // Check common installation paths for ngrok
        let paths = vec![
            "/usr/local/bin/ngrok",
            "/opt/homebrew/bin/ngrok",
            "/usr/bin/ngrok",
            "/bin/ngrok",
            "/snap/bin/ngrok",
        ];
        
        for path in paths {
            if std::path::Path::new(path).exists() {
                return true;
            }
        }
        
        // Also try to run ngrok --version
        match Command::new("ngrok").arg("--version").output() {
            Ok(output) => {
                if output.status.success() {
                    return true;
                }
            }
            Err(_) => {}
        }
        
        false
    }

    fn check_auth_token(&self) -> bool {
        // Check if ngrok auth token is configured
        match Command::new("ngrok").args(&["config", "check"]).output() {
            Ok(output) => {
                if output.status.success() {
                    let output_str = String::from_utf8_lossy(&output.stdout);
                    return output_str.contains("authenticated");
                }
            }
            Err(_) => {}
        }
        
        false
    }

    fn check_tunnel_status(&self) -> (bool, Option<String>, Option<String>) {
        // Check if ngrok tunnel is running by looking for ngrok processes
        match Command::new("pgrep").arg("-f").arg("ngrok.*http").output() {
            Ok(output) => {
                if output.status.success() && !output.stdout.is_empty() {
                    // Tunnel appears to be running, try to get the URL
                    match Command::new("ngrok").args(&["api", "tunnels"]).output() {
                        Ok(api_output) => {
                            if api_output.status.success() {
                                let output_str = String::from_utf8_lossy(&api_output.stdout);
                                // Parse JSON to find public URL
                                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&output_str) {
                                    if let Some(tunnels) = json.get("tunnels").and_then(|t| t.as_array()) {
                                        for tunnel in tunnels {
                                            if let Some(public_url) = tunnel.get("public_url").and_then(|u| u.as_str()) {
                                                return (true, Some(public_url.to_string()), None);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            return (true, None, Some(format!("Failed to get tunnel info: {}", e)));
                        }
                    }
                    return (true, None, None);
                }
            }
            Err(_) => {}
        }
        
        (false, None, None)
    }

    pub async fn start_tunnel(&self, port: u16, auth_token: Option<String>) -> Result<String, String> {
        println!("Starting ngrok tunnel on port {}", port);
        
        // Check if ngrok is installed
        if !self.check_ngrok_installed() {
            return Err("ngrok is not installed. Please install it first.".to_string());
        }
        
        // Configure auth token if provided
        if let Some(token) = auth_token {
            if !token.is_empty() {
                match Command::new("ngrok").args(&["config", "add-authtoken", &token]).output() {
                    Ok(output) => {
                        if !output.status.success() {
                            return Err("Failed to configure auth token".to_string());
                        }
                    }
                    Err(e) => {
                        return Err(format!("Failed to configure auth token: {}", e));
                    }
                }
            }
        }
        
        // Start the tunnel in a separate thread
        let app_handle = self.app_handle.clone();
        let status = self.status.clone();
        
        thread::spawn(move || {
            match Command::new("ngrok")
                .args(&["http", &format!("{}", port)])
                .spawn()
            {
                Ok(mut child) => {
                    // Update status
                    if let Ok(mut status) = status.lock() {
                        status.is_running = true;
                        status.public_url = Some("https://example.ngrok.io".to_string());
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
        
        Ok("https://example.ngrok.io".to_string())
    }

    pub async fn stop_tunnel(&self) -> Result<(), String> {
        println!("Stopping ngrok tunnel");
        
        // Kill any running ngrok processes
        match Command::new("pkill").arg("-f").arg("ngrok").output() {
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

    pub fn open_download_page(&self) {
        println!("Opening ngrok download page");
        // This would open the browser to the ngrok download page
    }

    pub fn open_setup_guide(&self) {
        println!("Opening ngrok setup guide");
        // This would open the browser to the ngrok setup documentation
    }
}

// Tauri commands for ngrok integration
#[tauri::command]
pub async fn get_ngrok_status(app_handle: AppHandle) -> Result<NgrokStatus, String> {
    let ngrok_service = app_handle.state::<NgrokService>();
    let ngrok_service = ngrok_service.inner();
    Ok(ngrok_service.get_status())
}

#[tauri::command]
pub async fn check_ngrok_status(app_handle: AppHandle) -> Result<(), String> {
    let ngrok_service = app_handle.state::<NgrokService>();
    let ngrok_service = ngrok_service.inner();
    ngrok_service.check_ngrok_status().await;
    Ok(())
}

#[tauri::command]
pub async fn start_ngrok_tunnel(app_handle: AppHandle, port: u16, auth_token: Option<String>) -> Result<String, String> {
    let ngrok_service = app_handle.state::<NgrokService>();
    let ngrok_service = ngrok_service.inner();
    ngrok_service.start_tunnel(port, auth_token).await
}

#[tauri::command]
pub async fn stop_ngrok_tunnel(app_handle: AppHandle) -> Result<(), String> {
    let ngrok_service = app_handle.state::<NgrokService>();
    let ngrok_service = ngrok_service.inner();
    ngrok_service.stop_tunnel().await
}

#[tauri::command]
pub async fn open_ngrok_download(app_handle: AppHandle) -> Result<(), String> {
    let ngrok_service = app_handle.state::<NgrokService>();
    let ngrok_service = ngrok_service.inner();
    ngrok_service.open_download_page();
    Ok(())
}

#[tauri::command]
pub async fn open_ngrok_setup_guide(app_handle: AppHandle) -> Result<(), String> {
    let ngrok_service = app_handle.state::<NgrokService>();
    let ngrok_service = ngrok_service.inner();
    ngrok_service.open_setup_guide();
    Ok(())
}
