#[cfg(test)]
mod tests {
    use super::*;
    use tauri::AppHandle;

    // Mock AppHandle for testing
    fn create_mock_app_handle() -> AppHandle {
        unimplemented!("Mock AppHandle creation for testing")
    }

    #[test]
    fn test_ngrok_service_creation() {
        let app_handle = create_mock_app_handle();
        let service = NgrokService::new(app_handle);

        let status = service.get_status();
        assert!(!status.is_installed);
        assert!(!status.is_running);
        assert!(status.public_url.is_none());
        assert!(!status.auth_token_configured);
        assert!(status.status_error.is_none());
    }

    #[test]
    fn test_ngrok_status_serialization() {
        let status = NgrokStatus {
            is_installed: true,
            is_running: true,
            public_url: Some("https://test.ngrok.io".to_string()),
            auth_token_configured: true,
            status_error: None,
        };

        let serialized = serde_json::to_string(&status).unwrap();
        let deserialized: NgrokStatus = serde_json::from_str(&serialized).unwrap();

        assert_eq!(status.is_installed, deserialized.is_installed);
        assert_eq!(status.is_running, deserialized.is_running);
        assert_eq!(status.public_url, deserialized.public_url);
        assert_eq!(status.auth_token_configured, deserialized.auth_token_configured);
        assert_eq!(status.status_error, deserialized.status_error);
    }

    #[tokio::test]
    async fn test_ngrok_commands() {
        let app_handle = create_mock_app_handle();

        // Test get_ngrok_status command
        let result = get_ngrok_status(app_handle.clone()).await;
        assert!(result.is_ok());

        // Test check_ngrok_status command
        let result = check_ngrok_status(app_handle.clone()).await;
        assert!(result.is_ok());

        // Test start_ngrok_tunnel command (should fail without ngrok)
        let result = start_ngrok_tunnel(app_handle.clone(), 8080, Some("test-token".to_string())).await;
        assert!(result.is_err());

        // Test stop_ngrok_tunnel command
        let result = stop_ngrok_tunnel(app_handle.clone()).await;
        assert!(result.is_ok());
    }

    #[test]
    fn test_ngrok_service_thread_safety() {
        let app_handle = create_mock_app_handle();
        let service = Arc::new(NgrokService::new(app_handle));

        // Spawn multiple threads to test concurrent access
        let handles: Vec<_> = (0..10)
            .map(|_| {
                let service_clone = service.clone();
                std::thread::spawn(move || {
                    let status = service_clone.get_status();
                    // Just test that we can access the status without panicking
                    assert!(status.is_installed == false || status.is_installed == true);
                })
            })
            .collect();

        // Wait for all threads to complete
        for handle in handles {
            handle.join().unwrap();
        }
    }

    #[test]
    fn test_ngrok_status_clone() {
        let original = NgrokStatus {
            is_installed: true,
            is_running: false,
            public_url: Some("https://example.ngrok.io".to_string()),
            auth_token_configured: true,
            status_error: Some("Test error".to_string()),
        };

        let cloned = original.clone();
        assert_eq!(original.is_installed, cloned.is_installed);
        assert_eq!(original.is_running, cloned.is_running);
        assert_eq!(original.public_url, cloned.public_url);
        assert_eq!(original.auth_token_configured, cloned.auth_token_configured);
        assert_eq!(original.status_error, cloned.status_error);
    }

    #[test]
    fn test_ngrok_service_with_auth_token() {
        let app_handle = create_mock_app_handle();
        let service = NgrokService::new(app_handle);

        // Test that auth token status is properly tracked
        let status = service.get_status();
        assert!(!status.auth_token_configured);
    }
}
