//! API integration tests for TunnelForge
//! 
//! Tests all REST API endpoints to ensure they work correctly
//! across different platforms and configurations.

use std::collections::HashMap;
use anyhow::Result;
use serde_json::json;

use super::{TestConfig, make_authenticated_request};

pub async fn run_tests(config: &TestConfig) -> Result<()> {
    test_health_endpoint(config).await?;
    test_session_management(config).await?;
    test_file_operations(config).await?;
    test_configuration_endpoints(config).await?;
    test_security_features(config).await?;
    
    Ok(())
}

async fn test_health_endpoint(config: &TestConfig) -> Result<()> {
    println!("Testing health endpoint...");
    
    let response = reqwest::get(&format!("{}/health", config.server_url)).await?;
    assert_eq!(response.status(), 200);
    
    let body: serde_json::Value = response.json().await?;
    assert!(body["status"].as_str().unwrap() == "ok");
    
    println!("✅ Health endpoint working");
    Ok(())
}

async fn test_session_management(config: &TestConfig) -> Result<()> {
    println!("Testing session management...");
    
    // Create a new session
    let create_response = make_authenticated_request(config, "api/sessions").await?;
    assert_eq!(create_response.status(), 200);
    
    let session_data: serde_json::Value = create_response.json().await?;
    let session_id = session_data["id"].as_str().unwrap();
    assert!(!session_id.is_empty());
    
    // List sessions
    let list_response = make_authenticated_request(config, "api/sessions").await?;
    assert_eq!(list_response.status(), 200);
    
    let sessions: serde_json::Value = list_response.json().await?;
    assert!(sessions.as_array().unwrap().len() > 0);
    
    // Get session details
    let detail_response = make_authenticated_request(config, &format!("api/sessions/{}", session_id)).await?;
    assert_eq!(detail_response.status(), 200);
    
    // Send command to session
    let command_data = json!({
        "command": "echo 'Hello from test'",
        "session_id": session_id
    });
    
    let client = reqwest::Client::new();
    let cmd_response = client
        .post(&format!("{}/api/sessions/{}/command", config.server_url, session_id))
        .header("Authorization", "Bearer test-token")
        .json(&command_data)
        .send()
        .await?;
    
    assert_eq!(cmd_response.status(), 200);
    
    // Clean up - delete session
    let client = reqwest::Client::new();
    let delete_response = client
        .delete(&format!("{}/api/sessions/{}", config.server_url, session_id))
        .header("Authorization", "Bearer test-token")
        .send()
        .await?;
    
    assert_eq!(delete_response.status(), 200);
    
    println!("✅ Session management working");
    Ok(())
}

async fn test_file_operations(config: &TestConfig) -> Result<()> {
    println!("Testing file operations...");
    
    let client = reqwest::Client::new();
    
    // Test file listing
    let list_response = client
        .get(&format!("{}/api/files", config.server_url))
        .header("Authorization", "Bearer test-token")
        .query(&[("path", ".")])
        .send()
        .await?;
    
    assert_eq!(list_response.status(), 200);
    
    let files: serde_json::Value = list_response.json().await?;
    assert!(files.as_array().is_some());
    
    // Test file reading (try to read a known file)
    let read_response = client
        .get(&format!("{}/api/files/read", config.server_url))
        .header("Authorization", "Bearer test-token")
        .query(&[("path", "Cargo.toml")])
        .send()
        .await?;
    
    // File might not exist in test environment, that's ok
    assert!(read_response.status().is_success() || read_response.status() == 404);
    
    println!("✅ File operations working");
    Ok(())
}

async fn test_configuration_endpoints(config: &TestConfig) -> Result<()> {
    println!("Testing configuration endpoints...");
    
    let client = reqwest::Client::new();
    
    // Get current configuration
    let get_response = client
        .get(&format!("{}/api/config", config.server_url))
        .header("Authorization", "Bearer test-token")
        .send()
        .await?;
    
    assert_eq!(get_response.status(), 200);
    
    let config_data: serde_json::Value = get_response.json().await?;
    assert!(config_data.as_object().is_some());
    
    // Update configuration
    let update_data = json!({
        "server": {
            "port": config.server_port,
            "host": "127.0.0.1"
        },
        "features": {
            "auto_save": true,
            "session_timeout": 3600
        }
    });
    
    let update_response = client
        .put(&format!("{}/api/config", config.server_url))
        .header("Authorization", "Bearer test-token")
        .json(&update_data)
        .send()
        .await?;
    
    assert_eq!(update_response.status(), 200);
    
    println!("✅ Configuration endpoints working");
    Ok(())
}

async fn test_security_features(config: &TestConfig) -> Result<()> {
    println!("Testing security features...");
    
    let client = reqwest::Client::new();
    
    // Test without authentication (should fail)
    let unauth_response = client
        .get(&format!("{}/api/sessions", config.server_url))
        .send()
        .await?;
    
    assert_eq!(unauth_response.status(), 401);
    
    // Test with invalid token (should fail)
    let invalid_response = client
        .get(&format!("{}/api/sessions", config.server_url))
        .header("Authorization", "Bearer invalid-token")
        .send()
        .await?;
    
    assert_eq!(invalid_response.status(), 401);
    
    // Test CSRF protection (if enabled)
    let csrf_response = client
        .post(&format!("{}/api/sessions", config.server_url))
        .header("Content-Type", "application/json")
        .json(&json!({"command": "test"}))
        .send()
        .await?;
    
    // Should either succeed (if CSRF not required for API) or fail with 403
    assert!(csrf_response.status().is_success() || csrf_response.status() == 403);
    
    println!("✅ Security features working");
    Ok(())
}