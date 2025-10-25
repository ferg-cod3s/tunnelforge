//! Integration tests for TunnelForge cross-platform functionality
//! 
//! These tests verify that all components work together correctly
//! across different platforms and configurations.

use std::time::Duration;
use tokio::time::timeout;
use anyhow::Result;

mod test_harness;
mod api_tests;
mod websocket_tests;
mod terminal_tests;
mod cross_platform_tests;

pub use test_harness::*;

/// Test configuration
pub struct TestConfig {
    pub server_port: u16,
    pub server_url: String,
    pub ws_url: String,
    pub timeout: Duration,
}

impl Default for TestConfig {
    fn default() -> Self {
        Self {
            server_port: 4021,
            server_url: "http://127.0.0.1:4021".to_string(),
            ws_url: "ws://127.0.0.1:4021/ws".to_string(),
            timeout: Duration::from_secs(30),
        }
    }
}

/// Main test runner that sets up and tears down test environment
pub async fn run_integration_tests() -> Result<()> {
    env_logger::init();
    
    let config = TestConfig::default();
    let mut harness = TestHarness::new(config).await?;
    
    // Run all test suites
    harness.run_test_suite("API Tests", api_tests::run_tests).await?;
    harness.run_test_suite("WebSocket Tests", websocket_tests::run_tests).await?;
    harness.run_test_suite("Terminal Tests", terminal_tests::run_tests).await?;
    harness.run_test_suite("Cross-Platform Tests", cross_platform_tests::run_tests).await?;
    
    harness.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_full_integration() -> Result<()> {
    run_integration_tests().await
}