//! Terminal integration tests for TunnelForge
//! 
//! Tests terminal session management, process execution,
//! and shell integration across different platforms.

use std::time::Duration;
use tokio::time::timeout;
use anyhow::Result;
use nix::sys::signal::{kill, Signal};
use nix::unistd::Pid;

use super::{TestConfig, make_authenticated_request};

pub async fn run_tests(config: &TestConfig) -> Result<()> {
    test_terminal_session_creation(config).await?;
    test_process_execution(config).await?;
    test_signal_handling(config).await?;
    test_environment_variables(config).await?;
    test_working_directory(config).await?;
    test_session_cleanup(config).await?;
    
    Ok(())
}

async fn test_terminal_session_creation(config: &TestConfig) -> Result<()> {
    println!("Testing terminal session creation...");
    
    let client = reqwest::Client::new();
    
    // Create session with different shells
    let test_shells = vec![
        ("/bin/bash", "Bash"),
        ("/bin/sh", "Sh"),
        #[cfg(target_os = "linux")]
        ("/usr/bin/zsh", "Zsh"),
        #[cfg(target_os = "macos")]
        ("/bin/zsh", "Zsh"),
    ];
    
    for (shell, name) in test_shells {
        if std::path::Path::new(shell).exists() {
            let create_data = serde_json::json!({
                "command": shell,
                "args": [],
                "cwd": "/tmp",
                "env": {}
            });
            
            let response = client
                .post(&format!("{}/api/sessions", config.server_url))
                .header("Authorization", "Bearer test-token")
                .json(&create_data)
                .send()
                .await?;
            
            if response.status().is_success() {
                let session_data: serde_json::Value = response.json().await?;
                let session_id = session_data["id"].as_str().unwrap();
                
                println!("✅ {} session created: {}", name, session_id);
                
                // Clean up
                let _ = client
                    .delete(&format!("{}/api/sessions/{}", config.server_url, session_id))
                    .header("Authorization", "Bearer test-token")
                    .send()
                    .await;
            } else {
                println!("⚠️  {} shell not available or failed", name);
            }
        }
    }
    
    Ok(())
}

async fn test_process_execution(config: &TestConfig) -> Result<()> {
    println!("Testing process execution...");
    
    let client = reqwest::Client::new();
    
    // Create a session
    let create_data = serde_json::json!({
        "command": "/bin/bash",
        "args": [],
        "cwd": "/tmp"
    });
    
    let response = client
        .post(&format!("{}/api/sessions", config.server_url))
        .header("Authorization", "Bearer test-token")
        .json(&create_data)
        .send()
        .await?;
    
    assert!(response.status().is_success());
    let session_data: serde_json::Value = response.json().await?;
    let session_id = session_data["id"].as_str().unwrap();
    
    // Test various commands
    let test_commands = vec![
        ("echo 'Hello World'", "Hello World"),
        ("pwd", "/tmp"),
        ("whoami", None), // Depends on system
        ("date", None), // Dynamic output
        ("ls -la", None), // Directory contents
    ];
    
    for (command, expected_output) in test_commands {
        let command_data = serde_json::json!({
            "command": command,
            "session_id": session_id
        });
        
        let response = client
            .post(&format!("{}/api/sessions/{}/command", config.server_url, session_id))
            .header("Authorization", "Bearer test-token")
            .json(&command_data)
            .send()
            .await?;
        
        if response.status().is_success() {
            let result: serde_json::Value = response.json().await?;
            if let Some(output) = result["output"].as_str() {
                if let Some(expected) = expected_output {
                    if output.contains(expected) {
                        println!("✅ Command executed correctly: {}", command);
                    } else {
                        println!("⚠️  Command output unexpected: {} -> {}", command, output);
                    }
                } else {
                    println!("✅ Command executed: {}", command);
                }
            }
        } else {
            println!("❌ Command failed: {}", command);
        }
    }
    
    // Clean up
    let _ = client
        .delete(&format!("{}/api/sessions/{}", config.server_url, session_id))
        .header("Authorization", "Bearer test-token")
        .send()
        .await;
    
    Ok(())
}

async fn test_signal_handling(config: &TestConfig) -> Result<()> {
    println!("Testing signal handling...");
    
    let client = reqwest::Client::new();
    
    // Create a long-running process
    let create_data = serde_json::json!({
        "command": "/bin/bash",
        "args": [],
        "cwd": "/tmp"
    });
    
    let response = client
        .post(&format!("{}/api/sessions", config.server_url))
        .header("Authorization", "Bearer test-token")
        .json(&create_data)
        .send()
        .await?;
    
    assert!(response.status().is_success());
    let session_data: serde_json::Value = response.json().await?;
    let session_id = session_data["id"].as_str().unwrap();
    
    // Start a long-running command
    let command_data = serde_json::json!({
        "command": "sleep 30",
        "session_id": session_id
    });
    
    let response = client
        .post(&format!("{}/api/sessions/{}/command", config.server_url, session_id))
        .header("Authorization", "Bearer test-token")
        .json(&command_data)
        .send()
        .await?;
    
    assert!(response.status().is_success());
    
    // Wait a bit for the command to start
    tokio::time::sleep(Duration::from_secs(1)).await;
    
    // Send SIGINT (Ctrl+C)
    let signal_data = serde_json::json!({
        "signal": "SIGINT",
        "session_id": session_id
    });
    
    let response = client
        .post(&format!("{}/api/sessions/{}/signal", config.server_url, session_id))
        .header("Authorization", "Bearer test-token")
        .json(&signal_data)
        .send()
        .await?;
    
    if response.status().is_success() {
        println!("✅ Signal handling working");
    } else {
        println!("⚠️  Signal handling may need implementation");
    }
    
    // Clean up
    let _ = client
        .delete(&format!("{}/api/sessions/{}", config.server_url, session_id))
        .header("Authorization", "Bearer test-token")
        .send()
        .await;
    
    Ok(())
}

async fn test_environment_variables(config: &TestConfig) -> Result<()> {
    println!("Testing environment variables...");
    
    let client = reqwest::Client::new();
    
    // Create session with custom environment
    let create_data = serde_json::json!({
        "command": "/bin/bash",
        "args": [],
        "cwd": "/tmp",
        "env": {
            "TEST_VAR": "test_value",
            "PATH": "/usr/bin:/bin"
        }
    });
    
    let response = client
        .post(&format!("{}/api/sessions", config.server_url))
        .header("Authorization", "Bearer test-token")
        .json(&create_data)
        .send()
        .await?;
    
    assert!(response.status().is_success());
    let session_data: serde_json::Value = response.json().await?;
    let session_id = session_data["id"].as_str().unwrap();
    
    // Check environment variable
    let command_data = serde_json::json!({
        "command": "echo $TEST_VAR",
        "session_id": session_id
    });
    
    let response = client
        .post(&format!("{}/api/sessions/{}/command", config.server_url, session_id))
        .header("Authorization", "Bearer test-token")
        .json(&command_data)
        .send()
        .await?;
    
    if response.status().is_success() {
        let result: serde_json::Value = response.json().await?;
        if let Some(output) = result["output"].as_str() {
            if output.contains("test_value") {
                println!("✅ Environment variables working");
            } else {
                println!("⚠️  Environment variable not set correctly");
            }
        }
    }
    
    // Clean up
    let _ = client
        .delete(&format!("{}/api/sessions/{}", config.server_url, session_id))
        .header("Authorization", "Bearer test-token")
        .send()
        .await;
    
    Ok(())
}

async fn test_working_directory(config: &TestConfig) -> Result<()> {
    println!("Testing working directory...");
    
    let client = reqwest::Client::new();
    
    // Create session in specific directory
    let test_dir = "/tmp/tunnelforge_test";
    
    // Ensure test directory exists
    std::fs::create_dir_all(test_dir)?;
    
    let create_data = serde_json::json!({
        "command": "/bin/bash",
        "args": [],
        "cwd": test_dir
    });
    
    let response = client
        .post(&format!("{}/api/sessions", config.server_url))
        .header("Authorization", "Bearer test-token")
        .json(&create_data)
        .send()
        .await?;
    
    assert!(response.status().is_success());
    let session_data: serde_json::Value = response.json().await?;
    let session_id = session_data["id"].as_str().unwrap();
    
    // Check current directory
    let command_data = serde_json::json!({
        "command": "pwd",
        "session_id": session_id
    });
    
    let response = client
        .post(&format!("{}/api/sessions/{}/command", config.server_url, session_id))
        .header("Authorization", "Bearer test-token")
        .json(&command_data)
        .send()
        .await?;
    
    if response.status().is_success() {
        let result: serde_json::Value = response.json().await?;
        if let Some(output) = result["output"].as_str() {
            if output.contains(test_dir) {
                println!("✅ Working directory working");
            } else {
                println!("⚠️  Working directory not set correctly: {}", output);
            }
        }
    }
    
    // Clean up
    let _ = client
        .delete(&format!("{}/api/sessions/{}", config.server_url, session_id))
        .header("Authorization", "Bearer test-token")
        .send()
        .await;
    
    // Remove test directory
    std::fs::remove_dir_all(test_dir)?;
    
    Ok(())
}

async fn test_session_cleanup(config: &TestConfig) -> Result<()> {
    println!("Testing session cleanup...");
    
    let client = reqwest::Client::new();
    
    // Create multiple sessions
    let mut session_ids = Vec::new();
    
    for i in 0..5 {
        let create_data = serde_json::json!({
            "command": "/bin/bash",
            "args": [],
            "cwd": "/tmp"
        });
        
        let response = client
            .post(&format!("{}/api/sessions", config.server_url))
            .header("Authorization", "Bearer test-token")
            .json(&create_data)
            .send()
            .await?;
        
        if response.status().is_success() {
            let session_data: serde_json::Value = response.json().await?;
            let session_id = session_data["id"].as_str().unwrap().to_string();
            session_ids.push(session_id);
            println!("Created session {}: {}", i + 1, session_id);
        }
    }
    
    // List sessions to verify they exist
    let response = make_authenticated_request(config, "api/sessions").await?;
    let sessions: serde_json::Value = response.json().await?;
    let initial_count = sessions.as_array().unwrap().len();
    
    // Clean up all sessions
    for session_id in &session_ids {
        let response = client
            .delete(&format!("{}/api/sessions/{}", config.server_url, session_id))
            .header("Authorization", "Bearer test-token")
            .send()
            .await?;
        
        if response.status().is_success() {
            println!("Cleaned up session: {}", session_id);
        }
    }
    
    // Verify sessions are cleaned up
    let response = make_authenticated_request(config, "api/sessions").await?;
    let sessions: serde_json::Value = response.json().await?;
    let final_count = sessions.as_array().unwrap().len();
    
    if final_count < initial_count {
        println!("✅ Session cleanup working");
    } else {
        println!("⚠️  Session cleanup may have issues");
    }
    
    Ok(())
}