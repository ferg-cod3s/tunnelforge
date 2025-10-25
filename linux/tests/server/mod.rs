//! Server integration tests for TunnelForge
//! 
//! Tests the Go server backend functionality including:
//! - HTTP API endpoints
//! - WebSocket connections
//! - Authentication and security
//! - Performance and load testing

use anyhow::Result;

mod api_endpoints;
mod websocket_server;
mod authentication;
mod performance_tests;
mod security_tests;
mod error_handling;

pub async fn run_server_tests() -> Result<()> {
    println!("Running server tests...");
    
    api_endpoints::run_api_tests().await?;
    websocket_server::run_websocket_tests().await?;
    authentication::run_auth_tests().await?;
    security_tests::run_security_tests().await?;
    error_handling::run_error_tests().await?;
    performance_tests::run_performance_tests().await?;
    
    Ok(())
}

#[tokio::test]
async fn test_server_functionality() -> Result<()> {
    run_server_tests().await
}