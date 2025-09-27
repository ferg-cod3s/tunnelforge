use std::time::{Duration, Instant};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use log::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartupMetrics {
    pub total_startup_time_ms: u64,
    pub server_start_time_ms: u64,
    pub ui_init_time_ms: u64,
    pub health_check_time_ms: u64,
    pub server_ready_time_ms: u64,
}

pub struct StartupTimer {
    start_time: Instant,
    server_start: Arc<AtomicU64>,
    ui_init: Arc<AtomicU64>,
    health_check: Arc<AtomicU64>,
    server_ready: Arc<AtomicU64>,
}

impl StartupTimer {
    pub fn new() -> Self {
        Self {
            start_time: Instant::now(),
            server_start: Arc::new(AtomicU64::new(0)),
            ui_init: Arc::new(AtomicU64::new(0)),
            health_check: Arc::new(AtomicU64::new(0)),
            server_ready: Arc::new(AtomicU64::new(0)),
        }
    }

    pub fn record_server_start(&self) {
        let elapsed = self.start_time.elapsed().as_millis() as u64;
        self.server_start.store(elapsed, Ordering::SeqCst);
        info!("Server start time: {}ms", elapsed);
    }

    pub fn record_ui_init(&self) {
        let elapsed = self.start_time.elapsed().as_millis() as u64;
        self.ui_init.store(elapsed, Ordering::SeqCst);
        info!("UI initialization time: {}ms", elapsed);
    }

    pub fn record_health_check(&self) {
        let elapsed = self.start_time.elapsed().as_millis() as u64;
        self.health_check.store(elapsed, Ordering::SeqCst);
        info!("Health check time: {}ms", elapsed);
    }

    pub fn record_server_ready(&self) {
        let elapsed = self.start_time.elapsed().as_millis() as u64;
        self.server_ready.store(elapsed, Ordering::SeqCst);
        info!("Server ready time: {}ms", elapsed);
    }

    pub fn get_metrics(&self) -> StartupMetrics {
        let total = self.start_time.elapsed().as_millis() as u64;
        StartupMetrics {
            total_startup_time_ms: total,
            server_start_time_ms: self.server_start.load(Ordering::SeqCst),
            ui_init_time_ms: self.ui_init.load(Ordering::SeqCst),
            health_check_time_ms: self.health_check.load(Ordering::SeqCst),
            server_ready_time_ms: self.server_ready.load(Ordering::SeqCst),
        }
    }
}

#[derive(Debug, Default)]
pub struct ServerDirectoryCache {
    path: Option<std::path::PathBuf>,
}

impl ServerDirectoryCache {
    pub fn new() -> Self {
        Self { path: None }
    }

    pub fn set_path(&mut self, path: std::path::PathBuf) {
        self.path = Some(path);
    }

    pub fn get_path(&self) -> Option<&std::path::PathBuf> {
        self.path.as_ref()
    }
}
