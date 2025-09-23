#[cfg(test)]
mod integration_tests {
    use super::*;
    use tauri::test::{mock_app, mock_invoke};
    use std::sync::Arc;

    #[tokio::test]
    async fn test_cloudflare_integration_flow() {
        // This would test the complete flow of Cloudflare integration
        // 1. Check initial status (should be not installed)
        // 2. Simulate installation detection
        // 3. Test tunnel start/stop commands
        // 4. Verify status updates

        // Mock the app and invoke system
        let app = mock_app();

        // Test initial status
        let result = mock_invoke("get_cloudflare_status", &app).await;
        assert!(result.is_ok());

        // Test status check
        let result = mock_invoke("check_cloudflare_status", &app).await;
        assert!(result.is_ok());

        // Test tunnel operations (should fail gracefully without cloudflared)
        let result = mock_invoke("start_cloudflare_tunnel", &app, 8080).await;
        assert!(result.is_err()); // Should fail without cloudflared

        let result = mock_invoke("stop_cloudflare_tunnel", &app).await;
        assert!(result.is_ok()); // Stop should always work
    }

    #[tokio::test]
    async fn test_ngrok_integration_flow() {
        let app = mock_app();

        // Test initial status
        let result = mock_invoke("get_ngrok_status", &app).await;
        assert!(result.is_ok());

        // Test status check
        let result = mock_invoke("check_ngrok_status", &app).await;
        assert!(result.is_ok());

        // Test tunnel operations
        let result = mock_invoke("start_ngrok_tunnel", &app, 8080, Some("test-token".to_string())).await;
        assert!(result.is_err()); // Should fail without ngrok

        let result = mock_invoke("stop_ngrok_tunnel", &app).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_access_mode_integration_flow() {
        let app = mock_app();

        // Test initial status
        let result = mock_invoke("get_access_mode_status", &app).await;
        assert!(result.is_ok());

        // Test network access check
        let result = mock_invoke("check_network_access", &app).await;
        assert!(result.is_ok());

        // Test mode switching
        let result = mock_invoke("set_access_mode", &app, "LocalhostOnly", 4021).await;
        assert!(result.is_ok());

        let result = mock_invoke("set_access_mode", &app, "NetworkAccess", 8080).await;
        assert!(result.is_ok());

        // Test current binding
        let result = mock_invoke("get_current_binding", &app).await;
        assert!(result.is_ok());

        // Test connectivity testing
        let result = mock_invoke("test_network_connectivity", &app).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_cross_service_interaction() {
        let app = mock_app();

        // Test that multiple services can be used together
        // This simulates a real user workflow

        // 1. Check all service statuses
        let cloudflare_status = mock_invoke("get_cloudflare_status", &app).await.unwrap();
        let ngrok_status = mock_invoke("get_ngrok_status", &app).await.unwrap();
        let access_mode_status = mock_invoke("get_access_mode_status", &app).await.unwrap();

        // 2. Configure access mode
        let result = mock_invoke("set_access_mode", &app, "NetworkAccess", 4021).await;
        assert!(result.is_ok());

        // 3. Check network connectivity
        let result = mock_invoke("test_network_connectivity", &app).await;
        assert!(result.is_ok());

        // 4. Try to start tunnels (should fail gracefully)
        let cloudflare_result = mock_invoke("start_cloudflare_tunnel", &app, 4021).await;
        let ngrok_result = mock_invoke("start_ngrok_tunnel", &app, 4021, None::<String>).await;

        // At least one should fail (since we don't have the actual binaries)
        assert!(cloudflare_result.is_err() || ngrok_result.is_err());

        // 5. Clean up
        let stop_cloudflare = mock_invoke("stop_cloudflare_tunnel", &app).await;
        let stop_ngrok = mock_invoke("stop_ngrok_tunnel", &app).await;

        assert!(stop_cloudflare.is_ok());
        assert!(stop_ngrok.is_ok());
    }

    #[tokio::test]
    async fn test_error_handling_and_recovery() {
        let app = mock_app();

        // Test error handling for invalid inputs
        let result = mock_invoke("start_cloudflare_tunnel", &app, 0).await; // Invalid port
        assert!(result.is_err());

        let result = mock_invoke("start_ngrok_tunnel", &app, 4021, Some("".to_string())).await; // Empty token
        assert!(result.is_err());

        let result = mock_invoke("set_access_mode", &app, "InvalidMode", 4021).await; // Invalid mode
        assert!(result.is_err());

        // Test recovery - operations should still work after errors
        let result = mock_invoke("get_cloudflare_status", &app).await;
        assert!(result.is_ok());

        let result = mock_invoke("get_ngrok_status", &app).await;
        assert!(result.is_ok());

        let result = mock_invoke("get_access_mode_status", &app).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_concurrent_service_operations() {
        let app = mock_app();

        // Test concurrent operations on different services
        let handles = vec![
            tokio::spawn(async {
                let result = mock_invoke("get_cloudflare_status", &app).await;
                result.is_ok()
            }),
            tokio::spawn(async {
                let result = mock_invoke("get_ngrok_status", &app).await;
                result.is_ok()
            }),
            tokio::spawn(async {
                let result = mock_invoke("get_access_mode_status", &app).await;
                result.is_ok()
            }),
            tokio::spawn(async {
                let result = mock_invoke("check_network_access", &app).await;
                result.is_ok()
            }),
        ];

        // Wait for all operations to complete
        for handle in handles {
            let success = handle.await.unwrap();
            assert!(success, "Concurrent operation failed");
        }
    }
}
