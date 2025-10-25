//! Test harness for setting up and managing test environments
//! 
//! Provides utilities for starting/stopping servers, managing test data,
//! and creating isolated test environments.

use std::process::{Child, Command, Stdio};
use std::time::Duration;
use tokio::time::{timeout, sleep};
use anyhow::{Result, Context};
use reqwest;
use tokio_tungstenite::{connect_async, tungstenite::Message};

use super::TestConfig;

pub struct TestHarness {
    config: TestConfig,
    server_process: Option<Child>,
    test_data_dir: tempfile::TempDir,
}

impl TestHarness {
    pub async fn new(config: TestConfig) -> Result<Self> {
        let test_data_dir = tempfile::tempdir()
            .context("Failed to create test data directory")?;
        
        let mut harness = Self {
            config,
            server_process: None,
            test_data_dir,
        };
        
        harness.start_server().await?;
        harness.wait_for_server().await?;
        
        Ok(harness)
    }
    
    async fn start_server(&mut self) -> Result<()> {
        println!("Starting TunnelForge server for testing...");
        
        // Start the Go server
        let mut cmd = Command::new("../../development/go-server/tunnelforge-server");
        cmd.current_dir("../../development/go-server")
            .env("TUNNELFORGE_TEST_MODE", "true")
            .env("TUNNELFORGE_DATA_DIR", self.test_data_dir.path())
            .env("TUNNELFORGE_PORT", self.config.server_port.to_string())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        
        let child = cmd.spawn()
            .context("Failed to start TunnelForge server")?;
        
        self.server_process = Some(child);
        println!("Server started with PID: {:?}", self.server_process.as_ref().map(|p| p.id()));
        
        Ok(())
    }
    
    async fn wait_for_server(&self) -> Result<()> {
        println!("Waiting for server to be ready...");
        
        let start = std::time::Instant::now();
        let timeout_duration = Duration::from_secs(30);
        
        while start.elapsed() < timeout_duration {
            if let Ok(response) = reqwest::get(&format!("{}/health", self.config.server_url)).await {
                if response.status().is_success() {
                    println!("Server is ready!");
                    return Ok(());
                }
            }
            
            sleep(Duration::from_millis(500)).await;
        }
        
        anyhow::bail!("Server failed to start within timeout period");
    }
    
    pub async fn run_test_suite<F, Fut>(&mut self, name: &str, test_fn: F) -> Result<()>
    where
        F: FnOnce(&TestConfig) -> Fut,
        Fut: std::future::Future<Output = Result<()>>,
    {
        println!("\n=== Running {} ===", name);
        
        let result = timeout(self.config.timeout, test_fn(&self.config)).await;
        
        match result {
            Ok(Ok(())) => {
                println!("✅ {} passed", name);
                Ok(())
            }
            Ok(Err(e)) => {
                println!("❌ {} failed: {}", name, e);
                Err(e)
            }
            Err(_) => {
                println!("⏰ {} timed out", name);
                anyhow::bail!("Test suite {} timed out", name);
            }
        }
    }
    
    pub async fn cleanup(&mut self) -> Result<()> {
        println!("Cleaning up test environment...");
        
        if let Some(mut process) = self.server_process.take() {
            println!("Stopping server...");
            
            // Try graceful shutdown first
            #[cfg(unix)]
            {
                use nix::sys::signal::{kill, Signal};
                use nix::unistd::Pid;
                
                if let Some(pid) = process.id() {
                    let _ = kill(Pid::from_raw(pid as i32), Signal::SIGTERM);
                }
            }
            
            #[cfg(windows)]
            {
                process.kill().ok();
            }
            
            // Wait for process to exit
            let _ = timeout(Duration::from_secs(10), async {
                let _ = process.wait();
            }).await;
            
            // Force kill if still running
            if let Ok(None) = process.try_wait() {
                println!("Force killing server...");
                process.kill().ok();
                let _ = process.wait();
            }
        }
        
        // Test data directory is automatically cleaned up when dropped
        println!("Test environment cleaned up");
        Ok(())
    }
}

impl Drop for TestHarness {
    fn drop(&mut self) {
        // Best effort cleanup
        if let Some(mut process) = self.server_process.take() {
            let _ = process.kill();
        }
    }
}

/// Utility to create WebSocket connections for testing
pub async fn create_test_connection(ws_url: &str) -> Result<tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>> {
    let (ws_stream, _) = timeout(
        Duration::from_secs(10),
        connect_async(ws_url)
    ).await
    .context("WebSocket connection timed out")?
    .context("Failed to connect WebSocket")?;
    
    Ok(ws_stream)
}

/// Utility to make authenticated API requests
pub async fn make_authenticated_request(
    base_url: &str,
    endpoint: &str,
) -> Result<reqwest::Response> {
    let client = reqwest::Client::new();
    let url = format!("{}/{}", base_url, endpoint);
    
    let response = client
        .get(&url)
        .header("Authorization", "Bearer test-token")
        .send()
        .await
        .context("Failed to make authenticated request")?;
    
    Ok(response)
}