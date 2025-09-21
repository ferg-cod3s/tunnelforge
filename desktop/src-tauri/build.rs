use std::env;
use std::process::Command;
use std::path::Path;

fn run_post_build_cleanup() {
    let profile = env::var("PROFILE").unwrap_or_else(|_| "debug".to_string());
    let target = env::var("TARGET").ok();
    
    let script_path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("scripts")
        .join("post-build-cleanup.sh");

    if script_path.exists() {
        let mut cmd = Command::new("sh");
        cmd.arg(&script_path)
           .arg(&profile);
        
        if let Some(target_triple) = target {
            cmd.arg(&target_triple);
        }

        match cmd.status() {
            Ok(status) if status.success() => {
                println!("cargo:warning=Post-build cleanup completed successfully");
            }
            Ok(_) => {
                println!("cargo:warning=Post-build cleanup failed, but build artifacts are intact");
            }
            Err(e) => {
                println!("cargo:warning=Failed to run cleanup: {}", e);
            }
        }
    }
}

fn main() {
    tauri_build::build();
}
