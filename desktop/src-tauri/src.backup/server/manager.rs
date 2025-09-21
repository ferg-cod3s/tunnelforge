// Server Manager
// Port of ServerManager.swift with Go server lifecycle management

use std::process::{Child, Command};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::time::sleep;
use log::{info, error, debug};

use crate::add_log_entry;

pub struct ServerManager {
    process: Arc<Mutex<Option<Child>>>,
    port: u16,
    host: String,
}

impl ServerManager {
    pub fn new(port: u16, host: String) -> Self {
        Self {
            process: Arc::new(Mutex::new(None)),
            port,
            host,
        }
    }

    pub async fn start(&self, server_dir: &std::path::Path) -> Result<u32, String> {
        let mut process = self.process.lock().unwrap();

        if process.is_some() {
            return Err("Server is already running".to_string());
        }

        // Check if server binary exists
        let server_binary = server_dir.join("tunnelforge-server");
        if !server_binary.exists() {
            return Err("Server binary not found".to_string());
        }

        // Set up server command
        let mut cmd = Command::new("./tunnelforge-server");
        cmd.current_dir(server_dir)
           .env("PORT", self.port.to_string())
           .env("HOST", &self.host);

        // Platform-specific configuration
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        match cmd.spawn() {
            Ok(child) => {
                let pid = child.id();
                info!("Server started with PID: {}", pid);
                add_log_entry("info", &format!("Server started with PID: {}", pid));
                *process = Some(child);

                // Wait for server to initialize
                sleep(Duration::from_millis(2000)).await;

                // Verify server is responding
                if super::is_server_running(self.port) {
                    add_log_entry("info", "Server is responding to health checks");
                    Ok(pid)
                } else {
                    add_log_entry("warning", "Server started but not responding on expected port");
                    Ok(pid)
                }
            }
            Err(e) => {
                let error_msg = format!("Failed to start server: {}", e);
                error!("{}", error_msg);
                add_log_entry("error", &error_msg);
                Err(error_msg)
            }
        }
    }

    pub fn stop(&self) -> Result<(), String> {
        let mut process = self.process.lock().unwrap();

        if let Some(mut child) = process.take() {
            info!("Stopping server (PID: {})...", child.id());
            add_log_entry("info", &format!("Stopping server (PID: {})...", child.id()));

            match child.kill() {
                Ok(_) => {
                    // Wait for process to exit
                    let _ = child.wait();
                    info!("Server stopped successfully");
                    add_log_entry("info", "Server stopped successfully");
                    Ok(())
                }
                Err(e) => {
                    let error_msg = format!("Failed to stop server: {}", e);
                    error!("{}", error_msg);
                    add_log_entry("error", &error_msg);
                    Err(error_msg)
                }
            }
        } else {
            debug!("Server is not running");
            Ok(())
        }
    }

    pub fn is_running(&self) -> bool {
        let process = self.process.lock().unwrap();
        process.is_some() && super::is_server_running(self.port)
    }

    pub fn get_pid(&self) -> Option<u32> {
        let process = self.process.lock().unwrap();
        process.as_ref().map(|child| child.id())
    }

    pub fn get_port(&self) -> u16 {
        self.port
    }

    pub fn get_host(&self) -> &str {
        &self.host
    }
}