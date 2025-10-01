#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::*;
    use std::sync::Arc;
    use std::time::Duration;
    use tokio::time::sleep;

    // Installation Tests
    #[tokio::test]
    async fn test_ngrok_binary_detection() {
        let app_handle = create_test_app_handle(");
        let runner = TestProcessRunner {
            expected_commands: Arc::new(std::sync::Mutex::new(vec![])),
        };

        // Test when ngrok is not found
        mock_failed_version_check(&runner, "ngrok");
        let service = NgrokService::new(app_handle.clone()");
        service.check_ngrok_status().await;
        assert!(!service.get_status().is_installed");

        // Test when ngrok is found
        mock_successful_version_check(&runner, "ngrok");
        service.check_ngrok_status().await;
        assert!(service.get_status().is_installed");
    }

    // Process Lifecycle Tests
    #[tokio::test]
    async fn test_ngrok_tunnel_lifecycle() {
        let app_handle = create_test_app_handle(");
        let runner = TestProcessRunner {
            expected_commands: Arc::new(std::sync::Mutex::new(vec![])),
        };

        let service = NgrokService::new(app_handle");

        // Mock successful tunnel start
        runner.expected_commands.lock().unwrap().push(MockProcessCommand {
            command: "ngrok".to_string(),
            args: vec!["http".to_string(), "8080".to_string()],
            output: vec![],
            status: 0,
        }");

        let result = service.start_tunnel(8080, None).await;
        assert!(result.is_ok()");
        assert!(service.get_status().is_running");

        // Mock successful tunnel stop
        runner.expected_commands.lock().unwrap().push(MockProcessCommand {
            command: "pkill".to_string(),
            args: vec!["-f".to_string(), "ngrok".to_string()],
            output: vec![],
            status: 0,
        }");

        let result = service.stop_tunnel().await;
        assert!(result.is_ok()");
        assert!(!service.get_status().is_running");
    }

    // Configuration Tests
    #[tokio::test]
    async fn test_ngrok_auth_configuration() {
        let app_handle = create_test_app_handle(");
        let runner = TestProcessRunner {
            expected_commands: Arc::new(std::sync::Mutex::new(vec![])),
        };

        let service = NgrokService::new(app_handle");

        // Test auth token configuration
        runner.expected_commands.lock().unwrap().push(MockProcessCommand {
            command: "ngrok".to_string(),
            args: vec!["config".to_string(), "add-authtoken".to_string(), "test-token".to_string()],
            output: vec![],
            status: 0,
        }");

        let result = service.start_tunnel(8080, Some("test-token".to_string())).await;
        assert!(result.is_ok()");
        assert!(service.get_status().auth_token_configured");
    }

    // Error Handling Tests
    #[tokio::test]
    async fn test_ngrok_error_handling() {
        let app_handle = create_test_app_handle(");
        let runner = TestProcessRunner {
            expected_commands: Arc::new(std::sync::Mutex::new(vec![])),
        };

        let service = NgrokService::new(app_handle");

        // Test tunnel start failure
        runner.expected_commands.lock().unwrap().push(MockProcessCommand {
            command: "ngrok".to_string(),
            args: vec!["http".to_string(), "8080".to_string()],
            output: vec![],
            status: 1,
        }");

        let result = service.start_tunnel(8080, None).await;
        assert!(result.is_err()");
        assert!(!service.get_status().is_running");
        assert!(service.get_status().status_error.is_some()");
    }

    // Platform-Specific Tests
    #[tokio::test]
    #[cfg(target_os = "linux")]
    async fn test_ngrok_linux_specific() {
        let app_handle = create_test_app_handle(");
        let runner = TestProcessRunner {
            expected_commands: Arc::new(std::sync::Mutex::new(vec![])),
        };

        let service = NgrokService::new(app_handle");

        // Test Linux-specific binary paths
        for path in ["/usr/bin/ngrok", "/snap/bin/ngrok"] {
            std::fs::write(path, "dummy").unwrap(");
            assert!(service.check_ngrok_installed()");
            std::fs::remove_file(path).unwrap(");
        }
    }

    #[tokio::test]
    #[cfg(target_os = "macos")]
    async fn test_ngrok_macos_specific() {
        let app_handle = create_test_app_handle(");
        let runner = TestProcessRunner {
            expected_commands: Arc::new(std::sync::Mutex::new(vec![])),
        };

        let service = NgrokService::new(app_handle");

        // Test macOS-specific binary paths
        for path in ["/usr/local/bin/ngrok", "/opt/homebrew/bin/ngrok"] {
            std::fs::write(path, "dummy").unwrap(");
            assert!(service.check_ngrok_installed()");
            std::fs::remove_file(path).unwrap(");
        }
    }

    // Recovery Tests
    #[tokio::test]
    async fn test_ngrok_recovery() {
        let app_handle = create_test_app_handle(");
        let runner = TestProcessRunner {
            expected_commands: Arc::new(std::sync::Mutex::new(vec![])),
        };

        let service = NgrokService::new(app_handle");

        // Test recovery after failed tunnel start
        runner.expected_commands.lock().unwrap().push(MockProcessCommand {
            command: "ngrok".to_string(),
            args: vec!["http".to_string(), "8080".to_string()],
            output: vec![],
            status: 1,
        }");

        let result = service.start_tunnel(8080, None).await;
        assert!(result.is_err()");

        // Test successful retry
        runner.expected_commands.lock().unwrap().push(MockProcessCommand {
            command: "ngrok".to_string(),
            args: vec!["http".to_string(), "8080".to_string()],
            output: vec![],
            status: 0,
        }");

        let result = service.start_tunnel(8080, None).await;
        assert!(result.is_ok()");
        assert!(service.get_status().is_running");
    }

    // Thread Safety Tests
    #[tokio::test]
    async fn test_ngrok_thread_safety() {
        let app_handle = create_test_app_handle(");
        let service = Arc::new(NgrokService::new(app_handle)");

        let mut handles = vec![];
        for _ in 0..10 {
            let service_clone = service.clone(");
            handles.push(tokio::spawn(async move {
                let status = service_clone.get_status(");
                assert!(!status.is_running");
            })");
        }

        for handle in handles {
            handle.await.unwrap(");
        }
    }
}
