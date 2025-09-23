#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use std::sync::Mutex;
    use tauri::AppHandle;
    use tauri::Manager;
    use tauri::State;

    // Mock AppHandle for testing
    fn create_mock_app_handle() -> AppHandle {
        // This would need to be implemented with Tauri's testing utilities
        // For now, we'll create a minimal mock
        unimplemented!("Mock AppHandle creation for testing")
    }

    #[test]
    fn test_cloudflare_service_creation() {
        let app_handle = create_mock_app_handle();
        let service = CloudflareService::new(app_handle);

        let status = service.get_status();
        assert!(!status.is_installed);
        assert!(!status.is_running);
        assert!(status.public_url.is_none());
        assert!(status.status_error.is_none());
    }

    #[test]
    fn test_cloudflare_status_serialization() {
        let status = CloudflareStatus {
            is_installed: true,
            is_running: false,
            public_url: Some("https://test.trycloudflare.com".to_string()),
            status_error: None,
        };

        let serialized = serde_json::to_string(&status).unwrap();
        let deserialized: CloudflareStatus = serde_json::from_str(&serialized).unwrap();

        assert_eq!(status.is_installed, deserialized.is_installed);
        assert_eq!(status.is_running, deserialized.is_running);
        assert_eq!(status.public_url, deserialized.public_url);
        assert_eq!(status.status_error, deserialized.status_error);
    }

    #[tokio::test]
    async fn test_cloudflare_commands() {
        let app_handle = create_mock_app_handle();

        // Test get_cloudflare_status command
        let result = get_cloudflare_status(app_handle.clone()).await;
        assert!(result.is_ok());

        // Test check_cloudflare_status command
        let result = check_cloudflare_status(app_handle.clone()).await;
        assert!(result.is_ok());

        // Test start_cloudflare_tunnel command (should fail without cloudflared)
        let result = start_cloudflare_tunnel(app_handle.clone(), 8080).await;
        assert!(result.is_err());

        // Test stop_cloudflare_tunnel command
        let result = stop_cloudflare_tunnel(app_handle.clone()).await;
        assert!(result.is_ok());
    }

    #[test]
    fn test_cloudflare_service_thread_safety() {
        let app_handle = create_mock_app_handle();
        let service = Arc::new(CloudflareService::new(app_handle));

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
    fn test_cloudflare_status_clone() {
        let original = CloudflareStatus {
            is_installed: true,
            is_running: true,
            public_url: Some("https://example.com".to_string()),
            status_error: Some("Test error".to_string()),
        };

        let cloned = original.clone();
        assert_eq!(original.is_installed, cloned.is_installed);
        assert_eq!(original.is_running, cloned.is_running);
        assert_eq!(original.public_url, cloned.public_url);
        assert_eq!(original.status_error, cloned.status_error);
    }
}
