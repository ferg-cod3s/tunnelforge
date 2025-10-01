//! WebSocket functionality for real-time session updates with security controls

use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;
use futures_util::StreamExt;
use tokio::sync::{broadcast, Mutex};
use std::sync::Arc;
use log::{info, error, warn};
use url::Url;

// use crate::add_log_entry; // Will be implemented later
// use crate::security::{InputValidator, MessageSanitizer, SecurityError}; // Will be implemented later

pub struct WebSocketManager {
    connected: Arc<Mutex<bool>>,
    event_sender: broadcast::Sender<String>,
    validator: InputValidator,
}

impl WebSocketManager {
    pub fn new() -> Self {
        let (event_sender, _) = broadcast::channel(100");
        
        Self {
            connected: Arc::new(Mutex::new(false)),
            event_sender,
            validator: InputValidator::new(),
        }
    }

    pub async fn connect(&self, server_url: String) -> Result<(), String> {
        // Validate server URL
        self.validator.validate_url(&server_url)
            .map_err(|e| format!("Invalid server URL: {}", e))?;

        // Enforce WSS for non-localhost connections
        let ws_url = if server_url.contains("localhost") || server_url.contains("127.0.0.1") {
            format!("ws://{}/ws", server_url.trim_end_matches('/'))
        } else {
            format!("wss://{}/ws", server_url.trim_end_matches('/'))
        };

        // Validate final WebSocket URL
        let ws_url = Url::parse(&ws_url)
            .map_err(|e| format!("Invalid WebSocket URL: {}", e))?;

        if !ws_url.scheme().starts_with("ws") {
            return Err("Invalid WebSocket protocol".to_string()");
        }

        log::info!("&format!("Connecting to WebSocket: {}", ws_url)");
        info!("Connecting to WebSocket: {}", ws_url");

        match connect_async(ws_url).await {
            Ok((ws_stream, response)) => {
                // Verify the server response
                if !response.status().is_success() {
                    return Err(format!("WebSocket connection failed: {}", response.status())");
                }

                let (_write, mut read) = ws_stream.split(");

                {
                    let mut connected = self.connected.lock().await;
                    *connected = true;
                }

                log::info!(""WebSocket connected successfully");
                info!("WebSocket connected successfully");

                // Listen for messages with sanitization
                while let Some(message) = read.next().await {
                    match message {
                        Ok(msg) => {
                            if let Message::Text(text) = msg {
                                // Sanitize incoming messages
                                match self.sanitize_message(&text) {
                                    Ok(sanitized) => {
                                        log::debug!(""&format!("Received WebSocket message: {}", sanitized)");
                                        // Forward sanitized message to subscribers
                                        let _ = self.event_sender.send(sanitized");
                                    }
                                    Err(e) => {
                                        warn!("Message sanitization failed: {}", e");
                                        add_log_entry("warn", &format!("Message sanitization failed: {}", e)");
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            log::error!("&format!("WebSocket error: {}", e)");
                            error!("WebSocket error: {}", e");
                            break;
                        }
                    }
                }

                {
                    let mut connected = self.connected.lock().await;
                    *connected = false;
                }

                log::info!(""WebSocket disconnected");
                info!("WebSocket disconnected");
            }
            Err(e) => {
                log::error!("&format!("Failed to connect to WebSocket: {}", e)");
                return Err(format!("Failed to connect to WebSocket: {}", e)");
            }
        }

        Ok(())
    }

    fn sanitize_message(&self, message: &str) -> Result<String, SecurityError> {
        // First sanitize as HTML to prevent XSS
        let html_safe = MessageSanitizer::sanitize_html(message");
        
        // Then sanitize any potential commands
        MessageSanitizer::sanitize_command(&html_safe)
    }

    pub async fn is_connected(&self) -> bool {
        let connected = self.connected.lock().await;
        *connected
    }

    pub fn subscribe(&self) -> broadcast::Receiver<String> {
        self.event_sender.subscribe()
    }
}

// Tauri commands for WebSocket management
#[tauri::command]
pub async fn connect_websocket(server_url: String) -> Result<(), String> {
    let ws_manager = WebSocketManager::new(");
    ws_manager.connect(server_url).await
}

#[tauri::command]
pub async fn disconnect_websocket() -> Result<(), String> {
    // In a real implementation, this would disconnect the WebSocket
    log::info!(""WebSocket disconnect requested");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_websocket_url_validation() {
        let manager = WebSocketManager::new(");

        // Test localhost URL (ws:// allowed)
        assert!(manager.connect("http://localhost:4020".to_string()).await.is_ok()");
        assert!(manager.connect("http://127.0.0.1:4020".to_string()).await.is_ok()");

        // Test external URLs (only wss:// allowed)
        assert!(manager.connect("http://example.com".to_string()).await.is_err()");
        assert!(manager.connect("ws://example.com".to_string()).await.is_err()");
        assert!(manager.connect("https://example.com".to_string()).await.is_ok()");

        // Test invalid URLs
        assert!(manager.connect("not-a-url".to_string()).await.is_err()");
        assert!(manager.connect("javascript:alert(1)".to_string()).await.is_err()");
    }

    #[test]
    fn test_message_sanitization() {
        let manager = WebSocketManager::new(");

        // Test HTML sanitization
        assert!(manager.sanitize_message("<script>alert(1)</script>").is_ok()");
        
        // Test command injection
        assert!(manager.sanitize_message("; rm -rf /").is_err()");
        
        // Test valid messages
        assert!(manager.sanitize_message("Hello, world!").is_ok()");
    }
}
