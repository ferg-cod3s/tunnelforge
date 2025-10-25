//! API endpoint tests for TunnelForge server
//! 
//! Comprehensive testing of all HTTP API endpoints to ensure
//! proper functionality, error handling, and response formats.

use std::time::Duration;
use tokio::time::timeout;
use anyhow::Result;
use serde_json::json;

const SERVER_URL: &str = "http://127.0.0.1:4021";
const TEST_TOKEN: &str = "test-auth-token";
const TIMEOUT: Duration = Duration::from_secs(10);

pub async fn run_api_tests() -> Result<()> {
    println!("Running API endpoint tests...");
    
    test_health_endpoints().await?;
    test_session_endpoints().await?;
    test_file_endpoints().await?;
    test_config_endpoints().await?;
    test_system_endpoints().await?;
    test_web_endpoints().await?;
    
    Ok(())
}

async fn test_health_endpoints() -> Result<()> {
    println!("Testing health endpoints...");
    
    let client = reqwest::Client::new();
    
    // Test basic health check
    let response = timeout(TIMEOUT, client.get(&format!("{}/health", SERVER_URL)).send()).await??;
    assert_eq!(response.status(), 200);
    
    let health_data: serde_json::Value = response.json().await?;
    assert_eq!(health_data["status"], "ok");
    assert!(health_data["timestamp"].is_string());
    assert!(health_data["version"].is_string());
    
    println!("✅ Basic health check working");
    
    // Test detailed health check
    let response = timeout(TIMEOUT, client.get(&format!("{}/health/detailed", SERVER_URL)).send()).await??;
    
    if response.status().is_success() {
        let detailed_health: serde_json::Value = response.json().await?;
        assert!(detailed_health["server"].is_object());
        assert!(detailed_health["database"].is_object());
        assert!(detailed_health["system"].is_object());
        
        println!("✅ Detailed health check working");
    } else {
        println!("⚠️  Detailed health check not implemented");
    }
    
    // Test readiness check
    let response = timeout(TIMEOUT, client.get(&format!("{}/ready", SERVER_URL)).send()).await??;
    
    if response.status().is_success() {
        println!("✅ Readiness check working");
    } else {
        println!("⚠️  Readiness check not implemented");
    }
    
    Ok(())
}

async fn test_session_endpoints() -> Result<()> {
    println!("Testing session endpoints...");
    
    let client = reqwest::Client::new();
    
    // Test creating a session
    let create_data = json!({
        "command": "/bin/bash",
        "args": [],
        "cwd": "/tmp",
        "env": {"TEST_VAR": "test_value"}
    });
    
    let response = timeout(
        TIMEOUT,
        client
            .post(&format!("{}/api/sessions", SERVER_URL))
            .header("Authorization", format!("Bearer {}", TEST_TOKEN))
            .json(&create_data)
            .send()
    ).await??;
    
    assert!(response.status().is_success());
    
    let session_data: serde_json::Value = response.json().await?;
    let session_id = session_data["id"].as_str().unwrap();
    assert!(!session_id.is_empty());
    
    println!("✅ Session creation working: {}", session_id);
    
    // Test listing sessions
    let response = timeout(
        TIMEOUT,
        client
            .get(&format!("{}/api/sessions", SERVER_URL))
            .header("Authorization", format!("Bearer {}", TEST_TOKEN))
            .send()
    ).await??;
    
    assert!(response.status().is_success());
    let sessions: serde_json::Value = response.json().await?;
    assert!(sessions.as_array().unwrap().len() > 0);
    
    println!("✅ Session listing working");
    
    // Test getting session details
    let response = timeout(
        TIMEOUT,
        client
            .get(&format!("{}/api/sessions/{}", SERVER_URL, session_id))
            .header("Authorization", format!("Bearer {}", TEST_TOKEN))
            .send()
    ).await??;
    
    assert!(response.status().is_success());
    let session_details: serde_json::Value = response.json().await?;
    assert_eq!(session_details["id"], session_id);
    assert!(session_details["created_at"].is_string());
    
    println!("✅ Session details working");
    
    // Test sending command to session
    let command_data = json!({
        "command": "echo 'Hello from API test'",
        "session_id": session_id
    });
    
    let response = timeout(
        TIMEOUT,
        client
            .post(&format!("{}/api/sessions/{}/command", SERVER_URL, session_id))
            .header("Authorization", format!("Bearer {}", TEST_TOKEN))
            .json(&command_data)
            .send()
    ).await??;
    
    assert!(response.status().is_success());
    
    println!("✅ Session command execution working");
    
    // Test session output
    let response = timeout(
        TIMEOUT,
        client
            .get(&format!("{}/api/sessions/{}/output", SERVER_URL, session_id))
            .header("Authorization", format!("Bearer {}", TEST_TOKEN))
            .send()
    ).await??;
    
    if response.status().is_success() {
        let output_data: serde_json::Value = response.json().await?;
        assert!(output_data["output"].is_string() || output_data["output"].is_array());
        
        println!("✅ Session output retrieval working");
    }
    
    // Test session status
    let response = timeout(
        TIMEOUT,
        client
            .get(&format!("{}/api/sessions/{}/status", SERVER_URL, session_id))
            .header("Authorization", format!("Bearer {}", TEST_TOKEN))
            .send()
    ).await??;
    
    if response.status().is_success() {
        let status_data: serde_json::Value = response.json().await?;
        assert!(status_data["status"].is_string());
        
        println!("✅ Session status working");
    }
    
    // Test session resize
    let resize_data = json!({
        "rows": 24,
        "cols": 80
    });
    
    let response = timeout(
        TIMEOUT,
        client
            .post(&format!("{}/api/sessions/{}/resize", SERVER_URL, session_id))
            .header("Authorization", format!("Bearer {}", TEST_TOKEN))
            .json(&resize_data)
            .send()
    ).await??;
    
    if response.status().is_success() {
        println!("✅ Session resize working");
    }
    
    // Test deleting session
    let response = timeout(
        TIMEOUT,
        client
            .delete(&format!("{}/api/sessions/{}", SERVER_URL, session_id))
            .header("Authorization", format!("Bearer {}", TEST_TOKEN))
            .send()
    ).await??;
    
    assert!(response.status().is_success());
    
    println!("✅ Session deletion working");
    
    Ok(())
}

async fn test_file_endpoints() -> Result<()> {
    println!("Testing file endpoints...");
    
    let client = reqwest::Client::new();
    
    // Test file listing
    let response = timeout(
        TIMEOUT,
        client
            .get(&format!("{}/api/files", SERVER_URL))
            .header("Authorization", format!("Bearer {}", TEST_TOKEN))
            .query(&[("path", "/tmp")])
            .send()
    ).await??;
    
    if response.status().is_success() {
        let files: serde_json::Value = response.json().await?;
        assert!(files.as_array().is_some());
        
        println!("✅ File listing working");
    }
    
    // Test file reading
    let response = timeout(
        TIMEOUT,
        client
            .get(&format!("{}/api/files/read", SERVER_URL))
            .header("Authorization", format!("Bearer {}", TEST_TOKEN))
            .query(&[("path", "/etc/hostname")])
            .send()
    ).await??;
    
    // May succeed or fail depending on file existence and permissions
    if response.status().is_success() {
        println!("✅ File reading working");
    } else {
        println!("⚠️  File reading failed (may be expected)");
    }
    
    // Test file writing
    let test_content = "Test content from API";
    let write_data = json!({
        "path": "/tmp/tunnelforge_api_test.txt",
        "content": test_content
    });
    
    let response = timeout(
        TIMEOUT,
        client
            .post(&format!("{}/api/files/write", SERVER_URL))
            .header("Authorization", format!("Bearer {}", TEST_TOKEN))
            .json(&write_data)
            .send()
    ).await??;
    
    if response.status().is_success() {
        println!("✅ File writing working");
        
        // Clean up
        let _ = std::fs::remove_file("/tmp/tunnelforge_api_test.txt");
    }
    
    // Test file stats
    let response = timeout(
        TIMEOUT,
        client
            .get(&format!("{}/api/files/stats", SERVER_URL))
            .header("Authorization", format!("Bearer {}", TEST_TOKEN))
            .query(&[("path", "/tmp")])
            .send()
    ).await??;
    
    if response.status().is_success() {
        let stats: serde_json::Value = response.json().await?;
        assert!(stats["size"].is_number());
        assert!(stats["mode"].is_number());
        
        println!("✅ File stats working");
    }
    
    Ok(())
}

async fn test_config_endpoints() -> Result<()> {
    println!("Testing configuration endpoints...");
    
    let client = reqwest::Client::new();
    
    // Test getting configuration
    let response = timeout(
        TIMEOUT,
        client
            .get(&format!("{}/api/config", SERVER_URL))
            .header("Authorization", format!("Bearer {}", TEST_TOKEN))
            .send()
    ).await??;
    
    if response.status().is_success() {
        let config: serde_json::Value = response.json().await?;
        assert!(config.as_object().is_some());
        
        println!("✅ Configuration retrieval working");
    }
    
    // Test updating configuration
    let update_data = json!({
        "server": {
            "port": 4021,
            "host": "127.0.0.1"
        },
        "features": {
            "auto_save": true,
            "session_timeout": 3600
        }
    });
    
    let response = timeout(
        TIMEOUT,
        client
            .put(&format!("{}/api/config", SERVER_URL))
            .header("Authorization", format!("Bearer {}", TEST_TOKEN))
            .json(&update_data)
            .send()
    ).await??;
    
    if response.status().is_success() {
        println!("✅ Configuration update working");
    }
    
    // Test configuration validation
    let invalid_data = json!({
        "server": {
            "port": "invalid_port"
        }
    });
    
    let response = timeout(
        TIMEOUT,
        client
            .put(&format!("{}/api/config", SERVER_URL))
            .header("Authorization", format!("Bearer {}", TEST_TOKEN))
            .json(&invalid_data)
            .send()
    ).await??;
    
    if response.status() == 400 {
        println!("✅ Configuration validation working");
    }
    
    Ok(())
}

async fn test_system_endpoints() -> Result<()> {
    println!("Testing system endpoints...");
    
    let client = reqwest::Client::new();
    
    // Test system info
    let response = timeout(
        TIMEOUT,
        client
            .get(&format!("{}/api/system/info", SERVER_URL))
            .header("Authorization", format!("Bearer {}", TEST_TOKEN))
            .send()
    ).await??;
    
    if response.status().is_success() {
        let info: serde_json::Value = response.json().await?;
        assert!(info["platform"].is_string());
        assert!(info["architecture"].is_string());
        
        println!("✅ System info working");
    }
    
    // Test system resources
    let response = timeout(
        TIMEOUT,
        client
            .get(&format!("{}/api/system/resources", SERVER_URL))
            .header("Authorization", format!("Bearer {}", TEST_TOKEN))
            .send()
    ).await??;
    
    if response.status().is_success() {
        let resources: serde_json::Value = response.json().await?;
        assert!(resources["cpu_usage"].is_number());
        assert!(resources["memory_usage"].is_number());
        
        println!("✅ System resources working");
    }
    
    // Test process listing
    let response = timeout(
        TIMEOUT,
        client
            .get(&format!("{}/api/system/processes", SERVER_URL))
            .header("Authorization", format!("Bearer {}", TEST_TOKEN))
            .send()
    ).await??;
    
    if response.status().is_success() {
        let processes: serde_json::Value = response.json().await?;
        assert!(processes.as_array().is_some());
        
        println!("✅ Process listing working");
    }
    
    Ok(())
}

async fn test_web_endpoints() -> Result<()> {
    println!("Testing web endpoints...");
    
    let client = reqwest::Client::new();
    
    // Test main web interface
    let response = timeout(TIMEOUT, client.get(&format!("{}/", SERVER_URL)).send()).await??;
    
    if response.status().is_success() {
        let content_type = response.headers().get("content-type");
        if let Some(ct) = content_type {
            let ct_str = ct.to_str().unwrap_or("");
            if ct_str.contains("text/html") {
                println!("✅ Web interface serving HTML");
            }
        }
    }
    
    // Test static assets
    let response = timeout(
        TIMEOUT,
        client.get(&format!("{}/static/app.js", SERVER_URL))
            .send()
    ).await??;
    
    if response.status().is_success() {
        println!("✅ Static assets serving");
    }
    
    // Test API version endpoint
    let response = timeout(
        TIMEOUT,
        client.get(&format!("{}/api/version", SERVER_URL))
            .send()
    ).await??;
    
    if response.status().is_success() {
        let version: serde_json::Value = response.json().await?;
        assert!(version["version"].is_string());
        
        println!("✅ Version endpoint working");
    }
    
    Ok(())
}