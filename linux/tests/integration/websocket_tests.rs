//! WebSocket integration tests for TunnelForge
//! 
//! Tests real-time communication, terminal I/O, and event broadcasting
//! through WebSocket connections.

use std::time::Duration;
use tokio::time::timeout;
use anyhow::Result;
use tokio_tungstenite::{tungstenite::Message, WebSocketStream};
use futures::{SinkExt, StreamExt};

use super::{TestConfig, create_test_connection};

pub async fn run_tests(config: &TestConfig) -> Result<()> {
    test_websocket_connection(config).await?;
    test_terminal_io(config).await?;
    test_event_broadcasting(config).await?;
    test_multiple_connections(config).await?;
    test_connection_recovery(config).await?;
    
    Ok(())
}

async fn test_websocket_connection(config: &TestConfig) -> Result<()> {
    println!("Testing WebSocket connection...");
    
    let mut ws_stream = create_test_connection(&config.ws_url).await?;
    
    // Send a test message
    let test_msg = serde_json::json!({
        "type": "ping",
        "timestamp": chrono::Utc::now().timestamp()
    });
    
    ws_stream.send(Message::Text(test_msg.to_string())).await?;
    
    // Wait for response
    let response = timeout(Duration::from_secs(5), ws_stream.next()).await??;
    
    match response {
        Some(Message::Text(text)) => {
            let response_data: serde_json::Value = serde_json::from_str(&text)?;
            assert!(response_data["type"].is_string());
            println!("✅ WebSocket connection working");
        }
        Some(msg) => anyhow::bail!("Unexpected message type: {:?}", msg),
        None => anyhow::bail!("No response received"),
    }
    
    ws_stream.close(None).await?;
    Ok(())
}

async fn test_terminal_io(config: &TestConfig) -> Result<()> {
    println!("Testing terminal I/O over WebSocket...");
    
    let mut ws_stream = create_test_connection(&config.ws_url).await?;
    
    // Create a new session
    let create_session_msg = serde_json::json!({
        "type": "create_session",
        "data": {
            "command": "/bin/bash",
            "cwd": "/tmp"
        }
    });
    
    ws_stream.send(Message::Text(create_session_msg.to_string())).await?;
    
    // Wait for session creation response
    let response = timeout(Duration::from_secs(5), ws_stream.next()).await??;
    
    let session_id = match response {
        Some(Message::Text(text)) => {
            let response_data: serde_json::Value = serde_json::from_str(&text)?;
            response_data["data"]["session_id"].as_str().unwrap().to_string()
        }
        _ => anyhow::bail!("Failed to create session"),
    };
    
    // Send a command to the terminal
    let command_msg = serde_json::json!({
        "type": "session_command",
        "data": {
            "session_id": session_id,
            "input": "echo 'Hello from WebSocket test'\n"
        }
    });
    
    ws_stream.send(Message::Text(command_msg.to_string())).await?;
    
    // Wait for command output
    let mut output_received = false;
    let timeout_duration = Duration::from_secs(10);
    let start_time = std::time::Instant::now();
    
    while start_time.elapsed() < timeout_duration && !output_received {
        if let Some(msg) = timeout(Duration::from_secs(1), ws_stream.next()).await? {
            match msg {
                Message::Text(text) => {
                    let response_data: serde_json::Value = serde_json::from_str(&text)?;
                    if let Some(output) = response_data["data"]["output"].as_str() {
                        if output.contains("Hello from WebSocket test") {
                            output_received = true;
                            println!("✅ Terminal I/O working");
                        }
                    }
                }
                Message::Binary(_) => {
                    // Handle binary terminal data
                }
                _ => {}
            }
        }
    }
    
    if !output_received {
        anyhow::bail!("Did not receive expected terminal output");
    }
    
    // Clean up session
    let cleanup_msg = serde_json::json!({
        "type": "close_session",
        "data": {
            "session_id": session_id
        }
    });
    
    ws_stream.send(Message::Text(cleanup_msg.to_string())).await?;
    ws_stream.close(None).await?;
    
    Ok(())
}

async fn test_event_broadcasting(config: &TestConfig) -> Result<()> {
    println!("Testing event broadcasting...");
    
    // Create two connections
    let mut ws1 = create_test_connection(&config.ws_url).await?;
    let mut ws2 = create_test_connection(&config.ws_url).await?;
    
    // Subscribe to events on both connections
    let subscribe_msg = serde_json::json!({
        "type": "subscribe_events",
        "data": {
            "events": ["session_created", "session_closed", "server_status"]
        }
    });
    
    ws1.send(Message::Text(subscribe_msg.to_string())).await?;
    ws2.send(Message::Text(subscribe_msg.to_string())).await?;
    
    // Create an event by creating a session on connection 1
    let create_session_msg = serde_json::json!({
        "type": "create_session",
        "data": {
            "command": "/bin/echo",
            "args": ["test"]
        }
    });
    
    ws1.send(Message::Text(create_session_msg.to_string())).await?;
    
    // Check if connection 2 receives the event
    let mut event_received = false;
    let timeout_duration = Duration::from_secs(5);
    let start_time = std::time::Instant::now();
    
    while start_time.elapsed() < timeout_duration && !event_received {
        if let Some(msg) = timeout(Duration::from_secs(1), ws2.next()).await? {
            match msg {
                Message::Text(text) => {
                    let response_data: serde_json::Value = serde_json::from_str(&text)?;
                    if response_data["type"].as_str() == Some("event") {
                        if response_data["data"]["event_type"].as_str() == Some("session_created") {
                            event_received = true;
                            println!("✅ Event broadcasting working");
                        }
                    }
                }
                _ => {}
            }
        }
    }
    
    if !event_received {
        anyhow::bail!("Event broadcasting not working");
    }
    
    ws1.close(None).await?;
    ws2.close(None).await?;
    
    Ok(())
}

async fn test_multiple_connections(config: &TestConfig) -> Result<()> {
    println!("Testing multiple simultaneous connections...");
    
    let mut connections = Vec::new();
    
    // Create multiple connections
    for i in 0..5 {
        let ws = create_test_connection(&config.ws_url).await?;
        connections.push(ws);
        println!("Created connection {}", i + 1);
    }
    
    // Send ping on each connection
    for (i, ws) in connections.iter_mut().enumerate() {
        let ping_msg = serde_json::json!({
            "type": "ping",
            "data": {
                "connection_id": i
            }
        });
        
        ws.send(Message::Text(ping_msg.to_string())).await?;
    }
    
    // Verify all connections receive responses
    let mut successful_responses = 0;
    let timeout_duration = Duration::from_secs(5);
    
    for (i, ws) in connections.iter_mut().enumerate() {
        if let Ok(Some(msg)) = timeout(timeout_duration, ws.next()).await {
            match msg {
                Message::Text(_) => {
                    successful_responses += 1;
                    println!("Connection {} responded", i + 1);
                }
                _ => {}
            }
        }
    }
    
    // Close all connections
    for mut ws in connections {
        let _ = ws.close(None).await;
    }
    
    if successful_responses >= 4 { // Allow for one failure
        println!("✅ Multiple connections working");
    } else {
        anyhow::bail!("Too many connection failures: {}/5", successful_responses);
    }
    
    Ok(())
}

async fn test_connection_recovery(config: &TestConfig) -> Result<()> {
    println!("Testing connection recovery...");
    
    let mut ws = create_test_connection(&config.ws_url).await?;
    
    // Create a session
    let create_session_msg = serde_json::json!({
        "type": "create_session",
        "data": {
            "command": "/bin/bash"
        }
    });
    
    ws.send(Message::Text(create_session_msg.to_string())).await?;
    
    // Get session ID
    let response = timeout(Duration::from_secs(5), ws.next()).await??;
    let session_id = match response {
        Message::Text(text) => {
            let response_data: serde_json::Value = serde_json::from_str(&text)?;
            response_data["data"]["session_id"].as_str().unwrap().to_string()
        }
        _ => anyhow::bail!("Failed to create session"),
    };
    
    // Close connection abruptly
    drop(ws);
    
    // Wait a bit
    tokio::time::sleep(Duration::from_secs(2)).await;
    
    // Reconnect and try to access the same session
    let mut ws = create_test_connection(&config.ws_url).await?;
    
    let session_status_msg = serde_json::json!({
        "type": "get_session_status",
        "data": {
            "session_id": session_id
        }
    });
    
    ws.send(Message::Text(session_status_msg.to_string())).await?;
    
    // Check if session is still accessible
    let response = timeout(Duration::from_secs(5), ws.next()).await??;
    
    match response {
        Message::Text(text) => {
            let response_data: serde_json::Value = serde_json::from_str(&text)?;
            if response_data["type"].as_str() == Some("session_status") {
                println!("✅ Connection recovery working");
            } else {
                anyhow::bail!("Unexpected response after reconnection");
            }
        }
        _ => anyhow::bail!("No response after reconnection"),
    }
    
    ws.close(None).await?;
    Ok(())
}