use serde::{Deserialize, Serialize};
use reqwest;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DashboardSettings {
    pub auto_refresh: bool,
    pub refresh_interval: u32,
    pub show_notifications: bool,
    pub monitor_system_resources: bool,
}

impl Default for DashboardSettings {
    fn default() -> Self {
        Self {
            auto_refresh: true,
            refresh_interval: 5000,
            show_notifications: true,
            monitor_system_resources: false,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ServerMetrics {
    pub uptime: u64,
    pub memory_usage: u64,
    pub cpu_usage: f32,
    pub active_sessions: usize,
    pub total_requests: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SystemResources {
    pub cpu_percent: f32,
    pub memory_percent: f32,
    pub disk_percent: f32,
}

#[tauri::command]
pub async fn get_dashboard_settings() -> Result<DashboardSettings, String> {
    Ok(DashboardSettings::default())
}

#[tauri::command]
pub async fn update_dashboard_settings(settings: DashboardSettings) -> Result<(), String> {
    log::info!("Updating dashboard settings: {:?}", settings);
    Ok(())
}

#[tauri::command]
pub async fn get_server_metrics(port: u16) -> Result<ServerMetrics, String> {
    let url = format!("http://127.0.0.1:{}/api/health", port);
    
    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch server metrics: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Server returned error: {}", response.status()));
    }
    
    let metrics: ServerMetrics = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse server response: {}", e))?;
    
    Ok(metrics)
}

#[tauri::command]
pub async fn get_system_resources() -> Result<SystemResources, String> {
    use sysinfo::{System, Disks};
    
    let mut sys = System::new_all();
    sys.refresh_all();
    
    let cpu_percent = sys.global_cpu_info().cpu_usage();
    
    let total_memory = sys.total_memory();
    let used_memory = sys.used_memory();
    let memory_percent = if total_memory > 0 {
        (used_memory as f32 / total_memory as f32) * 100.0
    } else {
        0.0
    };
    
    let disks = Disks::new_with_refreshed_list();
    let disk_percent = if let Some(disk) = disks.list().first() {
        let total = disk.total_space();
        let available = disk.available_space();
        if total > 0 {
            ((total - available) as f32 / total as f32) * 100.0
        } else {
            0.0
        }
    } else {
        0.0
    };
    
    Ok(SystemResources {
        cpu_percent,
        memory_percent,
        disk_percent,
    })
}

#[tauri::command]
pub async fn ping_server(port: u16) -> Result<bool, String> {
    let url = format!("http://127.0.0.1:{}/api/health", port);
    
    let client = reqwest::Client::new();
    match client
        .get(&url)
        .timeout(std::time::Duration::from_secs(2))
        .send()
        .await
    {
        Ok(response) => Ok(response.status().is_success()),
        Err(_) => Ok(false),
    }
}
