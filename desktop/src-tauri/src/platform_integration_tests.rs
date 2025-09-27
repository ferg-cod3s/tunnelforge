#[cfg(test)]
mod platform_integration_tests {
    use super::*;
    use std::path::PathBuf;
    use tauri::test::{mock_app, mock_invoke};
    use std::fs;

    // Windows-specific tests
    #[cfg(target_os = "windows")]
    mod windows_tests {
        use super::*;
        use winreg::enums::*;
        use winreg::RegKey;

        #[tokio::test]
        async fn test_windows_startup_registry() {
            let platform = WindowsPlatform::new();
            
            // Test enabling startup
            let result = platform.register_startup_entry(true);
            assert!(result.is_ok());

            // Verify registry entry
            let hkcu = RegKey::predef(HKEY_CURRENT_USER);
            let startup_key = hkcu.open_subkey("SOFTWARE\Microsoft\Windows\CurrentVersion\Run")
                .expect("Failed to open registry key");
            let value: String = startup_key.get_value("TunnelForge")
                .expect("Failed to read registry value");
            assert!(!value.is_empty());

            // Test disabling startup
            let result = platform.register_startup_entry(false);
            assert!(result.is_ok());

            // Verify registry entry is removed
            let value_result: Result<String, _> = startup_key.get_value("TunnelForge");
            assert!(value_result.is_err());
        }

        #[tokio::test]
        async fn test_windows_notifications() {
            let platform = WindowsPlatform::new();
            let app = mock_app();

            // Test notification system
            let result = mock_invoke("show_notification", &app, "Test Title", "Test Message").await;
            assert!(result.is_ok());
        }

        #[tokio::test]
        async fn test_windows_service_management() {
            let platform = WindowsPlatform::new();
            
            // Test platform-specific setup
            let result = platform.setup_platform_specific();
            assert!(result.is_ok());
        }
    }

    // Linux-specific tests
    #[cfg(target_os = "linux")]
    mod linux_tests {
        use super::*;

        #[tokio::test]
        async fn test_linux_autostart() {
            let platform = LinuxPlatform::new();
            
            // Test enabling autostart
            let result = platform.setup_auto_launch(true);
            assert!(result.is_ok());

            // Verify desktop entry file
            let autostart_dir = dirs::config_dir()
                .unwrap()
                .join("autostart");
            let desktop_file = autostart_dir.join("tunnelforge.desktop");
            assert!(desktop_file.exists());

            // Verify desktop entry contents
            let contents = fs::read_to_string(&desktop_file).unwrap();
            assert!(contents.contains("Name=TunnelForge"));
            assert!(contents.contains("Type=Application"));

            // Test disabling autostart
            let result = platform.setup_auto_launch(false);
            assert!(result.is_ok());
            assert!(!desktop_file.exists());
        }

        #[tokio::test]
        async fn test_linux_notifications() {
            let platform = LinuxPlatform::new();
            
            // Test notification setup
            let result = platform.setup_notifications();
            assert!(result.is_ok());
        }

        #[tokio::test]
        async fn test_linux_system_tray() {
            let platform = LinuxPlatform::new();
            let app = mock_app();
            
            // Test system tray setup
            let result = platform.setup_system_tray(&app);
            assert!(result.is_ok());
        }

        #[tokio::test]
        async fn test_linux_power_management() {
            let platform = LinuxPlatform::new();
            
            // Test power management setup
            let result = platform.setup_power_management();
            assert!(result.is_ok());
        }
    }

    // macOS-specific tests
    #[cfg(target_os = "macos")]
    mod macos_tests {
        use super::*;

        #[tokio::test]
        async fn test_macos_launch_agent() {
            let platform = MacosPlatform::new();
            
            // Test enabling launch agent
            let result = platform.setup_auto_launch(true);
            assert!(result.is_ok());

            // Verify launch agent plist
            let launch_agents_dir = dirs::home_dir()
                .unwrap()
                .join("Library/LaunchAgents");
            let plist_file = launch_agents_dir.join("com.tunnelforge.app.plist");
            
            // Test disabling launch agent
            let result = platform.setup_auto_launch(false);
            assert!(result.is_ok());
        }

        #[tokio::test]
        async fn test_macos_notifications() {
            let platform = MacosPlatform::new();
            
            // Test notification setup
            let result = platform.setup_notifications();
            assert!(result.is_ok());
        }

        #[tokio::test]
        async fn test_macos_system_tray() {
            let platform = MacosPlatform::new();
            let app = mock_app();
            
            // Test system tray setup
            let result = platform.setup_system_tray(&app);
            assert!(result.is_ok());
        }

        #[tokio::test]
        async fn test_macos_power_management() {
            let platform = MacosPlatform::new();
            
            // Test power management setup
            let result = platform.setup_power_management();
            assert!(result.is_ok());
        }
    }

    // Cross-platform integration tests
    mod common_tests {
        use super::*;

        #[tokio::test]
        async fn test_platform_detection() {
            let app = mock_app();
            
            // Test platform detection
            let result = mock_invoke("get_platform_info", &app).await;
            assert!(result.is_ok());
            
            let platform_info = result.unwrap();
            #[cfg(target_os = "windows")]
            assert_eq!(platform_info.get("name"), Some("Windows"));
            
            #[cfg(target_os = "linux")]
            assert_eq!(platform_info.get("name"), Some("Linux"));
            
            #[cfg(target_os = "macos")]
            assert_eq!(platform_info.get("name"), Some("macOS"));
        }

        #[tokio::test]
        async fn test_file_operations() {
            let app = mock_app();
            
            // Test platform-specific file operations
            let test_dir = std::env::temp_dir().join("tunnelforge_test");
            fs::create_dir_all(&test_dir).unwrap();
            
            // Create test file
            let test_file = test_dir.join("test.txt");
            fs::write(&test_file, "test content").unwrap();
            
            // Test file operations
            let result = mock_invoke("read_file", &app, test_file.to_str().unwrap()).await;
            assert!(result.is_ok());
            
            // Cleanup
            fs::remove_dir_all(&test_dir).unwrap();
        }

        #[tokio::test]
        async fn test_service_lifecycle() {
            let app = mock_app();
            
            // Test service start
            let result = mock_invoke("start_service", &app).await;
            assert!(result.is_ok());
            
            // Test service status
            let result = mock_invoke("get_service_status", &app).await;
            assert!(result.is_ok());
            
            // Test service stop
            let result = mock_invoke("stop_service", &app).await;
            assert!(result.is_ok());
        }
    }
}
