#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::*;
    use std::sync::Arc;
    use std::time::Duration;
    use tokio::time::sleep;

    // Installation Tests
    #[tokio::test]
    async fn test_cloudflared_binary_detection() {
        let app_handle = create_test_app_handle();
        let runner = TestProcessRunner {
            expected_commands: Arc::new(std::sync::Mutex::new(vec![])),
        };

        // Test when cloudflared is not found
        mock_failed_version_check(&runner, "cloudflared");
        let service = CloudflareService::new(app_handle.clone());
        service.check_cloudflared_status().await;
        assert!(!service.get_status().is_installed);

        // Test when cloudflared is found
        mock_successful_version_check(&runner, "cloudflared");
        service.check_cloudflared_status().await;
        assert!(service.get_status().is_installed);
    }

    // Process Lifecycle Tests
    #[tokio::test]
    async fn test_cloudflare_tunnel_lifecycle() {
        let app_handle = create_test_app_handle();
        let runner = TestProcessRunner {
            expected_commands: Arc::new(std::sync::Mutex::new(vec![])),
        };

        let service = CloudflareService::new(app_handle);

        // Mock successful tunnel start
        runner.expected_commands.lock().unwrap().push(MockProcessCommand {
            command: "cloudflared".to_string(),
            args: vec!["tunnel".to_string(), "--url".to_string(), "http://localhost:8080".to_string()],
            output: vec![],
            status: 0,
        });

        let result = service.start_quick_tunnel(8080).await;
        assert!(result.is_ok());
        assert!(service.get_status().is_running);

        // Mock successful tunnel stop
        runner.expected_commands.lock().unwrap().push(MockProcessCommand {
            command: "pkill".to_string(),
            args: vec!["-f".to_string(), "cloudflared.*tunnel".to_string()],
            output: vec![],
            status: 0,
        });

        let result = service.stop_quick_tunnel().await;
        assert!(result.is_ok());
        assert!(!service.get_status().is_running);
    }

    // Error Handling Tests
    #[tokio::test]
    async fn test_cloudflare_error_handling() {
        let app_handle = create_test_app_handle();
        let runner = TestProcessRunner {
            expected_commands: Arc::new(std::sync::Mutex::new(vec![])),
        };

        let service = CloudflareService::new(app_handle);

        // Test tunnel start failure
        runner.expected_commands.lock().unwrap().push(MockProcessCommand {
            command: "cloudflared".to_string(),
            args: vec!["tunnel".to_string(), "--url".to_string(), "http://localhost:8080".to_string()],
            output: vec![],
            status: 1,
        });

        let result = service.start_quick_tunnel(8080).await;
        assert!(result.is_err());
        assert!(!service.get_status().is_running);
        assert!(service.get_status().status_error.is_some());
    }

    // Platform-Specific Tests
    #[tokio::test]
    #[cfg(target_os = "linux")]
    async fn test_cloudflare_linux_specific() {
        let app_handle = create_test_app_handle();
        let runner = TestProcessRunner {
            expected_commands: Arc::new(std::sync::Mutex::new(vec![])),
        };

        let service = CloudflareService::new(app_handle);

        // Test Linux-specific binary paths
        for path in ["/usr/bin/cloudflared", "/snap/bin/cloudflared"] {
            std::fs::write(path, "dummy").unwrap();
            assert!(service.check_cloudflared_installed());
            std::fs::remove_file(path).unwrap();
        }
    }

    #[tokio::test]
    #[cfg(target_os = "macos")]
    async fn test_cloudflare_macos_specific() {
        let app_handle = create_test_app_handle();
        let runner = TestProcessRunner {
            expected_commands: Arc::new(std::sync::Mutex::new(vec![])),
        };

        let service = CloudflareService::new(app_handle);

        // Test macOS-specific binary paths
        for path in ["/usr/local/bin/cloudflared", "/opt/homebrew/bin/cloudflared"] {
            std::fs::write(path, "dummy").unwrap();
            assert!(service.check_cloudflared_installed());
            std::fs::remove_file(path).unwrap();
        }
    }

    // Recovery Tests
    #[tokio::test]
    async fn test_cloudflare_recovery() {
        let app_handle = create_test_app_handle();
        let runner = TestProcessRunner {
            expected_commands: Arc::new(std::sync::Mutex::new(vec![])),
        };

        let service = CloudflareService::new(app_handle);

        // Test recovery after failed tunnel start
        runner.expected_commands.lock().unwrap().push(MockProcessCommand {
            command: "cloudflared".to_string(),
            args: vec!["tunnel".to_string(), "--url".to_string(), "http://localhost:8080".to_string()],
            output: vec![],
            status: 1,
        });

        let result = service.start_quick_tunnel(8080).await;
        assert!(result.is_err());

        // Test successful retry
        runner.expected_commands.lock().unwrap().push(MockProcessCommand {
            command: "cloudflared".to_string(),
            args: vec!["tunnel".to_string(), "--url".to_string(), "http://localhost:8080".to_string()],
            output: vec![],
            status: 0,
        });

        let result = service.start_quick_tunnel(8080).await;
        assert!(result.is_ok());
        assert!(service.get_status().is_running);
    }

    // Thread Safety Tests
    #[tokio::test]
    async fn test_cloudflare_thread_safety() {
        let app_handle = create_test_app_handle();
        let service = Arc::new(CloudflareService::new(app_handle));

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

    // URL Parsing Tests
    #[tokio::test]
    async fn test_cloudflare_url_parsing() {
        let app_handle = create_test_app_handle();
        let runner = TestProcessRunner {
            expected_commands: Arc::new(std::sync::Mutex::new(vec![])),
        };

        let service = CloudflareService::new(app_handle);

        // Mock tunnel list with URL
        runner.expected_commands.lock().unwrap().push(MockProcessCommand {
            command: "cloudflared".to_string(),
            args: vec!["tunnel".to_string(), "list".to_string()],
            output: b"https://test.trycloudflare.com
".to_vec(),
            status: 0,
        });

        let (_, url, _) = service.check_tunnel_status();
        assert_eq!(url, Some("https://test.trycloudflare.com".to_string()));
    }
}
