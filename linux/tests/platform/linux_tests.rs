//! Linux-specific tests for TunnelForge
//! 
//! Tests Linux-specific functionality including systemd integration,
//! package management, and distribution-specific features.

use std::path::Path;
use std::process::Command;
use anyhow::Result;
use nix::unistd::getuid;

pub async fn run_linux_tests() -> Result<()> {
    println!("Running Linux-specific tests...");
    
    test_distribution_detection().await?;
    test_systemd_integration().await?;
    test_package_managers().await?;
    test_desktop_environments().await?;
    test_permissions().await?;
    test_filesystem_features().await?;
    
    Ok(())
}

async fn test_distribution_detection() -> Result<()> {
    println!("Testing Linux distribution detection...");
    
    // Test /etc/os-release
    if Path::new("/etc/os-release").exists() {
        let content = std::fs::read_to_string("/etc/os-release")?;
        println!("✅ /etc/os-release readable");
        
        // Parse distribution info
        for line in content.lines() {
            if line.starts_with("ID=") {
                let distro = line.split('=').nth(1).unwrap().trim_matches('"');
                println!("Detected distribution: {}", distro);
            }
            if line.starts_with("VERSION_ID=") {
                let version = line.split('=').nth(1).unwrap().trim_matches('"');
                println!("Distribution version: {}", version);
            }
        }
    }
    
    // Test lsb_release
    if let Ok(output) = Command::new("lsb_release").arg("-a").output() {
        if output.status.success() {
            println!("✅ lsb_release available");
            let output_str = String::from_utf8_lossy(&output.stdout);
            println!("LSB info: {}", output_str.trim());
        }
    }
    
    Ok(())
}

async fn test_systemd_integration() -> Result<()> {
    println!("Testing systemd integration...");
    
    // Check if systemd is running
    if Path::new("/run/systemd/system").exists() {
        println!("✅ systemd is running");
        
        // Test systemctl command
        if let Ok(output) = Command::new("systemctl").arg("--version").output() {
            if output.status.success() {
                println!("✅ systemctl available");
                let version = String::from_utf8_lossy(&output.stdout);
                println!("systemd version: {}", version.lines().next().unwrap_or("unknown"));
            }
        }
        
        // Test user services
        if let Ok(output) = Command::new("systemctl").args(&["--user", "list-units"]).output() {
            if output.status.success() {
                println!("✅ user services accessible");
            }
        }
        
        // Test journalctl
        if let Ok(output) = Command::new("journalctl").arg("--version").output() {
            if output.status.success() {
                println!("✅ journalctl available");
            }
        }
    } else {
        println!("⚠️  systemd not available");
    }
    
    Ok(())
}

async fn test_package_managers() -> Result<()> {
    println!("Testing package managers...");
    
    let package_managers = vec![
        ("apt", "dpkg -l"),
        ("yum", "rpm -qa"),
        ("dnf", "rpm -qa"),
        ("pacman", "pacman -Q"),
        ("zypper", "rpm -qa"),
        ("emerge", "qlist -I"),
    ];
    
    for (pm, list_cmd) in package_managers {
        if let Ok(_) = Command::new("which").arg(pm).output() {
            println!("✅ Package manager found: {}", pm);
            
            // Test if we can list packages
            let cmd_parts: Vec<&str> = list_cmd.split_whitespace().collect();
            if let Ok(output) = Command::new(cmd_parts[0]).args(&cmd_parts[1..]).output() {
                if output.status.success() {
                    let package_count = output.stdout.lines().count();
                    println!("  Packages accessible: {}", package_count);
                }
            }
        }
    }
    
    Ok(())
}

async fn test_desktop_environments() -> Result<()> {
    println!("Testing desktop environments...");
    
    // Check environment variables
    let desktop_vars = vec![
        "XDG_CURRENT_DESKTOP",
        "DESKTOP_SESSION",
        "GNOME_DESKTOP_SESSION_ID",
        "KDE_SESSION_VERSION",
    ];
    
    for var in desktop_vars {
        if let Ok(value) = std::env::var(var) {
            println!("✅ Desktop environment variable: {} = {}", var, value);
        }
    }
    
    // Check for common desktop processes
    let desktop_processes = vec![
        "gnome-shell",
        "kwin",
        "xfwm4",
        "openbox",
        "i3",
        "sway",
    ];
    
    let mut sys = sysinfo::System::new();
    sys.refresh_all();
    
    for process_name in desktop_processes {
        for (_, process) in sys.processes() {
            if process.name().contains(process_name) {
                println!("✅ Desktop process found: {}", process_name);
                break;
            }
        }
    }
    
    Ok(())
}

async fn test_permissions() -> Result<()> {
    println!("Testing Linux permissions...");
    
    let uid = getuid();
    println!("Current UID: {}", uid);
    
    if uid.is_root() {
        println!("⚠️  Running as root - some tests may not reflect normal user experience");
    } else {
        println!("✅ Running as regular user");
    }
    
    // Test sudo availability
    if let Ok(_) = Command::new("sudo").arg("-n").arg("true").output() {
        println!("✅ sudo available");
    }
    
    // Test polkit
    if Path::new("/usr/bin/pkexec").exists() {
        println!("✅ polkit available");
    }
    
    // Test common permission scenarios
    let test_paths = vec![
        ("/tmp", true), // Should be writable
        ("/etc", false), // Should not be writable for regular users
        ("/home", false), // Should not be writable for regular users
    ];
    
    for (path, expected_writable) in test_paths {
        if Path::new(path).exists() {
            let metadata = std::fs::metadata(path);
            if let Ok(metadata) = metadata {
                let readonly = metadata.permissions().readonly();
                if expected_writable && !readonly {
                    println!("✅ {} is writable as expected", path);
                } else if !expected_writable && readonly {
                    println!("✅ {} is read-only as expected", path);
                } else {
                    println!("⚠️  {} permission unexpected: writable={}", path, !readonly);
                }
            }
        }
    }
    
    Ok(())
}

async fn test_filesystem_features() -> Result<()> {
    println!("Testing Linux filesystem features...");
    
    // Test different filesystem types
    let mount_info = std::fs::read_to_string("/proc/mounts")?;
    let mut filesystems = std::collections::HashSet::new();
    
    for line in mount_info.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 3 {
            filesystems.insert(parts[2]);
        }
    }
    
    println!("Detected filesystems: {:?}", filesystems);
    
    // Test for specific features
    if filesystems.contains("ext4") {
        println!("✅ ext4 filesystem detected");
    }
    
    if filesystems.contains("btrfs") {
        println!("✅ btrfs filesystem detected");
    }
    
    if filesystems.contains("xfs") {
        println!("✅ XFS filesystem detected");
    }
    
    // Test inotify support
    if let Ok(output) = Command::new("sh").arg("-c").arg("echo 'test' | inotifywatch -v 2>&1 | head -1").output() {
        if output.status.success() || String::from_utf8_lossy(&output.stderr).contains("inotifywatch") {
            println!("✅ inotify available");
        }
    }
    
    // Test ACL support
    if Path::new("/usr/bin/getfacl").exists() {
        println!("✅ ACL tools available");
    }
    
    // Test SELinux
    if Path::new("/sys/fs/selinux").exists() {
        println!("✅ SELinux available");
    }
    
    // Test AppArmor
    if Path::new("/sys/kernel/security/apparmor").exists() {
        println!("✅ AppArmor available");
    }
    
    Ok(())
}

async fn test_display_server() -> Result<()> {
    println!("Testing display server...");
    
    // Test X11
    if std::env::var("DISPLAY").is_ok() {
        println!("✅ X11 display available");
        
        if let Ok(_) = Command::new("xprop").arg("-root").output() {
            println!("✅ X11 tools available");
        }
    }
    
    // Test Wayland
    if std::env::var("WAYLAND_DISPLAY").is_ok() {
        println!("✅ Wayland display available");
    }
    
    // Test display managers
    let display_managers = vec![
        "/usr/bin/gdm",
        "/usr/bin/sddm",
        "/usr/bin/lightdm",
        "/usr/bin/xdm",
    ];
    
    for dm in display_managers {
        if Path::new(dm).exists() {
            println!("✅ Display manager available: {}", dm);
        }
    }
    
    Ok(())
}

async fn test_audio_system() -> Result<()> {
    println!("Testing audio system...");
    
    // Test PulseAudio
    if Path::new("/usr/bin/pulseaudio").exists() {
        println!("✅ PulseAudio available");
        
        if let Ok(_) = Command::new("pactl").arg("info").output() {
            println!("✅ PulseAudio control available");
        }
    }
    
    // Test PipeWire
    if Path::new("/usr/bin/pipewire").exists() {
        println!("✅ PipeWire available");
        
        if let Ok(_) = Command::new("pw-cli").arg("info").output() {
            println!("✅ PipeWire control available");
        }
    }
    
    // Test ALSA
    if Path::new("/proc/asound").exists() {
        println!("✅ ALSA available");
    }
    
    Ok(())
}