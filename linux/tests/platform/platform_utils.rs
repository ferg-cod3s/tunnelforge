//! Common platform utilities for testing
//! 
//! Provides shared functionality for platform-specific tests
//! including process management, file operations, and system detection.

use std::process::Command;
use std::path::Path;
use anyhow::Result;
use sysinfo::{System, SystemExt, ProcessExt};

pub async fn run_common_tests() -> Result<()> {
    println!("Running common platform tests...");
    
    test_basic_functionality().await?;
    test_process_capabilities().await?;
    test_network_connectivity().await?;
    test_system_resources().await?;
    
    Ok(())
}

async fn test_basic_functionality() -> Result<()> {
    println!("Testing basic functionality...");
    
    // Test basic command execution
    if let Ok(output) = Command::new("echo").arg("test").output() {
        if output.status.success() {
            println!("✅ Basic command execution working");
        }
    }
    
    // Test file operations
    let test_file = "/tmp/tunnelforge_test.txt";
    if std::fs::write(test_file, "test content").is_ok() {
        println!("✅ File writing working");
        
        if std::fs::read_to_string(test_file).is_ok() {
            println!("✅ File reading working");
        }
        
        let _ = std::fs::remove_file(test_file);
    }
    
    // Test directory operations
    let test_dir = "/tmp/tunnelforge_test_dir";
    if std::fs::create_dir(test_dir).is_ok() {
        println!("✅ Directory creation working");
        
        if std::fs::remove_dir(test_dir).is_ok() {
            println!("✅ Directory removal working");
        }
    }
    
    Ok(())
}

async fn test_process_capabilities() -> Result<()> {
    println!("Testing process capabilities...");
    
    let mut sys = System::new_all();
    sys.refresh_all();
    
    // Get current process info
    let current_pid = std::process::id() as usize;
    if let Some(process) = sys.process(current_pid) {
        println!("Current process: {} (PID: {})", process.name(), current_pid);
        println!("Memory usage: {} KB", process.memory());
        println!("CPU usage: {:.1}%", process.cpu_usage());
        
        // Test process listing
        let total_processes = sys.processes().len();
        println!("Total processes detected: {}", total_processes);
        
        if total_processes > 0 {
            println!("✅ Process enumeration working");
        }
    }
    
    // Test process creation
    if let Ok(mut child) = Command::new("sleep").arg("1").spawn() {
        if child.wait().is_ok() {
            println!("✅ Process creation working");
        }
    }
    
    Ok(())
}

async fn test_network_connectivity() -> Result<()> {
    println!("Testing network connectivity...");
    
    // Test localhost connectivity
    if let Ok(_) = std::net::TcpStream::connect("127.0.0.1:22") {
        println!("✅ Local network connectivity working");
    }
    
    // Test DNS resolution
    if let Ok(_) = std::net::ToSocketAddrs::new().lookup("localhost".to_string()) {
        println!("✅ DNS resolution working");
    }
    
    // Test network interface detection
    if Path::new("/proc/net/dev").exists() {
        let interfaces = std::fs::read_to_string("/proc/net/dev")?;
        let interface_count = interfaces.lines().count() - 2; // Skip header lines
        println!("✅ Network interfaces detected: {}", interface_count);
    }
    
    Ok(())
}

async fn test_system_resources() -> Result<()> {
    println!("Testing system resources...");
    
    let mut sys = System::new_all();
    sys.refresh_all();
    
    // Test memory info
    let total_memory = sys.total_memory();
    let used_memory = sys.used_memory();
    println!("Memory: {} KB used / {} KB total", used_memory, total_memory);
    
    if total_memory > 0 {
        println!("✅ Memory detection working");
    }
    
    // Test CPU info
    let cpu_count = sys.cpus().len();
    println!("CPU cores: {}", cpu_count);
    
    if cpu_count > 0 {
        println!("✅ CPU detection working");
    }
    
    // Test disk info
    if let Ok(disks) = sys.disks() {
        println!("Disks detected: {}", disks.len());
        for disk in disks {
            println!("  {}: {} / {} ({:.1}%)", 
                disk.mount_point().display(),
                format_bytes(disk.available_space()),
                format_bytes(disk.total_space()),
                (disk.total_space() - disk.available_space()) as f64 / disk.total_space() as f64 * 100.0
            );
        }
        
        if !disks.is_empty() {
            println!("✅ Disk detection working");
        }
    }
    
    // Test temperature (if available)
    if let Ok(components) = sys.components() {
        let temp_components: Vec<_> = components.iter()
            .filter(|c| c.temperature().is_some())
            .collect();
        
        if !temp_components.is_empty() {
            println!("✅ Temperature sensors available: {}", temp_components.len());
            for component in temp_components {
                if let Some(temp) = component.temperature() {
                    println!("  {}: {:.1}°C", component.label(), temp);
                }
            }
        }
    }
    
    Ok(())
}

fn format_bytes(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut unit_index = 0;
    
    while size >= 1024.0 && unit_index < UNITS.len() - 1 {
        size /= 1024.0;
        unit_index += 1;
    }
    
    if unit_index == 0 {
        format!("{} {}", bytes, UNITS[unit_index])
    } else {
        format!("{:.1} {}", size, UNITS[unit_index])
    }
}

/// Test if a command exists in PATH
pub fn command_exists(command: &str) -> bool {
    Command::new("which").arg(command).output().map_or(false, |output| output.status.success())
}

/// Get system information as a structured format
pub fn get_system_info() -> serde_json::Value {
    let mut sys = System::new_all();
    sys.refresh_all();
    
    serde_json::json!({
        "hostname": get_hostname(),
        "platform": get_platform_info(),
        "cpu": {
            "cores": sys.cpus().len(),
            "brand": sys.cpus().first().map(|cpu| cpu.brand()).unwrap_or("Unknown"),
            "usage": sys.global_cpu_info().cpu_usage()
        },
        "memory": {
            "total": sys.total_memory(),
            "used": sys.used_memory(),
            "available": sys.available_memory()
        },
        "processes": sys.processes().len(),
        "uptime": sys.uptime()
    })
}

fn get_hostname() -> String {
    std::fs::read_to_string("/etc/hostname")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "unknown".to_string())
        .trim()
        .to_string()
}

fn get_platform_info() -> serde_json::Value {
    serde_json::json!({
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "family": std::env::consts::FAMILY
    })
}

/// Test if running in container/virtual environment
pub fn is_containerized() -> bool {
    // Check for Docker
    if Path::new("/.dockerenv").exists() {
        return true;
    }
    
    // Check for container indicators in cgroup
    if let Ok(content) = std::fs::read_to_string("/proc/1/cgroup") {
        if content.contains("docker") || content.contains("containerd") {
            return true;
        }
    }
    
    // Check for virtualization
    if let Ok(content) = std::fs::read_to_string("/proc/cpuinfo") {
        if content.contains("hypervisor") {
            return true;
        }
    }
    
    false
}

/// Get environment variables relevant to TunnelForge
pub fn get_relevant_env_vars() -> std::collections::HashMap<String, String> {
    let mut vars = std::collections::HashMap::new();
    
    let relevant_vars = vec![
        "PATH", "HOME", "USER", "SHELL", "TERM", "LANG", "DISPLAY",
        "XDG_CURRENT_DESKTOP", "DESKTOP_SESSION", "SSH_CONNECTION",
        "TUNNELFORGE_*"
    ];
    
    for var_pattern in relevant_vars {
        if var_pattern.ends_with('*') {
            let prefix = &var_pattern[..var_pattern.len()-1];
            for (key, value) in std::env::vars() {
                if key.starts_with(prefix) {
                    vars.insert(key, value);
                }
            }
        } else if let Ok(value) = std::env::var(var_pattern) {
            vars.insert(var_pattern.to_string(), value);
        }
    }
    
    vars
}