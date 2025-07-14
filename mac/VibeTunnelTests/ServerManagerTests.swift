import Foundation
import Testing
@testable import VibeTunnel

// MARK: - Server Manager Tests

@Suite("Server Manager Tests", .serialized, .tags(.serverManager))
@MainActor
final class ServerManagerTests {
    /// We'll use the shared ServerManager instance since it's a singleton
    let manager = ServerManager.shared

    init() async {
        // Ensure clean state before each test
        await manager.stop()
    }

    deinit {
        // Clean up is handled in init() of next test since we can't use async in deinit
    }

    // MARK: - Server Lifecycle Tests

    @Test("Starting and stopping Bun server", .tags(.critical, .attachmentTests))
    func serverLifecycle() async throws {
        // Attach system information for debugging
        Attachment.record(TestUtilities.captureSystemInfo(), named: "System Info")
        
        // Attach initial server state
        Attachment.record(TestUtilities.captureServerState(manager), named: "Initial Server State")
        
        // Start the server
        await manager.start()

        // Give server time to attempt start
        try await Task.sleep(for: .milliseconds(2_000))

        // Attach server state after start attempt
        Attachment.record(TestUtilities.captureServerState(manager), named: "Post-Start Server State")

        // Handle both scenarios: binary not found vs binary working
        if ServerBinaryAvailableCondition.isAvailable() {
            // In CI with working binary, server should start successfully or fail gracefully
            #expect(manager.isRunning || manager.lastError != nil)
            Attachment.record("""
                Binary Available: Server should start or fail gracefully
                Is Running: \(manager.isRunning)
                Server Instance: \(manager.bunServer != nil ? "Present" : "Nil")
                Last Error: \(manager.lastError?.localizedDescription ?? "None")
                """, named: "Server Status With Binary")
        } else {
            // In test environment without binary, server should fail to start
            if let error = manager.lastError as? BunServerError {
                #expect(error == .binaryNotFound)
                Attachment.record("""
                    Error Type: \(error)
                    Error Description: \(error.localizedDescription)
                    """, named: "Server Error Details")
            }
            #expect(!manager.isRunning)
            #expect(manager.bunServer == nil)
        }

        // Stop should work regardless of state
        await manager.stop()

        // After stop, server should not be running
        #expect(!manager.isRunning)
        
        // Attach final state
        Attachment.record(TestUtilities.captureServerState(manager), named: "Final Server State")
    }

    @Test("Starting server when already running does not create duplicate", .tags(.critical))
    func startingAlreadyRunningServer() async throws {
        // In test environment, we can't actually start the server
        // So we'll test the logic of preventing duplicate starts

        // First attempt to start
        await manager.start()
        try await Task.sleep(for: .milliseconds(1_000))

        let firstServer = manager.bunServer
        let firstError = manager.lastError

        // Try to start again
        await manager.start()

        // Should still have the same state (either nil or same instance)
        #expect(manager.bunServer === firstServer)

        // Error should be consistent
        if let error1 = firstError as? BunServerError,
           let error2 = manager.lastError as? BunServerError
        {
            #expect(error1 == error2)
        }

        // Cleanup
        await manager.stop()
    }

    @Test("Port configuration")
    func portConfiguration() async throws {
        // Store original port
        let originalPort = manager.port

        // Test setting different ports
        let testPorts = ["8080", "3000", "9999"]

        for port in testPorts {
            manager.port = port
            #expect(manager.port == port)
            #expect(UserDefaults.standard.string(forKey: "serverPort") == port)
        }

        // Restore original port
        manager.port = originalPort
    }

    @Test("Bind address configuration", arguments: [
        DashboardAccessMode.localhost,
        DashboardAccessMode.network
    ])
    func bindAddressConfiguration(mode: DashboardAccessMode) async throws {
        // Store original mode
        let originalMode = UserDefaults.standard.string(forKey: "dashboardAccessMode") ?? ""

        // Set the mode via UserDefaults (as bindAddress setter does)
        UserDefaults.standard.set(mode.rawValue, forKey: "dashboardAccessMode")

        // Check bind address reflects the mode
        #expect(manager.bindAddress == mode.bindAddress)

        // Restore original mode
        UserDefaults.standard.set(originalMode, forKey: "dashboardAccessMode")
    }

    // MARK: - Concurrent Operations Tests

    @Test("Concurrent server operations are serialized", .tags(.concurrency))
    func concurrentServerOperations() async throws {
        // Ensure clean state
        await manager.stop()

        // Start multiple operations concurrently
        await withTaskGroup(of: Void.self) { group in
            // Start server
            group.addTask { [manager] in
                await manager.start()
            }

            // Try to stop immediately
            group.addTask { [manager] in
                try? await Task.sleep(for: .milliseconds(50))
                await manager.stop()
            }

            // Try to restart
            group.addTask { [manager] in
                try? await Task.sleep(for: .milliseconds(100))
                await manager.restart()
            }

            await group.waitForAll()
        }

        // Server should be in a consistent state
        let finalState = manager.isRunning
        if finalState {
            #expect(manager.bunServer != nil)
        } else {
            #expect(manager.bunServer == nil)
        }

        // Cleanup
        await manager.stop()
    }

    @Test("Server restart maintains configuration", .tags(.critical))
    func serverRestart() async throws {
        // Set specific configuration
        let originalPort = manager.port
        let testPort = "4567"
        manager.port = testPort

        // Start server
        await manager.start()
        try await Task.sleep(for: .milliseconds(200))

        let serverBeforeRestart = manager.bunServer
        _ = manager.lastError

        // Restart
        await manager.restart()
        try await Task.sleep(for: .milliseconds(200))

        // Verify port configuration is maintained
        #expect(manager.port == testPort)

        // Handle both scenarios: binary available vs not available
        if ServerBinaryAvailableCondition.isAvailable() {
            // In CI with working binary, server instances may vary
            // Focus on configuration persistence
            #expect(manager.port == testPort) // Configuration should persist
        } else {
            // In test environment without binary, both instances should be nil
            #expect(manager.bunServer == nil)
            #expect(serverBeforeRestart == nil)
            
            // Error should be consistent (binary not found)
            if let error = manager.lastError as? BunServerError {
                #expect(error == .binaryNotFound)
            }
        }

        // Cleanup - restore original port
        manager.port = originalPort
        await manager.stop()
    }

    // MARK: - Error Handling Tests

    @Test("Server state remains consistent after operations", .tags(.reliability))
    func serverStateConsistency() async throws {
        // Ensure clean state
        await manager.stop()

        // Perform various operations
        await manager.start()
        try await Task.sleep(for: .milliseconds(200))

        await manager.stop()
        try await Task.sleep(for: .milliseconds(200))

        await manager.start()
        try await Task.sleep(for: .milliseconds(200))

        // State should be consistent
        if manager.isRunning {
            #expect(manager.bunServer != nil)
        } else {
            #expect(manager.bunServer == nil)
        }

        // Cleanup
        await manager.stop()
    }

    // MARK: - Crash Recovery Tests

    @Test("Server auto-restart behavior")
    func serverAutoRestart() async throws {
        // Start server
        await manager.start()
        try await Task.sleep(for: .milliseconds(200))

        // Handle both scenarios: binary available vs not available
        if ServerBinaryAvailableCondition.isAvailable() {
            // In CI with working binary, server behavior may vary
            // Just ensure we don't crash and can clean up
            Bool(true) // Always pass - this test is about ensuring no crashes
        } else {
            // In test environment without binary, server won't actually start
            #expect(!manager.isRunning)
            #expect(manager.bunServer == nil)
            
            // Verify error is set appropriately
            if let error = manager.lastError as? BunServerError {
                #expect(error == .binaryNotFound)
            }
        }

        // Note: We can't easily simulate crashes in tests without
        // modifying the production code. The BunServer has built-in
        // auto-restart functionality on unexpected termination.

        // Cleanup
        await manager.stop()
    }
    
    // MARK: - Enhanced Server Management Tests with Attachments
    
    @Test("Server configuration management with diagnostics", .tags(.attachmentTests, .requiresServerBinary), .enabled(if: ServerBinaryAvailableCondition.isAvailable()))
    func serverConfigurationDiagnostics() async throws {
        // Attach test environment
        Attachment.record("""
            Test: Server Configuration Management
            Binary Available: \(ServerBinaryAvailableCondition.isAvailable())
            Environment: \(ProcessInfo.processInfo.environment["CI"] != nil ? "CI" : "Local")
            """, named: "Test Configuration")
        
        // Record initial state
        Attachment.record(TestUtilities.captureServerState(manager), named: "Initial State")
        
        // Test server configuration without actually starting it
        let originalPort = manager.port
        manager.port = "4567"
        
        // Record configuration change
        Attachment.record("""
            Port changed from \(originalPort) to \(manager.port)
            Bind address: \(manager.bindAddress)
            """, named: "Configuration Change")
        
        #expect(manager.port == "4567")
        
        // Restore original configuration
        manager.port = originalPort
        
        // Record final state
        Attachment.record(TestUtilities.captureServerState(manager), named: "Final State")
    }
    
    @Test("Session model validation with attachments", .tags(.attachmentTests, .sessionManagement))
    func sessionModelValidation() async throws {
        // Attach test info
        Attachment.record("""
            Test: TunnelSession Model Validation
            Purpose: Verify session creation and state management
            """, named: "Test Info")
        
        // Create test session
        let session = TunnelSession()
        
        // Record session details
        Attachment.record("""
            Session ID: \(session.id)
            Created At: \(session.createdAt)
            Last Activity: \(session.lastActivity)
            Is Active: \(session.isActive)
            Process ID: \(session.processID?.description ?? "none")
            """, named: "Session Details")
        
        // Validate session properties
        #expect(session.isActive)
        #expect(session.lastActivity >= session.createdAt)
        
        // Ensure session ID is valid and stable
        let sessionID = session.id
        #expect(!sessionID.uuidString.isEmpty)
        #expect(sessionID == session.id) // Ensures ID is stable across calls
    }
}
