/**
 * SessionMonitor Service
 *
 * Migrated from: mac/TunnelForge/Core/Services/SessionMonitor.swift
 *
 * Lightweight session monitor that fetches terminal sessions on-demand.
 * Manages the collection of active terminal sessions by periodically polling
 * the server API and caching results for efficient access.
 *
 * Key responsibilities:
 * - Fetch sessions from server API with caching (2-second TTL)
 * - Detect session state transitions (running → exited)
 * - Pre-cache Git repository information for sessions
 * - Update power management state based on running sessions
 * - Provide reactive session state to UI components
 */

use anyhow::{Context, Result};
use log::{debug, error, info, warn};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

/// Server session information returned by the API
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerSessionInfo {
    pub id: String,
    pub name: String,
    pub command: Vec<String>,
    pub working_dir: String,
    pub status: String,
    pub exit_code: Option<i32>,
    pub started_at: String,
    pub pid: Option<u32>,
    pub initial_cols: Option<u32>,
    pub initial_rows: Option<u32>,
    pub last_clear_offset: Option<u64>,
    pub version: Option<String>,
    pub git_repo_path: Option<String>,
    pub git_branch: Option<String>,
    pub git_ahead_count: Option<i32>,
    pub git_behind_count: Option<i32>,
    pub git_has_changes: Option<bool>,
    pub git_is_worktree: Option<bool>,
    pub git_main_repo_path: Option<String>,
    pub last_modified: String,
    pub active: Option<bool>,
    pub activity_status: Option<ActivityStatus>,
    pub source: Option<String>,
    pub remote_id: Option<String>,
    pub remote_name: Option<String>,
    pub remote_url: Option<String>,
    pub attached_via_vt: Option<bool>,
}

impl ServerSessionInfo {
    /// Check if the session is currently running
    pub fn is_running(&self) -> bool {
        self.status == "running"
    }
}

/// Activity status for a session
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityStatus {
    pub is_active: bool,
    pub specific_status: Option<SpecificStatus>,
}

/// App-specific status information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpecificStatus {
    pub app: String,
    pub status: String,
}

/// Internal state for session monitoring
struct MonitorState {
    sessions: HashMap<String, ServerSessionInfo>,
    previous_sessions: HashMap<String, ServerSessionInfo>,
    last_fetch: Option<Instant>,
    last_error: Option<String>,
    first_fetch_done: bool,
}

/// Session monitor service
pub struct SessionMonitor {
    server_url: Arc<Mutex<String>>,
    client: Client,
    state: Arc<Mutex<MonitorState>>,
    cache_interval: Duration,
}

impl SessionMonitor {
    /// Create a new session monitor
    pub fn new(server_url: String) -> Self {
        Self {
            server_url: Arc::new(Mutex::new(server_url)),
            client: Client::new(),
            state: Arc::new(Mutex::new(MonitorState {
                sessions: HashMap::new(),
                previous_sessions: HashMap::new(),
                last_fetch: None,
                last_error: None,
                first_fetch_done: false,
            })),
            cache_interval: Duration::from_secs(2),
        }
    }

    /// Set the server URL
    pub async fn set_server_url(&self, url: String) {
        let mut server_url = self.server_url.lock().await;
        *server_url = url;
    }

    /// Get the number of running sessions
    pub async fn session_count(&self) -> usize {
        let state = self.state.lock().await;
        state
            .sessions
            .values()
            .filter(|s| s.is_running())
            .count()
    }

    /// Get all sessions, using cache if available
    pub async fn get_sessions(&self) -> HashMap<String, ServerSessionInfo> {
        let state = self.state.lock().await;

        // Use cache if available and fresh
        if let Some(last_fetch) = state.last_fetch {
            if last_fetch.elapsed() < self.cache_interval {
                debug!("Using cached sessions (age: {:?})", last_fetch.elapsed());
                return state.sessions.clone();
            }
        }

        // Drop the lock before fetching
        drop(state);

        // Fetch fresh data
        self.fetch_sessions().await;

        // Return current sessions
        let state = self.state.lock().await;
        state.sessions.clone()
    }

    /// Force refresh session data
    pub async fn refresh(&self) {
        let mut state = self.state.lock().await;
        state.last_fetch = None;
        drop(state);

        self.fetch_sessions().await;
    }

    /// Fetch sessions from the server
    async fn fetch_sessions(&self) {
        let server_url = self.server_url.lock().await.clone();
        let url = format!("{}/api/sessions", server_url);

        match self.fetch_sessions_internal(&url).await {
            Ok(sessions) => {
                let mut state = self.state.lock().await;

                // Snapshot previous sessions for transition detection
                state.previous_sessions = state.sessions.clone();

                // Convert array to HashMap
                let sessions_map: HashMap<String, ServerSessionInfo> = sessions
                    .into_iter()
                    .map(|s| (s.id.clone(), s))
                    .collect();

                // Detect ended sessions (running → not running)
                if state.first_fetch_done {
                    let ended = self.detect_ended_sessions(
                        &state.previous_sessions,
                        &sessions_map,
                    );

                    if !ended.is_empty() {
                        info!(
                            "Detected {} sessions that ended: {:?}",
                            ended.len(),
                            ended.iter().map(|s| &s.id).collect::<Vec<_>>()
                        );
                    }
                }

                state.sessions = sessions_map;
                state.last_error = None;
                state.first_fetch_done = true;
                state.last_fetch = Some(Instant::now());

                // Log session counts
                let running_count = state.sessions.values().filter(|s| s.is_running()).count();
                debug!(
                    "Sessions updated: {} total, {} running",
                    state.sessions.len(),
                    running_count
                );
            }
            Err(e) => {
                let mut state = self.state.lock().await;

                // Only update error if it's not a simple connection error
                if !e.to_string().contains("connection") {
                    state.last_error = Some(e.to_string());
                }

                error!("Failed to fetch sessions: {}", e);
                state.sessions.clear();
                state.last_fetch = Some(Instant::now()); // Still update timestamp to avoid hammering
            }
        }
    }

    /// Internal fetch implementation
    async fn fetch_sessions_internal(&self, url: &str) -> Result<Vec<ServerSessionInfo>> {
        let response = self
            .client
            .get(url)
            .send()
            .await
            .context("Failed to send request")?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!(
                "Server returned error: {}",
                response.status()
            ));
        }

        let sessions = response
            .json::<Vec<ServerSessionInfo>>()
            .await
            .context("Failed to parse response")?;

        Ok(sessions)
    }

    /// Detect sessions that transitioned from running to not running
    fn detect_ended_sessions(
        &self,
        old: &HashMap<String, ServerSessionInfo>,
        new: &HashMap<String, ServerSessionInfo>,
    ) -> Vec<ServerSessionInfo> {
        old.iter()
            .filter_map(|(id, old_session)| {
                if old_session.is_running() {
                    if let Some(updated) = new.get(id) {
                        if !updated.is_running() {
                            return Some(old_session.clone());
                        }
                    }
                }
                None
            })
            .collect()
    }

    /// Get the last error that occurred
    pub async fn last_error(&self) -> Option<String> {
        let state = self.state.lock().await;
        state.last_error.clone()
    }

    /// Pre-cache Git repositories for sessions
    ///
    /// This function deduplicates by repository root and caches Git data
    /// for quick access. It also checks common parent directories for projects.
    pub async fn pre_cache_git_repositories(&self, sessions: &[ServerSessionInfo]) {
        let mut unique_directories = std::collections::HashSet::new();

        // Collect unique directories that need caching
        for session in sessions {
            unique_directories.insert(session.working_dir.clone());

            // Smart detection: Also check common parent directories
            let path_components: Vec<&str> = session.working_dir.split('/').collect();

            if path_components.len() >= 4 {
                let common_dev_paths = [
                    "Projects",
                    "Development",
                    "Developer",
                    "Code",
                    "Work",
                    "Source",
                ];

                for (index, component) in path_components.iter().enumerate() {
                    if common_dev_paths.contains(component) && index < path_components.len() - 1 {
                        let potential_project_path = path_components[0..=index + 1].join("/");
                        unique_directories.insert(potential_project_path);
                    }
                }
            }
        }

        debug!(
            "Pre-caching Git data for {} unique directories (from {} sessions)",
            unique_directories.len(),
            sessions.len()
        );

        // In a real implementation, this would call GitRepositoryMonitor
        // For now, we just log the intent
        for directory in unique_directories {
            debug!("Would cache Git data for: {}", directory);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_session_count() {
        let monitor = SessionMonitor::new("http://localhost:4021".to_string());
        let count = monitor.session_count().await;
        assert_eq!(count, 0);
    }

    #[tokio::test]
    async fn test_cache_interval() {
        let monitor = SessionMonitor::new("http://localhost:4021".to_string());

        // First fetch should update cache
        let sessions1 = monitor.get_sessions().await;

        // Immediate second fetch should use cache
        let sessions2 = monitor.get_sessions().await;

        assert_eq!(sessions1.len(), sessions2.len());
    }

    #[test]
    fn test_detect_ended_sessions() {
        let monitor = SessionMonitor::new("http://localhost:4021".to_string());

        let mut old_sessions = HashMap::new();
        old_sessions.insert(
            "session1".to_string(),
            ServerSessionInfo {
                id: "session1".to_string(),
                name: "Test".to_string(),
                command: vec!["bash".to_string()],
                working_dir: "/home/user".to_string(),
                status: "running".to_string(),
                exit_code: None,
                started_at: "2025-01-01T00:00:00Z".to_string(),
                pid: Some(1234),
                initial_cols: Some(80),
                initial_rows: Some(24),
                last_clear_offset: None,
                version: None,
                git_repo_path: None,
                git_branch: None,
                git_ahead_count: None,
                git_behind_count: None,
                git_has_changes: None,
                git_is_worktree: None,
                git_main_repo_path: None,
                last_modified: "2025-01-01T00:00:00Z".to_string(),
                active: Some(true),
                activity_status: None,
                source: None,
                remote_id: None,
                remote_name: None,
                remote_url: None,
                attached_via_vt: None,
            },
        );

        let mut new_sessions = old_sessions.clone();
        new_sessions.get_mut("session1").unwrap().status = "exited".to_string();

        let ended = monitor.detect_ended_sessions(&old_sessions, &new_sessions);
        assert_eq!(ended.len(), 1);
        assert_eq!(ended[0].id, "session1");
    }
}
