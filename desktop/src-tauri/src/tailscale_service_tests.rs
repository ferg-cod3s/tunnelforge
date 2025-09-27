#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::*;
    use std::sync::Arc;
    use std::time::Duration;
    use tokio::time::sleep;

    // Installation Tests
    #[tokio::test]
    async fn test_tailscale_binary_detection() {
        let app_handle = create_test_app_handle();
        let runner = TestProcessRunner {
            expected_commands: Arc::new(std::sync::Mutex::new(vec![])),
        };

        // Test when tailscale is not found
        mock_failed_version_check(&runner, "tailscale");
        let service = TailscaleService::new(app_handle.clone());
        service.check_tailscale_status().await;
        assert!(!service.get_status().is_installed);

        // Test when tailscale is found
        mock_successful_version_check(&runner, "tailscale");
        service.check_tailscale_status().await;
        assert!(service.get_status().is_installed);
    }

    // Process Lifecycle Tests
    #[tokio::test]
    async fn test_tailscale_status_lifecycle() {
        let app_handle = create_test_app_handle();
        let runner = TestProcessRunner {
            expected_commands: Arc::new(std::sync::Mutex::new(vec![])),
        };

        let service = TailscaleService::new(app_handle);

        // Mock successful status check
        runner.expected_commands.lock().unwrap().push(MockProcessCommand {
            command: "tailscale".to_string(),
            args: vec!["status".to_string(), "--json".to_string()],
            output: b"{\"BackendState\":\"Running\",\"TailscaleIPs\":[\"100.100.100.100\"],\"CurrentTailnet\":{\"Name\":\"test.com\"}}
".to_vec(),
            status: 0,
        });

        service.check_tailscale_status().await;
        let status = service.get_status();
        assert!(status.is_running);
        assert_eq!(status.addresses, vec!["100.100.100.100"]);
        assert_eq!(status.hostname, Some("test.com".to_string()));
    }

    // Serve Status Tests
    #[tokio::test]
    async fn test_tailscale_serve_status() {
        let app_handle = create_test_app_handle();
        let runner = TestProcessRunner {
            expected_commands: Arc::new(std::sync::Mutex::new(vec![])),
        };

        let service = TailscaleServeStatusService::new(app_handle);

        // Test initial state
        let status = service.get_status();
        assert!(!status.is_loading);
        assert!(!status.is_running);
        assert!(status.last_error.is_none());

        // Test monitoring start
        service.start_monitoring();
        let status = service.get_status();
        assert!(status.is_loading);

        // Test monitoring stop
        service.stop_monitoring();
        let status = service.get_status();
        assert!(!status.is_loading);
    }

    // Error Handling Tests
    #[tokio::test]
    async fn test_tailscale_error_handling() {
        let app_handle = create_test_app_handle();
        let runner = TestProcessRunner {
            expected_commands: Arc::new(std::sync::Mutex::new(vec![])),
        };

        let service = TailscaleService::new(app_handle);

        // Mock failed status check
        runner.expected_commands.lock().unwrap().push(MockProcessCommand {
            command: "tailscale".to_string(),
            args: vec!["status".to_string(), "--json".to_string()],
            output: vec![],
            status: 1,
        });

        service.check_tailscale_status().await;
        let status = service.get_status();
        assert!(!status.is_running);
        assert!(status.error.is_some());
    }

    // Platform-Specific Tests
    #[tokio::test]
    #[cfg(target_os = "linux")]
    async fn test_tailscale_linux_specific() {
        let app_handle = create_test_app_handle();
        let runner = TestProcessRunner {
            expected_commands: Arc::new(std::sync::Mutex::new(vec![])),
        };

        let service = TailscaleService::new(app_handle);

        // Test Linux-specific binary paths
        for path in ["/usr/bin/tailscale", "/snap/bin/tailscale"] {
            std::fs::write(path, "dummy").unwrap();
            assert!(service.check_tailscale_installed());
            std::fs::remove_file(path).unwrap();
        }
    }

    #[tokio::test]
    #[cfg(target_os = "macos")]
    async fn test_tailscale_macos_specific() {
        let app_handle = create_test_app_handle();
        let runner = TestProcessRunner {
            expected_commands: Arc::new(std::sync::Mutex::new(vec![])),
        };

        let service = TailscaleService::new(app_handle);

        // Test macOS-specific binary paths
        for path in ["/Applications/Tailscale.app/Contents/MacOS/Tailscale"] {
            std::fs::write(path, "dummy").unwrap();
            assert!(service.check_tailscale_installed());
            std::fs::remove_file(path).unwrap();
        }
    }

    // Recovery Tests
    #[tokio::test]
    async fn test_tailscale_recovery() {
        let app_handle = create_test_app_handle();
        let runner = TestProcessRunner {
            expected_commands: Arc::new(std::sync::Mutex::new(vec![])),
        };

        let service = TailscaleService::new(app_handle);

        // Test recovery after failed status check
        runner.expected_commands.lock().unwrap().push(MockProcessCommand {
            command: "tailscale".to_string(),
            args: vec!["status".to_string(), "--json".to_string()],
            output: vec![],
            status: 1,
        });

        service.check_tailscale_status().await;
        let status = service.get_status();
        assert!(!status.is_running);

        // Test successful retry
        runner.expected_commands.lock().unwrap().push(MockProcessCommand {
            command: "tailscale".to_string(),
            args: vec!["status".to_string(), "--json".to_string()],
            output: b"{\"BackendState\":\"Running\",\"TailscaleIPs\":[\"100.100.100.100\"]}
".to_vec(),
            status: 0,
        });

        service.check_tailscale_status().await;
        let status = service.get_status();
        assert!(status.is_running);
    }

    // Thread Safety Tests
    #[tokio::test]
    async fn test_tailscale_thread_safety() {
        let app_handle = create_test_app_handle();
        let service = Arc::new(TailscaleService::new(app_handle));

        let mut handles = vec![];
        for _ in 0..10 {
            let service_clone = service.clone();
            handles.push(tokio::spawn(async move {
                let status = service_clone.get_status();
                assert!(!status.is_running);
            }));
        }

        for handle in handles {
            handle.await.unwrap();
        }
    }

    // Command Tests
    #[tokio::test]
    async fn test_tailscale_commands() {
        let app_handle = create_test_app_handle();
        
        // Test get_tailscale_status command
        let result = get_tailscale_status(app_handle.clone()).await;
        assert!(result.is_ok());

        // Test check_tailscale_status command
        let result = check_tailscale_status(app_handle.clone()).await;
        assert!(result.is_ok());

        // Test get_tailscale_serve_status command
        let result = get_tailscale_serve_status(app_handle.clone()).await;
        assert!(result.is_ok());
    }
}
