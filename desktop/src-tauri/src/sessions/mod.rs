// Port of SessionMonitor.swift functionality

pub mod monitor;
pub mod websocket;

pub use monitor::*;
pub use websocket::*;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub last_activity: String,
    pub status: String,
    pub pid: Option<u32>,
    pub command: Option<String>,
    pub working_directory: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionEvent {
    pub session_id: String,
    pub event_type: String,
    pub data: serde_json::Value,
    pub timestamp: String,
}

pub type SessionEventSender = broadcast::Sender<SessionEvent>;
pub type SessionEventReceiver = broadcast::Receiver<SessionEvent>;

pub struct SessionManager {
    sessions: Arc<Mutex<HashMap<String, Session>>>,
    event_sender: SessionEventSender,
    server_url: String,
}

impl SessionManager {
    pub fn new(server_url: String) -> Self {
        let (event_sender, _) = broadcast::channel(100);

        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            event_sender,
            server_url,
        }
    }

    pub async fn fetch_sessions(&self) -> Result<Vec<Session>, String> {
        let client = reqwest::Client::new();
        let url = format!("{}/api/sessions", self.server_url);

        match client.get(&url).send().await {
            Ok(response) => {
                if response.status().is_success() {
                    let sessions: Vec<Session> = response.json().await
                        .map_err(|e| format!("Failed to parse sessions: {}", e))?;

                    // Update local cache
                    {
                        let mut local_sessions = self.sessions.lock().unwrap();
                        local_sessions.clear();
                        for session in &sessions {
                            local_sessions.insert(session.id.clone(), session.clone());
                        }
                    }

                    Ok(sessions)
                } else {
                    Err(format!("Failed to fetch sessions: HTTP {}", response.status()))
                }
            }
            Err(e) => Err(format!("Failed to request sessions: {}", e))
        }
    }

    pub async fn create_session(&self, title: Option<String>, command: Option<String>) -> Result<Session, String> {
        let client = reqwest::Client::new();
        let url = format!("{}/api/sessions", self.server_url);

        let mut body = serde_json::Map::new();
        if let Some(title) = title {
            body.insert("title".to_string(), serde_json::Value::String(title));
        }
        if let Some(command) = command {
            body.insert("command".to_string(), serde_json::Value::String(command));
        }

        match client.post(&url).json(&body).send().await {
            Ok(response) => {
                if response.status().is_success() {
                    let session: Session = response.json().await
                        .map_err(|e| format!("Failed to parse created session: {}", e))?;

                    // Update local cache
                    {
                        let mut local_sessions = self.sessions.lock().unwrap();
                        local_sessions.insert(session.id.clone(), session.clone());
                    }

                    // Emit event
                    let event = SessionEvent {
                        session_id: session.id.clone(),
                        event_type: "created".to_string(),
                        data: serde_json::to_value(&session).unwrap(),
                        timestamp: chrono::Utc::now().to_rfc3339(),
                    };
                    let _ = self.event_sender.send(event);

                    Ok(session)
                } else {
                    Err(format!("Failed to create session: HTTP {}", response.status()))
                }
            }
            Err(e) => Err(format!("Failed to create session: {}", e))
        }
    }

    pub async fn delete_session(&self, session_id: &str) -> Result<(), String> {
        let client = reqwest::Client::new();
        let url = format!("{}/api/sessions/{}", self.server_url, session_id);

        match client.delete(&url).send().await {
            Ok(response) => {
                if response.status().is_success() {
                    // Remove from local cache
                    {
                        let mut local_sessions = self.sessions.lock().unwrap();
                        local_sessions.remove(session_id);
                    }

                    // Emit event
                    let event = SessionEvent {
                        session_id: session_id.to_string(),
                        event_type: "deleted".to_string(),
                        data: serde_json::Value::Null,
                        timestamp: chrono::Utc::now().to_rfc3339(),
                    };
                    let _ = self.event_sender.send(event);

                    Ok(())
                } else {
                    Err(format!("Failed to delete session: HTTP {}", response.status()))
                }
            }
            Err(e) => Err(format!("Failed to delete session: {}", e))
        }
    }

    pub async fn get_session_details(&self, session_id: &str) -> Result<Session, String> {
        // First check local cache
        {
            let sessions = self.sessions.lock().unwrap();
            if let Some(session) = sessions.get(session_id) {
                return Ok(session.clone());
            }
        }

        // If not in cache, fetch from server
        let client = reqwest::Client::new();
        let url = format!("{}/api/sessions/{}", self.server_url, session_id);

        match client.get(&url).send().await {
            Ok(response) => {
                if response.status().is_success() {
                    let session: Session = response.json().await
                        .map_err(|e| format!("Failed to parse session details: {}", e))?;

                    // Update local cache
                    {
                        let mut local_sessions = self.sessions.lock().unwrap();
                        local_sessions.insert(session.id.clone(), session.clone());
                    }

                    Ok(session)
                } else {
                    Err(format!("Failed to get session details: HTTP {}", response.status()))
                }
            }
            Err(e) => Err(format!("Failed to request session details: {}", e))
        }
    }

    pub fn get_local_sessions(&self) -> Vec<Session> {
        let sessions = self.sessions.lock().unwrap();
        sessions.values().cloned().collect()
    }

    pub fn subscribe_to_events(&self) -> SessionEventReceiver {
        self.event_sender.subscribe()
    }
}

// Tauri commands for session management
#[tauri::command]
pub async fn get_sessions(server_url: String) -> Result<Vec<Session>, String> {
    let session_manager = SessionManager::new(server_url);
    session_manager.fetch_sessions().await
}

#[tauri::command]
pub async fn create_session(
    server_url: String,
    title: Option<String>,
    command: Option<String>
) -> Result<Session, String> {
    let session_manager = SessionManager::new(server_url);
    session_manager.create_session(title, command).await
}

#[tauri::command]
pub async fn delete_session(server_url: String, session_id: String) -> Result<(), String> {
    let session_manager = SessionManager::new(server_url);
    session_manager.delete_session(&session_id).await
}

#[tauri::command]
pub async fn get_session_details(server_url: String, session_id: String) -> Result<Session, String> {
    let session_manager = SessionManager::new(server_url);
    session_manager.get_session_details(&session_id).await
}
