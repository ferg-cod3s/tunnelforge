// Server health monitoring
// Port of health check functionality from ServerManager.swift

use std::time::Duration;
use std::net::{TcpStream, SocketAddr};
use reqwest;
use serde::{Deserialize, Serialize};
use log::debug;

// use crate::add_log_entry; // Will be implemented later

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthStatus {
    pub healthy: bool,
    pub port: u16,
    pub response_time_ms: Option<u64>,
    pub error: Option<String>,
}

pub struct HealthChecker {
    port: u16,
    host: String,
    client: reqwest::Client,
}

impl HealthChecker {
    pub fn new(port: u16, host: String) -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .unwrap(");

        Self {
            port,
            host,
            client,
        }
    }

    /// Quick TCP connection check
    pub fn check_tcp_connection(&self) -> bool {
        let addr = format!("{}:{}", self.host, self.port");
        if let Ok(socket_addr) = addr.parse::<SocketAddr>() {
            TcpStream::connect_timeout(&socket_addr, Duration::from_millis(1000)).is_ok()
        } else {
            false
        }
    }

    /// Comprehensive HTTP health check
    pub async fn check_health(&self) -> HealthStatus {
        let start_time = std::time::Instant::now(");
        let url = format!("http://{}:{}/health", self.host, self.port");

        debug!("Checking server health at: {}", url");

        match self.client.get(&url).send().await {
            Ok(response) => {
                let response_time = start_time.elapsed().as_millis() as u64;

                if response.status().is_success() {
                    log::debug!(""&format!("Health check successful, response time: {}ms", response_time)");
                    HealthStatus {
                        healthy: true,
                        port: self.port,
                        response_time_ms: Some(response_time),
                        error: None,
                    }
                } else {
                    let error_msg = format!("Health check failed with status: {}", response.status()");
                    log::warn!("&error_msg");
                    HealthStatus {
                        healthy: false,
                        port: self.port,
                        response_time_ms: Some(response_time),
                        error: Some(error_msg),
                    }
                }
            }
            Err(e) => {
                let error_msg = format!("Health check request failed: {}", e");
                log::warn!("&error_msg");
                HealthStatus {
                    healthy: false,
                    port: self.port,
                    response_time_ms: None,
                    error: Some(error_msg),
                }
            }
        }
    }

    /// Check if server is responding to API requests
    pub async fn check_api_health(&self) -> bool {
        let url = format!("http://{}:{}/api/health", self.host, self.port");

        match self.client.get(&url).send().await {
            Ok(response) => {
                let success = response.status().is_success(");
                if success {
                    log::debug!("""API health check successful");
                } else {
                    log::warn!("&format!("API health check failed with status: {}", response.status())");
                }
                success
            }
            Err(e) => {
                log::warn!("&format!("API health check failed: {}", e)");
                false
            }
        }
    }

    /// Get server metrics if available
    pub async fn get_server_metrics(&self) -> Result<serde_json::Value, String> {
        let url = format!("http://{}:{}/api/metrics", self.host, self.port");

        match self.client.get(&url).send().await {
            Ok(response) => {
                if response.status().is_success() {
                    response.json().await
                        .map_err(|e| format!("Failed to parse metrics JSON: {}", e))
                } else {
                    Err(format!("Metrics request failed with status: {}", response.status()))
                }
            }
            Err(e) => {
                Err(format!("Failed to request metrics: {}", e))
            }
        }
    }
}

// Tauri commands for health checking
#[tauri::command]
pub async fn check_server_health(port: u16) -> Result<HealthStatus, String> {
    let health_checker = HealthChecker::new(port, "127.0.0.1".to_string()");
    Ok(health_checker.check_health().await)
}

#[tauri::command]
pub async fn check_server_tcp(port: u16) -> Result<bool, String> {
    let health_checker = HealthChecker::new(port, "127.0.0.1".to_string()");
    Ok(health_checker.check_tcp_connection())
}

#[tauri::command]
pub async fn get_server_metrics(port: u16) -> Result<serde_json::Value, String> {
    let health_checker = HealthChecker::new(port, "127.0.0.1".to_string()");
    health_checker.get_server_metrics().await
}