/**
 * Services Module
 *
 * Exports all Tauri services that manage application functionality.
 * These services are migrated from the SwiftUI Mac app and provide
 * cross-platform implementations using Rust.
 */

pub mod server_manager;
pub mod session_service;
pub mod session_monitor;

// Re-export commonly used types
pub use server_manager::{ServerConfig, ServerManager, ServerState};
pub use session_service::{CreateSessionRequest, CreateSessionResponse, SessionService};
pub use session_monitor::{ActivityStatus, ServerSessionInfo, SessionMonitor, SpecificStatus};
