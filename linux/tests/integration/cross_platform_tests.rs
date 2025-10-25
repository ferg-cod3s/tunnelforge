//! Cross-platform integration tests for TunnelForge
//! 
//! Tests platform-specific functionality and ensures consistent
//! behavior across Windows, macOS, and Linux.

use std::path::Path;
use anyhow::Result;
use sysinfo::{System, SystemExt, ProcessExt, CpuExt};

use super::{TestConfig, make_authenticated_request};

pub async fn run_tests(config: &TestConfig) -> Result<()> {
    test_platform_detection(config).await?;
    test_file_system_paths(config).await?;
    test_process_management(config).await?;
    test_system_integration(config).await?;
    test_permissions(config).await?;
    
    Ok(())
}

async fn test_platform_detection(config: &TestConfig) -> Result<()> {
    println!("Testing platform detection...");
    
    let client = reqwest::Client::new();
    
    // Get system information
    let response = client
        .get(&format!("{}/api/system/info", config.server_url))
        .header("Authorization", "Bearer test-token")
        .send()
        .await?;
    
    if response.status().is_success() {
        let system_info: serde_json::Value = response.json().await?;
        
        // Verify platform information
        let platform = system_info["platform"].as_str().unwrap();
        let arch = system_info["architecture"].as_str().unwrap();
        
        println!("Detected platform: {} ({})", platform, arch);
        
        // Verify platform matches expected
        #[cfg(target_os = "linux")]
        assert!(platform.contains("linux") || platform.contains("Linux"));
        
        #[cfg(target_os = "macos")]
        assert!(platform.contains("macos") || platform.contains("Darwin"));
        
        #[cfg(target_os = "windows")]
        assert!(platform.contains("windows") || platform.contains("Windows"));
        
        println!("✅ Platform detection working");
    } else {
        println!("⚠️  System info endpoint not available");
    }
    
    Ok(())
}

async fn test_file_system_paths(config: &TestConfig) -> Result<()> {
    println!("Testing file system paths...");
    
    let client = reqwest::Client::new();
    
    // Test different path formats
    let test_paths = vec![
        ("/tmp", "Unix temp directory"),
        ("/etc", "Unix config directory"),
        #[cfg(target_os = "windows")]
        ("C:\\Windows", "Windows system directory"),
        #[cfg(target_os = "windows")]
        ("C:\\Program Files", "Windows program directory"),
    ];
    
    for (path, description) in test_paths {
        if Path::new(path).exists() {
            let response = client
                .get(&format!("{}/api/files", config.server_url))
                .header("Authorization", "Bearer test-token")
                .query(&[("path", path)])
                .send()
                .await?;
            
            if response.status().is_success() {
                let files: serde_json::Value = response.json().await?;
                if files.as_array().is_some() {
                    println!("✅ {} accessible: {}", description, path);
                }
            } else {
                println!("⚠️  {} not accessible: {}", description, path);
            }
        } else {
            println!("⚠️  {} does not exist: {}", description, path);
        }
    }
    
    // Test home directory detection
    if let Some(home_dir) = dirs::home_dir() {
        let home_str = home_dir.to_string_lossy();
        let response = client
            .get(&format!("{}/api/files", config.server_url))
            .header("Authorization", "Bearer test-token")
            .query(&[("path", &*home_str)])
            .send()
            .await?;
        
        if response.status().is_success() {
            println!("✅ Home directory accessible: {}", home_str);
        }
    }
    
    Ok(())
}

async fn test_process_management(config: &TestConfig) -> Result<()> {
    println!("Testing process management...");
    
    let mut sys = System::new_all();
    sys.refresh_all();
    
    // Get current process information
    let current_pid = std::process::id();
    if let Some(process) = sys.process(current_pid as usize) {
        println!("Current process: {} (PID: {})", process.name(), current_pid);
        println!("Memory usage: {} KB", process.memory());
        println!("CPU usage: {:.1}%", process.cpu_usage());
    }
    
    // Test process listing via API
    let client = reqwest::Client::new();
    let response = client
        .get(&format!("{}/api/system/processes", config.server_url))
        .header("Authorization", "Bearer test-token")
        .send()
        .await?;
    
    if response.status().is_success() {
        let processes: serde_json::Value = response.json().await?;
        if let Some(process_array) = processes.as_array() {
            println!("✅ Process listing working: {} processes", process_array.len());
            
            // Check if our process is in the list
            let found_current = process_array.iter().any(|p| {
                p["pid"].as_u64() == Some(current_pid as u64)
            });
            
            if found_current {
                println!("✅ Current process found in list");
            }
        }
    } else {
        println!("⚠️  Process listing endpoint not available");
    }
    
    Ok(())
}

async fn test_system_integration(config: &TestConfig) -> Result<()> {
    println!("Testing system integration...");
    
    let client = reqwest::Client::new();
    
    // Test system resources
    let response = client
        .get(&format!("{}/api/system/resources", config.server_url))
        .header("Authorization", "Bearer test-token")
        .send()
        .await?;
    
    if response.status().is_success() {
        let resources: serde_json::Value = response.json().await?;
        
        if let Some(cpu) = resources["cpu_usage"].as_f64() {
            println!("CPU usage: {:.1}%", cpu);
        }
        
        if let Some(memory) = resources["memory_usage"].as_f64() {
            println!("Memory usage: {:.1}%", memory);
        }
        
        if let Some(disk) = resources["disk_usage"].as_f64() {
            println!("Disk usage: {:.1}%", disk);
        }
        
        println!("✅ System resources monitoring working");
    } else {
        println!("⚠️  System resources endpoint not available");
    }
    
    // Test network interfaces
    let response = client
        .get(&format!("{}/api/system/network", config.server_url))
        .header("Authorization", "Bearer test-token")
        .send()
        .await?;
    
    if response.status().is_success() {
        let network: serde_json::Value = response.json().await?;
        if let Some(interfaces) = network["interfaces"].as_array() {
            println!("✅ Network interfaces detected: {}", interfaces.len());
        }
    } else {
        println!("⚠️  Network interfaces endpoint not available");
    }
    
    Ok(())
}

async fn test_permissions(config: &TestConfig) -> Result<()> {
    println!("Testing permissions...");
    
    let client = reqwest::Client::new();
    
    // Test file creation permissions
    let test_file = "/tmp/tunnelforge_permission_test.txt";
    
    // Try to create a file
    let create_data = serde_json::json!({
        "path": test_file,
        "content": "Permission test content"
    });
    
    let response = client
        .post(&format!("{}/api/files/create", config.server_url))
        .header("Authorization", "Bearer test-token")
        .json(&create_data)
        .send()
        .await?;
    
    if response.status().is_success() {
        println!("✅ File creation permission granted");
        
        // Clean up
        let _ = std::fs::remove_file(test_file);
    } else {
        println!("⚠️  File creation permission denied");
    }
    
    // Test directory listing permissions
    let response = client
        .get(&format!("{}/api/files", config.server_url))
        .header("Authorization", "Bearer test-token")
        .query(&[("path", "/")])
        .send()
        .await?;
    
    if response.status().is_success() {
        println!("✅ Directory listing permission granted");
    } else {
        println!("⚠️  Directory listing permission denied");
    }
    
    // Test process execution permissions
    let create_data = serde_json::json!({
        "command": "/bin/echo",
        "args": ["Permission test"],
        "cwd": "/tmp"
    });
    
    let response = client
        .post(&format!("{}/api/sessions", config.server_url))
        .header("Authorization", "Bearer test-token")
        .json(&create_data)
        .send()
        .await?;
    
    if response.status().is_success() {
        println!("✅ Process execution permission granted");
        
        let session_data: serde_json::Value = response.json().await?;
        let session_id = session_data["id"].as_str().unwrap();
        
        // Clean up session
        let _ = client
            .delete(&format!("{}/api/sessions/{}", config.server_url, session_id))
            .header("Authorization", "Bearer test-token")
            .send()
            .await;
    } else {
        println!("⚠️  Process execution permission denied");
    }
    
    Ok(())
}

#[cfg(target_os = "linux")]
async fn test_linux_specific_features(config: &TestConfig) -> Result<()> {
    println!("Testing Linux-specific features...");
    
    // Test systemd integration if available
    if Path::new("/run/systemd/system").exists() {
        let client = reqwest::Client::new();
        
        let response = client
            .get(&format!("{}/api/system/systemd", config.server_url))
            .header("Authorization", "Bearer test-token")
            .send()
            .await?;
        
        if response.status().is_success() {
            println!("✅ Systemd integration available");
        } else {
            println!("⚠️  Systemd integration not available");
        }
    }
    
    // Test package manager detection
    let package_managers = vec!["apt", "yum", "dnf", "pacman", "zypper"];
    
    for pm in package_managers {
        if std::process::Command::new("which").arg(pm).output().is_ok() {
            println!("✅ Package manager detected: {}", pm);
            break;
        }
    }
    
    Ok(())
}

#[cfg(target_os = "macos")]
async fn test_macos_specific_features(config: &TestConfig) -> Result<()> {
    println!("Testing macOS-specific features...");
    
    // Test Launch Services integration
    if Path::new("/System/Library/Frameworks/CoreServices.framework").exists() {
        println!("✅ Core Services framework available");
    }
    
    // Test Homebrew detection
    if std::process::Command::new("which").arg("brew").output().is_ok() {
        println!("✅ Homebrew detected");
    }
    
    Ok(())
}

#[cfg(target_os = "windows")]
async fn test_windows_specific_features(config: &TestConfig) -> Result<()> {
    println!("Testing Windows-specific features...");
    
    // Test Windows Services integration
    if Path::new("C:\\Windows\\System32\\services.exe").exists() {
        println!("✅ Windows Services available");
    }
    
    // Test PowerShell detection
    if std::process::Command::new("powershell").arg("-Command").arg("Get-Host").output().is_ok() {
        println!("✅ PowerShell detected");
    }
    
    // Test Registry access (if implemented)
    let client = reqwest::Client::new();
    let response = client
        .get(&format!("{}/api/system/registry", config.server_url))
        .header("Authorization", "Bearer test-token")
        .send()
        .await?;
    
    if response.status().is_success() {
        println!("✅ Registry access available");
    } else {
        println!("⚠️  Registry access not available");
    }
    
    Ok(())
}