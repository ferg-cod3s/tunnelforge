// Session Service
// Ported from: mac/TunnelForge/Core/Services/SessionService.swift
//
// Manages terminal sessions:
// - Session creation and deletion
// - Session state tracking
// - Communication with Go server API

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use anyhow::{Result, Context};
use serde::{Serialize, Deserialize};
use log::{info, warn, error};
use reqwest::Client;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub title: String,
    pub working_dir: String,
    pub command: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub pid: Option<u32>,
    pub cols: u32,
    pub rows: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSessionRequest {
    pub title: Option<String>,
    pub working_dir: Option<String>,
    pub command: Option<String>,
    pub cols: Option<u32>,
    pub rows: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSessionResponse {
    pub session: Session,
    pub websocket_url: String,
}

pub struct SessionService {
    server_url: Arc<Mutex<String>>,
    sessions: Arc<Mutex<HashMap<String, Session>>>,
    client: Client,
}

impl SessionService {
    pub fn new(server_url: String) -> Self {
        Self {
            server_url: Arc::new(Mutex::new(server_url)),
            sessions: Arc::new(Mutex::new(HashMap::new())),
            client: Client::new(),
        }
    }

    /// Create a new terminal session
    pub async fn create_session(&self, request: CreateSessionRequest) -> Result<CreateSessionResponse> {
        let server_url = self.server_url.lock().unwrap().clone();
        let url = format!("{}/api/sessions", server_url);

        info!("Creating new session: {:?}", request);

        let response = self.client
            .post(&url)
            .json(&request)
            .send()
            .await
            .context("Failed to create session")?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!(
                "Server returned error {}: {}",
                status,
                error_text
            ));
        }

        let create_response: CreateSessionResponse = response
            .json()
            .await
            .context("Failed to parse create session response")?;

        // Store session locally
        let session = create_response.session.clone();
        self.sessions.lock().unwrap().insert(session.id.clone(), session);

        info!("Session created successfully: {}", create_response.session.id);

        Ok(create_response)
    }

    /// Get all sessions from server
    pub async fn list_sessions(&self) -> Result<Vec<Session>> {
        let server_url = self.server_url.lock().unwrap().clone();
        let url = format!("{}/api/sessions", server_url);

        let response = self.client
            .get(&url)
            .send()
            .await
            .context("Failed to list sessions")?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!(
                "Server returned error: {}",
                response.status()
            ));
        }

        let sessions: Vec<Session> = response
            .json()
            .await
            .context("Failed to parse sessions list")?;

        // Update local cache
        let mut local_sessions = self.sessions.lock().unwrap();
        local_sessions.clear();
        for session in &sessions {
            local_sessions.insert(session.id.clone(), session.clone());
        }

        Ok(sessions)
    }

    /// Get a specific session
    pub async fn get_session(&self, session_id: &str) -> Result<Session> {
        let server_url = self.server_url.lock().unwrap().clone();
        let url = format!("{}/api/sessions/{}", server_url, session_id);

        let response = self.client
            .get(&url)
            .send()
            .await
            .context("Failed to get session")?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!(
                "Server returned error: {}",
                response.status()
            ));
        }

        let session: Session = response
            .json()
            .await
            .context("Failed to parse session")?;

        // Update local cache
        self.sessions.lock().unwrap().insert(session.id.clone(), session.clone());

        Ok(session)
    }

    /// Delete a session
    pub async fn delete_session(&self, session_id: &str) -> Result<()> {
        let server_url = self.server_url.lock().unwrap().clone();
        let url = format!("{}/api/sessions/{}", server_url, session_id);

        info!("Deleting session: {}", session_id);

        let response = self.client
            .delete(&url)
            .send()
            .await
            .context("Failed to delete session")?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!(
                "Server returned error {}: {}",
                status,
                error_text
            ));
        }

        // Remove from local cache
        self.sessions.lock().unwrap().remove(session_id);

        info!("Session deleted successfully: {}", session_id);

        Ok(())
    }

    /// Get session from local cache
    pub fn get_cached_session(&self, session_id: &str) -> Option<Session> {
        self.sessions.lock().unwrap().get(session_id).cloned()
    }

    /// Get all cached sessions
    pub fn get_cached_sessions(&self) -> Vec<Session> {
        self.sessions.lock().unwrap().values().cloned().collect()
    }

    /// Update session in cache
    pub fn update_cached_session(&self, session: Session) {
        self.sessions.lock().unwrap().insert(session.id.clone(), session);
    }

    /// Clear local cache
    pub fn clear_cache(&self) {
        self.sessions.lock().unwrap().clear();
    }

    /// Update server URL
    pub fn set_server_url(&self, url: String) {
        *self.server_url.lock().unwrap() = url;
    }
}

impl Clone for SessionService {
    fn clone(&self) -> Self {
        Self {
            server_url: Arc::clone(&self.server_url),
            sessions: Arc::clone(&self.sessions),
            client: self.client.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_service_creation() {
        let service = SessionService::new("http://localhost:4021".to_string());
        assert_eq!(service.get_cached_sessions().len(), 0);
    }

    #[test]
    fn test_cache_operations() {
        let service = SessionService::new("http://localhost:4021".to_string());

        let session = Session {
            id: "test-123".to_string(),
            title: "Test Session".to_string(),
            working_dir: "/home/user".to_string(),
            command: None,
            created_at: chrono::Utc::now(),
            pid: Some(1234),
            cols: 80,
            rows: 24,
        };

        service.update_cached_session(session.clone());

        let cached = service.get_cached_session("test-123");
        assert!(cached.is_some());
        assert_eq!(cached.unwrap().id, "test-123");

        let all_sessions = service.get_cached_sessions();
        assert_eq!(all_sessions.len(), 1);

        service.clear_cache();
        assert_eq!(service.get_cached_sessions().len(), 0);
    }
}
