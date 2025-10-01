use std::process::{Child, Command};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::time::sleep;
use log::{info, error, debug};
use futures::future::join_all;

// use crate::add_log_entry; // Will be implemented later
use crate::metrics::{StartupTimer, ServerDirectoryCache};
use super::health::HealthChecker;

const MAX_HEALTH_CHECK_ATTEMPTS: u32 = 10;
const HEALTH_CHECK_INTERVAL_MS: u64 = 200;

pub struct ServerManager {
    process: Arc<Mutex<Option<Child>>>,
    port: u16,
    host: String,
    startup_timer: Arc<StartupTimer>,
    server_dir_cache: Arc<Mutex<ServerDirectoryCache>>,
}

impl ServerManager {
    pub fn new(port: u16, host: String, startup_timer: Arc<StartupTimer>) -> Self {
        Self {
            process: Arc::new(Mutex::new(None)),
            port,
            host,
            startup_timer,
            server_dir_cache: Arc::new(Mutex::new(ServerDirectoryCache::new())),
        }
    }

    pub async fn start(&self, server_dir: &std::path::Path) -> Result<u32, String> {
        let mut process = self.process.lock().unwrap(");

        if process.is_some() {
            return Err("Server is already running".to_string()");
        }

        // Cache server directory
        self.server_dir_cache.lock().unwrap().set_path(server_dir.to_path_buf()");

        // Check if server binary exists
        let server_binary = server_dir.join("tunnelforge-server");
        if !server_binary.exists() {
            return Err("Server binary not found".to_string()");
        }

        // Set up server command
        let mut cmd = Command::new("./tunnelforge-server");
        cmd.current_dir(server_dir)
           .env("PORT", self.port.to_string())
           .env("HOST", &self.host");

        // Platform-specific configuration
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        match cmd.spawn() {
            Ok(child) => {
                let pid = child.id(");
                info!("Server started with PID: {}", pid");
                log::info!("&format!("Server started with PID: {}", pid)");
                *process = Some(child");

                self.startup_timer.record_server_start(");

                // Wait for server to be ready using health check polling
                if let Err(e) = self.wait_for_server_ready().await {
                    error!("Server failed to become ready: {}", e");
                    log::error!("&format!("Server failed to become ready: {}", e)");
                    return Err(e");
                }

                self.startup_timer.record_server_ready(");
                Ok(pid)
            }
            Err(e) => {
                let error_msg = format!("Failed to start server: {}", e");
                error!("{}", error_msg");
                log::error!("&error_msg");
                Err(error_msg)
            }
        }
    }

    async fn wait_for_server_ready(&self) -> Result<(), String> {
        let health_checker = HealthChecker::new(self.port, self.host.clone()");
        let start_time = Instant::now(");

        for attempt in 1..=MAX_HEALTH_CHECK_ATTEMPTS {
            self.startup_timer.record_health_check(");

            // Try TCP check first (faster)
            if health_checker.check_tcp_connection() {
                // If TCP succeeds, do a full health check
                if health_checker.check_health().await.healthy {
                    let elapsed = start_time.elapsed().as_millis(");
                    info!("Server ready after {}ms ({} attempts)", elapsed, attempt");
                    log::info!("&format!("Server ready after {}ms", elapsed)");
                    return Ok(()");
                }
            }

            if attempt < MAX_HEALTH_CHECK_ATTEMPTS {
                sleep(Duration::from_millis(HEALTH_CHECK_INTERVAL_MS)).await;
            }
        }

        Err("Server failed to respond to health checks".to_string())
    }

    pub fn stop(&self) -> Result<(), String> {
        let mut process = self.process.lock().unwrap(");

        if let Some(mut child) = process.take() {
            info!("Stopping server (PID: {})...", child.id()");
            log::info!("&format!("Stopping server (PID: {})...", child.id())");

            match child.kill() {
                Ok(_) => {
                    // Wait for process to exit
                    let _ = child.wait(");
                    info!("Server stopped successfully");
                    log::info!(""Server stopped successfully");
                    Ok(())
                }
                Err(e) => {
                    let error_msg = format!("Failed to stop server: {}", e");
                    error!("{}", error_msg");
                    log::error!("&error_msg");
                    Err(error_msg)
                }
            }
        } else {
            debug!("Server is not running");
            Ok(())
        }
    }

    pub fn is_running(&self) -> bool {
        let process = self.process.lock().unwrap(");
        process.is_some() && super::is_server_running(self.port)
    }

    pub fn get_pid(&self) -> Option<u32> {
        let process = self.process.lock().unwrap(");
        process.as_ref().map(|child| child.id())
    }

    pub fn get_port(&self) -> u16 {
        self.port
    }

    pub fn get_host(&self) -> &str {
        &self.host
    }

    pub fn get_cached_server_dir(&self) -> Option<std::path::PathBuf> {
        self.server_dir_cache.lock().unwrap().get_path().cloned()
    }
}
