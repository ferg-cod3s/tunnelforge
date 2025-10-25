// Server Manager Service
// Ported from: mac/TunnelForge/Core/Services/ServerManager.swift
//
// This service manages the lifecycle of the Go backend server:
// - Starting and stopping the server process
// - Health monitoring
// - Auto-restart on crashes
// - IPC communication via Unix sockets

use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::path::PathBuf;
use std::time::Duration;
use tokio::time::sleep;
use anyhow::{Result, Context};
use log::{info, warn, error, debug};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub enable_rate_limit: bool,
    pub enable_request_log: bool,
    pub data_dir: PathBuf,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            port: 4021,
            enable_rate_limit: true,
            enable_request_log: cfg!(debug_assertions),
            data_dir: dirs::data_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join("TunnelForge"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ServerState {
    Stopped,
    Starting,
    Running,
    Stopping,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerStatus {
    pub state: ServerState,
    pub pid: Option<u32>,
    pub port: u16,
    pub uptime_seconds: u64,
}

pub struct ServerManager {
    process: Arc<Mutex<Option<Child>>>,
    config: Arc<Mutex<ServerConfig>>,
    state: Arc<Mutex<ServerState>>,
    start_time: Arc<Mutex<Option<std::time::Instant>>>,
}

impl ServerManager {
    pub fn new(config: ServerConfig) -> Self {
        Self {
            process: Arc::new(Mutex::new(None)),
            config: Arc::new(Mutex::new(config)),
            state: Arc::new(Mutex::new(ServerState::Stopped)),
            start_time: Arc::new(Mutex::new(None)),
        }
    }

    /// Start the Go server process
    pub async fn start(&self) -> Result<()> {
        let mut state = self.state.lock().unwrap();

        if *state == ServerState::Running {
            return Err(anyhow::anyhow!("Server is already running"));
        }

        *state = ServerState::Starting;
        drop(state);

        let config = self.config.lock().unwrap().clone();
        let server_path = self.get_server_binary_path()?;

        info!("Starting Go server at: {}", server_path.display());
        info!("Server config: host={}, port={}", config.host, config.port);

        // Ensure data directory exists
        std::fs::create_dir_all(&config.data_dir)
            .context("Failed to create data directory")?;

        // Build command
        let mut cmd = Command::new(&server_path);
        cmd.env("HOST", &config.host)
           .env("PORT", config.port.to_string())
           .env("ENABLE_RATE_LIMIT", config.enable_rate_limit.to_string())
           .env("ENABLE_REQUEST_LOG", config.enable_request_log.to_string())
           .env("DATA_DIR", config.data_dir.to_str().unwrap_or("."))
           .stdout(Stdio::piped())
           .stderr(Stdio::piped());

        // Start the process
        let child = cmd.spawn()
            .context("Failed to spawn server process")?;

        let pid = child.id();
        info!("Go server started with PID: {}", pid);

        // Store process
        *self.process.lock().unwrap() = Some(child);
        *self.start_time.lock().unwrap() = Some(std::time::Instant::now());
        *self.state.lock().unwrap() = ServerState::Running;

        // Start health monitoring
        self.start_health_monitor();

        Ok(())
    }

    /// Stop the Go server process
    pub async fn stop(&self) -> Result<()> {
        let mut state = self.state.lock().unwrap();

        if *state == ServerState::Stopped {
            return Ok(());
        }

        *state = ServerState::Stopping;
        drop(state);

        let mut process = self.process.lock().unwrap();

        if let Some(mut child) = process.take() {
            let pid = child.id();
            info!("Stopping Go server (PID: {})...", pid);

            // Try graceful shutdown first
            #[cfg(unix)]
            {
                use std::os::unix::process::CommandExt;
                use std::process::Command as StdCommand;

                // Send SIGTERM for graceful shutdown
                let _ = StdCommand::new("kill")
                    .arg("-TERM")
                    .arg(pid.to_string())
                    .status();

                // Wait up to 5 seconds for graceful shutdown
                for _ in 0..50 {
                    match child.try_wait() {
                        Ok(Some(_)) => {
                            info!("Server stopped gracefully");
                            *self.state.lock().unwrap() = ServerState::Stopped;
                            *self.start_time.lock().unwrap() = None;
                            return Ok(());
                        }
                        Ok(None) => {
                            sleep(Duration::from_millis(100)).await;
                        }
                        Err(e) => {
                            error!("Error waiting for process: {}", e);
                            break;
                        }
                    }
                }
            }

            // Force kill if still running
            warn!("Server did not stop gracefully, forcing kill");
            child.kill()
                .context("Failed to kill server process")?;
            child.wait()
                .context("Failed to wait for server process")?;

            info!("Server stopped forcefully");
        }

        *self.state.lock().unwrap() = ServerState::Stopped;
        *self.start_time.lock().unwrap() = None;

        Ok(())
    }

    /// Restart the server
    pub async fn restart(&self) -> Result<()> {
        info!("Restarting server...");
        self.stop().await?;
        sleep(Duration::from_secs(1)).await;
        self.start().await?;
        Ok(())
    }

    /// Get current server status
    pub fn get_status(&self) -> ServerStatus {
        let state = *self.state.lock().unwrap();
        let process = self.process.lock().unwrap();
        let start_time = *self.start_time.lock().unwrap();
        let config = self.config.lock().unwrap();

        let pid = process.as_ref().map(|p| p.id());
        let uptime_seconds = start_time
            .map(|t| t.elapsed().as_secs())
            .unwrap_or(0);

        ServerStatus {
            state,
            pid,
            port: config.port,
            uptime_seconds,
        }
    }

    /// Check if server is healthy
    pub async fn is_healthy(&self) -> bool {
        let config = self.config.lock().unwrap();
        let url = format!("http://{}:{}/health", config.host, config.port);

        match reqwest::get(&url).await {
            Ok(response) => response.status().is_success(),
            Err(_) => false,
        }
    }

    /// Start health monitoring task
    fn start_health_monitor(&self) {
        let server_manager = self.clone();

        tokio::spawn(async move {
            loop {
                sleep(Duration::from_secs(10)).await;

                let state = *server_manager.state.lock().unwrap();
                if state != ServerState::Running {
                    break;
                }

                // Check if process is still alive
                let mut process = server_manager.process.lock().unwrap();
                if let Some(child) = process.as_mut() {
                    match child.try_wait() {
                        Ok(Some(status)) => {
                            error!("Server process exited unexpectedly: {:?}", status);
                            *server_manager.state.lock().unwrap() = ServerState::Error;
                            drop(process);

                            // Auto-restart
                            warn!("Attempting auto-restart...");
                            if let Err(e) = server_manager.start().await {
                                error!("Auto-restart failed: {}", e);
                            }
                            break;
                        }
                        Ok(None) => {
                            // Still running, check health
                            drop(process);
                            if !server_manager.is_healthy().await {
                                warn!("Server health check failed");
                            }
                        }
                        Err(e) => {
                            error!("Error checking process status: {}", e);
                        }
                    }
                }
            }
        });
    }

    /// Get path to server binary
    fn get_server_binary_path(&self) -> Result<PathBuf> {
        #[cfg(debug_assertions)]
        {
            // Development mode - look for development server
            let dev_paths = [
                "../../server/tunnelforge-server",
                "../../../server/tunnelforge-server",
                "../../../../server/tunnelforge-server",
            ];

            for path in &dev_paths {
                let path_buf = PathBuf::from(path);
                if path_buf.exists() {
                    return Ok(path_buf);
                }
            }

            Err(anyhow::anyhow!(
                "Development server binary not found. Please build the Go server first:\n\
                 cd server && go build -o tunnelforge-server cmd/server/main.go"
            ))
        }

        #[cfg(not(debug_assertions))]
        {
            // Production mode - use bundled binary
            let exe_dir = std::env::current_exe()?
                .parent()
                .context("Failed to get executable directory")?
                .to_path_buf();

            let server_path = exe_dir.join("tunnelforge-server");

            if server_path.exists() {
                Ok(server_path)
            } else {
                Err(anyhow::anyhow!("Server binary not found in bundle"))
            }
        }
    }
}

impl Clone for ServerManager {
    fn clone(&self) -> Self {
        Self {
            process: Arc::clone(&self.process),
            config: Arc::clone(&self.config),
            state: Arc::clone(&self.state),
            start_time: Arc::clone(&self.start_time),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_server_lifecycle() {
        let config = ServerConfig::default();
        let manager = ServerManager::new(config);

        let status = manager.get_status();
        assert_eq!(status.state, ServerState::Stopped);
    }
}
