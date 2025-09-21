// Session monitoring functionality
// Port of SessionMonitor.swift

use super::{Session, SessionEvent, SessionEventSender};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use tokio::time::{interval, Duration};
use log::{info, error, debug};

use crate::add_log_entry;

pub struct SessionMonitor {
    sessions: Arc<Mutex<HashMap<String, Session>>>,
    event_sender: SessionEventSender,
    server_url: String,
    monitoring: Arc<Mutex<bool>>,
}

impl SessionMonitor {
    pub fn new(server_url: String, event_sender: SessionEventSender) -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            event_sender,
            server_url,
            monitoring: Arc::new(Mutex::new(false)),
        }
    }

    pub async fn start_monitoring(&self) -> Result<(), String> {
        {
            let mut monitoring = self.monitoring.lock().unwrap();
            if *monitoring {
                return Err("Session monitoring is already running".to_string());
            }
            *monitoring = true;
        }

        add_log_entry("info", "Starting session monitoring");
        info!("Starting session monitoring");

        let sessions = Arc::clone(&self.sessions);
        let event_sender = self.event_sender.clone();
        let server_url = self.server_url.clone();
        let monitoring = Arc::clone(&self.monitoring);

        tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(5)); // Check every 5 seconds

            loop {
                // Check if monitoring should continue
                {
                    let monitoring_flag = monitoring.lock().unwrap();
                    if !*monitoring_flag {
                        break;
                    }
                }

                interval.tick().await;

                // Fetch current sessions from server
                match Self::fetch_sessions_from_server(&server_url).await {
                    Ok(current_sessions) => {
                        let mut local_sessions = sessions.lock().unwrap();

                        // Compare with previous state and emit events
                        for session in &current_sessions {
                            match local_sessions.get(&session.id) {
                                Some(existing) => {
                                    // Check for updates
                                    if existing.status != session.status ||
                                       existing.last_activity != session.last_activity {
                                        let event = SessionEvent {
                                            session_id: session.id.clone(),
                                            event_type: "updated".to_string(),
                                            data: serde_json::to_value(session).unwrap(),
                                            timestamp: chrono::Utc::now().to_rfc3339(),
                                        };
                                        let _ = event_sender.send(event);
                                        debug!("Session {} updated", session.id);
                                    }
                                }
                                None => {
                                    // New session
                                    let event = SessionEvent {
                                        session_id: session.id.clone(),
                                        event_type: "created".to_string(),
                                        data: serde_json::to_value(session).unwrap(),
                                        timestamp: chrono::Utc::now().to_rfc3339(),
                                    };
                                    let _ = event_sender.send(event);
                                    debug!("New session detected: {}", session.id);
                                }
                            }
                        }

                        // Check for deleted sessions
                        let current_ids: std::collections::HashSet<_> =
                            current_sessions.iter().map(|s| &s.id).collect();

                        for (session_id, _) in local_sessions.iter() {
                            if !current_ids.contains(session_id) {
                                let event = SessionEvent {
                                    session_id: session_id.clone(),
                                    event_type: "deleted".to_string(),
                                    data: serde_json::Value::Null,
                                    timestamp: chrono::Utc::now().to_rfc3339(),
                                };
                                let _ = event_sender.send(event);
                                debug!("Session deleted: {}", session_id);
                            }
                        }

                        // Update local cache
                        local_sessions.clear();
                        for session in current_sessions {
                            local_sessions.insert(session.id.clone(), session);
                        }
                    }
                    Err(e) => {
                        error!("Failed to fetch sessions during monitoring: {}", e);
                        add_log_entry("error", &format!("Session monitoring error: {}", e));
                    }
                }
            }

            add_log_entry("info", "Session monitoring stopped");
            info!("Session monitoring stopped");
        });

        Ok(())
    }

    pub fn stop_monitoring(&self) {
        let mut monitoring = self.monitoring.lock().unwrap();
        *monitoring = false;
        add_log_entry("info", "Stopping session monitoring");
        info!("Stopping session monitoring");
    }

    pub fn is_monitoring(&self) -> bool {
        let monitoring = self.monitoring.lock().unwrap();
        *monitoring
    }

    async fn fetch_sessions_from_server(server_url: &str) -> Result<Vec<Session>, String> {
        let client = reqwest::Client::new();
        let url = format!("{}/api/sessions", server_url);

        match client.get(&url).send().await {
            Ok(response) => {
                if response.status().is_success() {
                    response.json().await
                        .map_err(|e| format!("Failed to parse sessions: {}", e))
                } else {
                    Err(format!("HTTP error: {}", response.status()))
                }
            }
            Err(e) => Err(format!("Request failed: {}", e))
        }
    }

    pub fn get_cached_sessions(&self) -> Vec<Session> {
        let sessions = self.sessions.lock().unwrap();
        sessions.values().cloned().collect()
    }
}

// Tauri commands for session monitoring
#[tauri::command]
pub async fn start_session_monitoring(server_url: String) -> Result<(), String> {
    // This would need to be stored in app state in a real implementation
    // For now, we'll create a temporary monitor
    let (event_sender, _) = tokio::sync::broadcast::channel(100);
    let monitor = SessionMonitor::new(server_url, event_sender);
    monitor.start_monitoring().await
}

#[tauri::command]
pub async fn stop_session_monitoring() -> Result<(), String> {
    // This would need to access the monitor from app state
    // Implementation depends on how the monitor is stored in app state
    Ok(())
}

#[tauri::command]
pub async fn is_session_monitoring_active() -> Result<bool, String> {
    // This would need to access the monitor from app state
    // For now, return false
    Ok(false)
}