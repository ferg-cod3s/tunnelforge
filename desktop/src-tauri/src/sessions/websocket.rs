// WebSocket functionality for real-time session updates

use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;
use futures_util::StreamExt;

use tokio::sync::{broadcast, Mutex};
use std::sync::Arc;
use log::{info, error};

use crate::add_log_entry;

pub struct WebSocketManager {
    connected: Arc<Mutex<bool>>,
    event_sender: broadcast::Sender<String>,
}

impl WebSocketManager {
    pub fn new() -> Self {
        let (event_sender, _) = broadcast::channel(100);

        Self {
            connected: Arc::new(Mutex::new(false)),
            event_sender,
        }
    }

    pub async fn connect(&self, server_url: String) -> Result<(), String> {
        let ws_url = format!("ws://{}/ws", server_url.trim_end_matches('/'));

        add_log_entry("info", &format!("Connecting to WebSocket: {}", ws_url));
        info!("Connecting to WebSocket: {}", ws_url);

        match connect_async(&ws_url).await {
            Ok((ws_stream, _)) => {
                let (_write, mut read) = ws_stream.split();

                {
                    let mut connected = self.connected.lock().await;
                    *connected = true;
                }

                add_log_entry("info", "WebSocket connected successfully");
                info!("WebSocket connected successfully");

                // Listen for messages
                while let Some(message) = read.next().await {
                    match message {
                        Ok(msg) => {
                            if let Message::Text(text) = msg {
                                add_log_entry("debug", &format!("Received WebSocket message: {}", text));
                                // Forward message to subscribers
                                let _ = self.event_sender.send(text);
                            }
                        }
                        Err(e) => {
                            add_log_entry("error", &format!("WebSocket error: {}", e));
                            error!("WebSocket error: {}", e);
                            break;
                        }
                    }
                }

                {
                    let mut connected = self.connected.lock().await;
                    *connected = false;
                }

                add_log_entry("info", "WebSocket disconnected");
                info!("WebSocket disconnected");
            }
            Err(e) => {
                add_log_entry("error", &format!("Failed to connect to WebSocket: {}", e));
                return Err(format!("Failed to connect to WebSocket: {}", e));
            }
        }

        Ok(())
    }

    pub fn is_connected(&self) -> bool {
        // This would need to be async in a real implementation
        // For now, return false as a placeholder
        false
    }

    pub fn subscribe(&self) -> broadcast::Receiver<String> {
        self.event_sender.subscribe()
    }
}

// Tauri commands for WebSocket management
#[tauri::command]
pub async fn connect_websocket(server_url: String) -> Result<(), String> {
    let ws_manager = WebSocketManager::new();
    ws_manager.connect(server_url).await
}

#[tauri::command]
pub async fn disconnect_websocket() -> Result<(), String> {
    // In a real implementation, this would disconnect the WebSocket
    add_log_entry("info", "WebSocket disconnect requested");
    Ok(())
}
