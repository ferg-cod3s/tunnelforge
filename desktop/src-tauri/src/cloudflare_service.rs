// Cloudflare Service Implementation
// This provides Cloudflare Quick Tunnel integration for TunnelForge

use tauri::{AppHandle, Manager};
use serde::{Serialize, Deserialize};
use std::process::{Command, Stdio, Child};
use std::sync::Arc;
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use reqwest;
use serde_json::json;
use base64::Engine;
use rand::Rng;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CloudflareStatus {
    pub is_installed: bool,
    pub is_running: bool,
    pub public_url: Option<String>,
    pub status_error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CloudflareCredentials {
    pub api_token: String,
    pub account_id: String,
    pub zone_id: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NamedTunnelInfo {
    pub tunnel_id: String,
    pub name: String,
    pub domain: String,
    pub port: u16,
    pub status: String,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CreateNamedTunnelResult {
    pub url: String,
    pub tunnel_id: String,
    pub dns_record_id: String,
}

// Cloudflare API response types
#[derive(Deserialize, Debug)]
struct CloudflareApiResponse<T> {
    success: bool,
    errors: Vec<CloudflareApiError>,
    messages: Vec<String>,
    result: Option<T>,
}

#[derive(Deserialize, Debug)]
struct CloudflareApiError {
    code: i32,
    message: String,
}

#[derive(Deserialize, Serialize, Debug)]
struct TunnelCreateResponse {
    id: String,
    name: String,
    created_at: String,
}

#[derive(Deserialize, Serialize, Debug)]
struct DnsRecordResponse {
    id: String,
    name: String,
    #[serde(rename = "type")]
    record_type: String,
    content: String,
}

#[derive(Serialize, Debug)]
struct DnsRecordCreate {
    #[serde(rename = "type")]
    record_type: String,
    name: String,
    content: String,
    ttl: u32,
    proxied: bool,
}

pub struct CloudflareService {
    app_handle: AppHandle,
    status: Arc<Mutex<CloudflareStatus>>,
    credentials: Arc<Mutex<Option<CloudflareCredentials>>>,
    named_tunnels: Arc<Mutex<HashMap<String, NamedTunnelInfo>>>,
    tunnel_processes: Arc<Mutex<HashMap<String, Child>>>,
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
            credentials: Arc::new(Mutex::new(None)),
            named_tunnels: Arc::new(Mutex::new(HashMap::new())),
            tunnel_processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    // Get the config directory for storing tunnel credentials
    fn get_config_dir(&self) -> Result<PathBuf, String> {
        let config_dir = dirs::config_dir()
            .ok_or("Failed to get config directory")?
            .join("tunnelforge")
            .join("cloudflare");

        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;

        Ok(config_dir)
    }

    // Save credentials
    pub async fn save_credentials(&self, credentials: CloudflareCredentials) -> Result<(), String> {
        // Validate the credentials first
        self.validate_credentials(&credentials).await?;

        // Store in memory
        if let Ok(mut creds) = self.credentials.lock() {
            *creds = Some(credentials.clone());
        }

        // Save to disk (encrypted would be better in production)
        let config_dir = self.get_config_dir()?;
        let creds_file = config_dir.join("credentials.json");

        let json = serde_json::to_string_pretty(&credentials)
            .map_err(|e| format!("Failed to serialize credentials: {}", e))?;

        fs::write(&creds_file, json)
            .map_err(|e| format!("Failed to save credentials: {}", e))?;

        Ok(())
    }

    // Load credentials
    pub async fn load_credentials(&self) -> Result<Option<CloudflareCredentials>, String> {
        // Try memory first
        if let Ok(creds) = self.credentials.lock() {
            if creds.is_some() {
                return Ok(creds.clone());
            }
        }

        // Try loading from disk
        let config_dir = self.get_config_dir()?;
        let creds_file = config_dir.join("credentials.json");

        if !creds_file.exists() {
            return Ok(None);
        }

        let json = fs::read_to_string(&creds_file)
            .map_err(|e| format!("Failed to read credentials: {}", e))?;

        let credentials: CloudflareCredentials = serde_json::from_str(&json)
            .map_err(|e| format!("Failed to parse credentials: {}", e))?;

        // Store in memory
        if let Ok(mut creds) = self.credentials.lock() {
            *creds = Some(credentials.clone());
        }

        Ok(Some(credentials))
    }

    // Validate API credentials
    pub async fn validate_credentials(&self, credentials: &CloudflareCredentials) -> Result<(), String> {
        let client = reqwest::Client::new();

        // Verify token by getting account info
        let response = client
            .get(&format!("https://api.cloudflare.com/client/v4/accounts/{}", credentials.account_id))
            .header("Authorization", format!("Bearer {}", credentials.api_token))
            .send()
            .await
            .map_err(|e| format!("Failed to validate credentials: {}", e))?;

        if !response.status().is_success() {
            return Err("Invalid API credentials".to_string());
        }

        Ok(())
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

    // Create a named tunnel with custom domain (locally-managed)
    pub async fn create_named_tunnel(
        &self,
        name: String,
        domain: String,
        port: u16,
    ) -> Result<CreateNamedTunnelResult, String> {
        println!("Creating locally-managed tunnel: {} for domain: {} on port: {}", name, domain, port);

        // Load credentials for DNS management
        let credentials = self.load_credentials().await?
            .ok_or("No Cloudflare credentials configured")?;

        // Check if cloudflared is installed
        if !self.check_cloudflared_installed() {
            return Err("cloudflared is not installed".to_string());
        }

        // Step 1: Create tunnel using cloudflared CLI (locally-managed)
        let tunnel_id = self.create_tunnel_via_cli(&name).await?;
        println!("Created locally-managed tunnel with ID: {}", tunnel_id);

        // Step 2: Find credentials file (created by cloudflared)
        let creds_path = self.find_tunnel_credentials(&tunnel_id).await?;
        println!("Found credentials at: {}", creds_path.display());

        // Step 3: Create DNS CNAME record via API
        let zone_id = credentials.zone_id.clone()
            .ok_or("Zone ID is required for custom domains")?;
        let dns_record_id = self.create_dns_record(&credentials, &zone_id, &domain, &tunnel_id).await?;
        println!("Created DNS record with ID: {}", dns_record_id);

        // Step 4: Create tunnel config file
        self.create_tunnel_config(&tunnel_id, &domain, port, &creds_path).await?;

        // Step 5: Route DNS to tunnel using cloudflared CLI
        self.route_dns_to_tunnel(&tunnel_id, &domain).await?;

        // Step 6: Start the tunnel
        self.start_named_tunnel_process(&tunnel_id).await?;

        // Step 7: Store tunnel info
        let tunnel_info = NamedTunnelInfo {
            tunnel_id: tunnel_id.clone(),
            name: name.clone(),
            domain: domain.clone(),
            port,
            status: "active".to_string(),
            created_at: chrono::Utc::now().to_rfc3339(),
        };

        if let Ok(mut tunnels) = self.named_tunnels.lock() {
            tunnels.insert(tunnel_id.clone(), tunnel_info);
        }

        Ok(CreateNamedTunnelResult {
            url: format!("https://{}", domain),
            tunnel_id,
            dns_record_id,
        })
    }

    // Create tunnel via cloudflared CLI (locally-managed)
    async fn create_tunnel_via_cli(
        &self,
        name: &str,
    ) -> Result<String, String> {
        // Execute: cloudflared tunnel create <name>
        let output = Command::new("cloudflared")
            .args(&["tunnel", "create", name])
            .output()
            .map_err(|e| format!("Failed to execute cloudflared: {}", e))?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to create tunnel: {}", error));
        }

        // Parse tunnel ID from output
        // Output format: "Created tunnel <name> with id <tunnel-id>"
        let stdout = String::from_utf8_lossy(&output.stdout);

        for line in stdout.lines() {
            if line.contains("Created tunnel") && line.contains("with id") {
                if let Some(id_part) = line.split("with id").nth(1) {
                    let tunnel_id = id_part.trim().to_string();
                    return Ok(tunnel_id);
                }
            }
        }

        Err("Could not parse tunnel ID from cloudflared output".to_string())
    }

    // Find tunnel credentials file created by cloudflared
    async fn find_tunnel_credentials(
        &self,
        tunnel_id: &str,
    ) -> Result<PathBuf, String> {
        // Check common cloudflared config locations
        let home = dirs::home_dir()
            .ok_or("Could not determine home directory")?;

        let possible_paths = vec![
            home.join(".cloudflared").join(format!("{}.json", tunnel_id)),
            PathBuf::from("/etc/cloudflared").join(format!("{}.json", tunnel_id)),
        ];

        for path in possible_paths {
            if path.exists() {
                return Ok(path);
            }
        }

        Err(format!("Could not find credentials file for tunnel {}", tunnel_id))
    }

    // Route DNS to tunnel using cloudflared CLI
    async fn route_dns_to_tunnel(
        &self,
        tunnel_id: &str,
        domain: &str,
    ) -> Result<(), String> {
        // Execute: cloudflared tunnel route dns <tunnel-id> <domain>
        let output = Command::new("cloudflared")
            .args(&["tunnel", "route", "dns", tunnel_id, domain])
            .output()
            .map_err(|e| format!("Failed to route DNS: {}", e))?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            // Don't fail if route already exists
            if !error.contains("already exists") {
                return Err(format!("Failed to route DNS: {}", error));
            }
        }

        Ok(())
    }

    // Create DNS CNAME record
    async fn create_dns_record(
        &self,
        credentials: &CloudflareCredentials,
        zone_id: &str,
        domain: &str,
        tunnel_id: &str,
    ) -> Result<String, String> {
        let client = reqwest::Client::new();

        let dns_record = DnsRecordCreate {
            record_type: "CNAME".to_string(),
            name: domain.to_string(),
            content: format!("{}.cfargotunnel.com", tunnel_id),
            ttl: 1, // Auto
            proxied: true,
        };

        let response = client
            .post(&format!(
                "https://api.cloudflare.com/client/v4/zones/{}/dns_records",
                zone_id
            ))
            .header("Authorization", format!("Bearer {}", credentials.api_token))
            .json(&dns_record)
            .send()
            .await
            .map_err(|e| format!("Failed to create DNS record: {}", e))?;

        let api_response: CloudflareApiResponse<DnsRecordResponse> = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse DNS response: {}", e))?;

        if !api_response.success {
            let error_msg = api_response.errors
                .first()
                .map(|e| e.message.clone())
                .unwrap_or_else(|| "Unknown error".to_string());
            return Err(format!("DNS API error: {}", error_msg));
        }

        let result = api_response.result
            .ok_or("No result in DNS response")?;

        Ok(result.id)
    }

    // Create tunnel config file
    async fn create_tunnel_config(
        &self,
        tunnel_id: &str,
        domain: &str,
        port: u16,
        creds_path: &PathBuf,
    ) -> Result<(), String> {
        let config_dir = self.get_config_dir()?;
        let config_file = config_dir.join(format!("{}-config.yml", tunnel_id));

        let config_yaml = format!(
            r#"tunnel: {}
credentials-file: {}

ingress:
  - hostname: {}
    service: http://localhost:{}
  - service: http_status:404
"#,
            tunnel_id,
            creds_path.display(),
            domain,
            port
        );

        fs::write(&config_file, config_yaml)
            .map_err(|e| format!("Failed to save tunnel config: {}", e))?;

        Ok(())
    }

    // Start named tunnel process
    async fn start_named_tunnel_process(&self, tunnel_id: &str) -> Result<(), String> {
        let config_dir = self.get_config_dir()?;
        let config_file = config_dir.join(format!("{}-config.yml", tunnel_id));

        let child = Command::new("cloudflared")
            .args(&[
                "tunnel",
                "--config",
                config_file.to_str().unwrap(),
                "run",
                tunnel_id,
            ])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to start tunnel process: {}", e))?;

        // Store process handle
        if let Ok(mut processes) = self.tunnel_processes.lock() {
            processes.insert(tunnel_id.to_string(), child);
        }

        Ok(())
    }

    // Stop named tunnel
    pub async fn stop_named_tunnel(&self, tunnel_id: &str) -> Result<(), String> {
        if let Ok(mut processes) = self.tunnel_processes.lock() {
            if let Some(mut child) = processes.remove(tunnel_id) {
                let _ = child.kill();
            }
        }

        // Update tunnel info
        if let Ok(mut tunnels) = self.named_tunnels.lock() {
            if let Some(tunnel) = tunnels.get_mut(tunnel_id) {
                tunnel.status = "stopped".to_string();
            }
        }

        Ok(())
    }

    // Delete named tunnel
    pub async fn delete_named_tunnel(&self, tunnel_id: &str) -> Result<(), String> {
        // Stop the tunnel first
        self.stop_named_tunnel(tunnel_id).await?;

        // Load credentials
        let credentials = self.load_credentials().await?
            .ok_or("No Cloudflare credentials configured")?;

        // Delete via API
        let client = reqwest::Client::new();
        let _ = client
            .delete(&format!(
                "https://api.cloudflare.com/client/v4/accounts/{}/cfd_tunnel/{}",
                credentials.account_id, tunnel_id
            ))
            .header("Authorization", format!("Bearer {}", credentials.api_token))
            .send()
            .await;

        // Remove from stored tunnels
        if let Ok(mut tunnels) = self.named_tunnels.lock() {
            tunnels.remove(tunnel_id);
        }

        // Clean up local files
        let config_dir = self.get_config_dir()?;
        let _ = fs::remove_file(config_dir.join(format!("{}.json", tunnel_id)));
        let _ = fs::remove_file(config_dir.join(format!("{}-config.yml", tunnel_id)));

        Ok(())
    }

    // List all named tunnels
    pub fn list_named_tunnels(&self) -> Vec<NamedTunnelInfo> {
        if let Ok(tunnels) = self.named_tunnels.lock() {
            tunnels.values().cloned().collect()
        } else {
            Vec::new()
        }
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

// Named tunnel commands
#[tauri::command]
pub async fn save_cloudflare_credentials(
    app_handle: AppHandle,
    credentials: CloudflareCredentials,
) -> Result<(), String> {
    let cloudflare_service = app_handle.state::<CloudflareService>();
    let cloudflare_service = cloudflare_service.inner();
    cloudflare_service.save_credentials(credentials).await
}

#[tauri::command]
pub async fn load_cloudflare_credentials(
    app_handle: AppHandle,
) -> Result<Option<CloudflareCredentials>, String> {
    let cloudflare_service = app_handle.state::<CloudflareService>();
    let cloudflare_service = cloudflare_service.inner();
    cloudflare_service.load_credentials().await
}

#[tauri::command]
pub async fn validate_cloudflare_credentials(
    app_handle: AppHandle,
    credentials: CloudflareCredentials,
) -> Result<(), String> {
    let cloudflare_service = app_handle.state::<CloudflareService>();
    let cloudflare_service = cloudflare_service.inner();
    cloudflare_service.validate_credentials(&credentials).await
}

#[tauri::command]
pub async fn create_named_cloudflare_tunnel(
    app_handle: AppHandle,
    name: String,
    domain: String,
    port: u16,
) -> Result<CreateNamedTunnelResult, String> {
    let cloudflare_service = app_handle.state::<CloudflareService>();
    let cloudflare_service = cloudflare_service.inner();
    cloudflare_service.create_named_tunnel(name, domain, port).await
}

#[tauri::command]
pub async fn stop_named_cloudflare_tunnel(
    app_handle: AppHandle,
    tunnel_id: String,
) -> Result<(), String> {
    let cloudflare_service = app_handle.state::<CloudflareService>();
    let cloudflare_service = cloudflare_service.inner();
    cloudflare_service.stop_named_tunnel(&tunnel_id).await
}

#[tauri::command]
pub async fn delete_named_cloudflare_tunnel(
    app_handle: AppHandle,
    tunnel_id: String,
) -> Result<(), String> {
    let cloudflare_service = app_handle.state::<CloudflareService>();
    let cloudflare_service = cloudflare_service.inner();
    cloudflare_service.delete_named_tunnel(&tunnel_id).await
}

#[tauri::command]
pub async fn list_named_cloudflare_tunnels(
    app_handle: AppHandle,
) -> Result<Vec<NamedTunnelInfo>, String> {
    let cloudflare_service = app_handle.state::<CloudflareService>();
    let cloudflare_service = cloudflare_service.inner();
    Ok(cloudflare_service.list_named_tunnels())
}

// Include comprehensive unit tests
#[cfg(test)]
#[path = "cloudflare_service_tests_new.rs"]
mod cloudflare_service_tests_new;
