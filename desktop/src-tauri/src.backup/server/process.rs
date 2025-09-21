// Process management utilities

use std::process::{Command, Child};
use std::path::Path;
use log::info;

use crate::add_log_entry;

pub struct ProcessManager;

impl ProcessManager {
    pub fn build_go_server(server_dir: &Path) -> Result<(), String> {
        let msg = format!("Building Go server in directory: {:?}", server_dir);
        info!("{}", msg);
        add_log_entry("info", &msg);

        // Check if go.mod exists
        if !server_dir.join("go.mod").exists() {
            let error = "go.mod not found in server directory";
            add_log_entry("error", error);
            return Err(error.to_string());
        }

        // Check if cmd/server/main.go exists
        if !server_dir.join("cmd/server/main.go").exists() {
            let error = "cmd/server/main.go not found in server directory";
            add_log_entry("error", error);
            return Err(error.to_string());
        }

        add_log_entry("debug", "Running: go build -o tunnelforge-server cmd/server/main.go");

        let output = Command::new("go")
            .args(&["build", "-o", "tunnelforge-server", "cmd/server/main.go"])
            .current_dir(server_dir)
            .output()
            .map_err(|e| {
                let error = format!("Failed to run go build: {}", e);
                add_log_entry("error", &error);
                error
            })?;

        if output.status.success() {
            let msg = "Go server built successfully";
            info!("{}", msg);
            add_log_entry("info", msg);
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let error = format!("Go server build failed with exit code: {:?}. Error: {}", output.status.code(), stderr);
            add_log_entry("error", &error);
            Err(error)
        }
    }

    pub fn spawn_server_process(
        server_dir: &Path,
        port: u16,
        host: &str,
    ) -> Result<Child, String> {
        let mut cmd = Command::new("./tunnelforge-server");
        cmd.current_dir(server_dir)
           .env("PORT", port.to_string())
           .env("HOST", host);

        // Platform-specific configuration
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        cmd.spawn()
            .map_err(|e| format!("Failed to spawn server process: {}", e))
    }

    pub fn kill_process(mut child: Child) -> Result<(), String> {
        info!("Killing process with PID: {}", child.id());

        child.kill()
            .map_err(|e| format!("Failed to kill process: {}", e))?;

        // Wait for process to exit
        let _ = child.wait();
        Ok(())
    }

    pub fn check_process_alive(child: &mut Child) -> bool {
        match child.try_wait() {
            Ok(Some(_)) => false,  // Process has exited
            Ok(None) => true,      // Process is still running
            Err(_) => false,       // Error checking status, assume dead
        }
    }
}