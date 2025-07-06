import AppKit
import CoreGraphics
import CoreImage
@preconcurrency import CoreMedia
import Foundation
import OSLog
@preconcurrency import ScreenCaptureKit
import VideoToolbox

/// Service that provides screen capture functionality with HTTP API
@preconcurrency
@MainActor
public final class ScreencapService: NSObject {
    private let logger = Logger(subsystem: "sh.vibetunnel.vibetunnel", category: "ScreencapService")

    // MARK: - Singleton

    static let shared = ScreencapService()

    // MARK: - WebSocket Connection State

    private var isWebSocketConnecting = false
    private var isWebSocketConnected = false
    private var webSocketConnectionContinuations: [CheckedContinuation<Void, Error>] = []
    private var reconnectTask: Task<Void, Never>?
    private var shouldReconnect = true

    // MARK: - Properties

    private var captureStream: SCStream?
    private var captureFilter: SCContentFilter?
    private var isCapturing = false
    private var captureMode: CaptureMode = .desktop(displayIndex: 0)
    private var selectedWindow: SCWindow?
    private var currentDisplayIndex: Int = 0
    private var currentFrame: CGImage?
    private let frameQueue = DispatchQueue(label: "sh.vibetunnel.screencap.frame", qos: .userInitiated)
    private let sampleHandlerQueue = DispatchQueue(label: "sh.vibetunnel.screencap.sampleHandler", qos: .userInitiated)
    private var frameCounter: Int = 0

    /// Icon cache
    private var iconCache: [Int32: String?] = [:] // PID -> base64 icon

    // WebRTC support
    // These properties need to be nonisolated so they can be accessed from the stream output handler
    private nonisolated(unsafe) var webRTCManager: WebRTCManager?
    private nonisolated(unsafe) var useWebRTC = false
    private var decompressionSession: VTDecompressionSession?

    /// State machine for capture lifecycle
    private let stateMachine = CaptureStateMachine()

    // MARK: - Types

    enum ScreencapError: LocalizedError {
        case invalidServerURL
        case webSocketNotConnected
        case windowNotFound(Int)
        case noDisplay
        case notCapturing
        case failedToStartCapture(Error)
        case failedToCreateEvent
        case invalidCoordinates(x: Double, y: Double)
        case invalidKeyInput(String)
        case failedToGetContent(Error)
        case invalidWindowIndex
        case invalidApplicationIndex
        case invalidCaptureType
        case invalidConfiguration
        case serviceNotReady

        var errorDescription: String? {
            switch self {
            case .invalidServerURL:
                "Invalid server URL for WebSocket connection"
            case .webSocketNotConnected:
                "WebSocket connection not established"
            case .windowNotFound(let id):
                "Window with ID \(id) not found"
            case .noDisplay:
                "No display available"
            case .notCapturing:
                "Screen capture is not active"
            case .failedToStartCapture(let error):
                "Failed to start capture: \(error.localizedDescription)"
            case .failedToCreateEvent:
                "Failed to create system event"
            case .invalidCoordinates(let x, let y):
                "Invalid coordinates: (\(x), \(y))"
            case .invalidKeyInput(let key):
                "Invalid key input: \(key)"
            case .failedToGetContent(let error):
                "Failed to get shareable content: \(error.localizedDescription)"
            case .invalidWindowIndex:
                "Invalid window index"
            case .invalidApplicationIndex:
                "Invalid application index"
            case .invalidCaptureType:
                "Invalid capture type"
            case .invalidConfiguration:
                "Invalid capture configuration"
            case .serviceNotReady:
                "Screen capture service is not ready. Connection may still be initializing."
            }
        }
    }

    enum CaptureMode {
        case desktop(displayIndex: Int = 0)
        case allDisplays
        case window(SCWindow)
        case application(SCRunningApplication)
    }

    struct DisplayInfo: Codable {
        let id: String
        let width: Int
        let height: Int
        let scaleFactor: Double
        let refreshRate: Double
        let x: Double
        let y: Double
        let name: String?
    }

    struct WindowInfo: Codable {
        let cgWindowID: Int
        let title: String?
        let x: Double
        let y: Double
        let width: Double
        let height: Double
    }

    struct ProcessGroup: Codable {
        let processName: String
        let pid: Int32
        let bundleIdentifier: String?
        let iconData: String? // Base64 encoded PNG
        let windows: [WindowInfo]
    }

    // MARK: - Initialization

    override init() {
        super.init()
        logger.info("🚀 ScreencapService initialized, setting up WebSocket connection...")

        // Register for display configuration changes
        setupDisplayNotifications()

        // Set up state machine callbacks
        setupStateMachine()

        // Connect to WebSocket for API handling when service is created
        Task {
            await setupWebSocketForAPIHandling()
        }
    }

    deinit {
        // Remove display notifications
        NotificationCenter.default.removeObserver(self)
    }

    /// Setup WebSocket connection for handling API requests
    private func setupWebSocketForAPIHandling() async {
        // Check if already connected or connecting
        if isWebSocketConnected {
            logger.debug("WebSocket already connected")
            return
        }

        if isWebSocketConnecting {
            logger.debug("WebSocket connection already in progress, waiting...")
            // Wait for existing connection attempt
            try? await withCheckedThrowingContinuation { continuation in
                webSocketConnectionContinuations.append(continuation)
            }
            return
        }

        isWebSocketConnecting = true

        // Transition to connecting state only if not already connected/capturing
        switch stateMachine.currentState {
        case .idle, .error:
            stateMachine.processEvent(.connect)
        case .capturing, .ready:
            // Already connected, this is a reconnection
            logger.info("🔄 Reconnecting WebSocket while in \(self.stateMachine.currentState) state")
        default:
            logger.warning("⚠️ Unexpected state when starting WebSocket connection: \(self.stateMachine.currentState)")
        }

        // Get server URL from environment or use default
        let serverPort = UserDefaults.standard.string(forKey: "serverPort") ?? "4020"
        let serverURLString = ProcessInfo.processInfo
            .environment["VIBETUNNEL_SERVER_URL"] ?? "http://localhost:\(serverPort)"
        logger.info("📍 Using server URL: \(serverURLString)")
        guard let serverURL = URL(string: serverURLString) else {
            logger.error("Invalid server URL: \(serverURLString)")
            isWebSocketConnecting = false

            // Transition to error state
            stateMachine.processEvent(.connectionFailed(ScreencapError.invalidServerURL))

            // Fail all waiting continuations
            for continuation in webSocketConnectionContinuations {
                continuation.resume(throwing: ScreencapError.invalidServerURL)
            }
            webSocketConnectionContinuations.removeAll()
            return
        }

        // Create WebRTC manager which handles WebSocket API requests
        if webRTCManager == nil {
            // Check if authentication is disabled
            let authMode = UserDefaults.standard.string(forKey: "authenticationMode") ?? "os"
            let isNoAuth = authMode == "none"

            if isNoAuth {
                // Authentication is disabled, create WebRTC manager without token
                logger.info("🔓 Authentication disabled, creating WebRTC manager without token")
                webRTCManager = WebRTCManager(serverURL: serverURL, screencapService: self, localAuthToken: nil)
            } else {
                // Get local auth token from ServerManager - this might be nil if server isn't started yet
                let localAuthToken = ServerManager.shared.bunServer?.localToken
                if localAuthToken == nil {
                    logger.warning("⚠️ No local auth token available yet - server might not be started")
                    logger.warning("⚠️ Will retry connection when auth token becomes available")
                    // Schedule a retry
                    scheduleReconnection()

                    // Transition to error state temporarily
                    stateMachine.processEvent(.connectionFailed(ScreencapError.webSocketNotConnected))
                    isWebSocketConnecting = false

                    // Fail waiting continuations
                    for continuation in webSocketConnectionContinuations {
                        continuation.resume(throwing: ScreencapError.webSocketNotConnected)
                    }
                    webSocketConnectionContinuations.removeAll()
                    return
                }
                webRTCManager = WebRTCManager(
                    serverURL: serverURL,
                    screencapService: self,
                    localAuthToken: localAuthToken
                )
            }
        } else if webRTCManager?.localAuthToken == nil {
            // Check if authentication is disabled
            let authMode = UserDefaults.standard.string(forKey: "authenticationMode") ?? "os"
            let isNoAuth = authMode == "none"

            if !isNoAuth {
                // Update auth token if it wasn't available during initial creation
                let localAuthToken = ServerManager.shared.bunServer?.localToken
                if let localAuthToken {
                    logger.info("🔑 Updating WebRTC manager with newly available auth token")
                    // Recreate WebRTC manager with auth token
                    webRTCManager = WebRTCManager(
                        serverURL: serverURL,
                        screencapService: self,
                        localAuthToken: localAuthToken
                    )
                }
            }
        }

        // Connect to signaling server for API handling
        // This allows the browser to make API requests immediately
        do {
            // Ensure WebRTC manager exists
            guard let webRTCManager = self.webRTCManager else {
                logger.error("❌ WebRTC manager not available - cannot connect for API handling")
                throw ScreencapError.webSocketNotConnected
            }

            try await webRTCManager.connectForAPIHandling()
            logger.info("✅ Connected to WebSocket for screencap API handling")
            isWebSocketConnected = true
            isWebSocketConnecting = false

            // Transition to ready state - check current state
            switch stateMachine.currentState {
            case .error:
                stateMachine.processEvent(.errorRecovered)
            case .connecting:
                stateMachine.processEvent(.connectionEstablished)
            case .capturing, .ready:
                // Already in a good state, no transition needed
                logger.info("🔄 WebSocket reconnected while in \(self.stateMachine.currentState) state")
            default:
                logger.warning("⚠️ Unexpected state during WebSocket connection: \(self.stateMachine.currentState)")
            }

            // Resume all waiting continuations
            for continuation in webSocketConnectionContinuations {
                continuation.resume()
            }
            webSocketConnectionContinuations.removeAll()

            // Start monitoring connection
            startConnectionMonitor()
        } catch {
            logger.error("Failed to connect WebSocket for API: \(error)")
            isWebSocketConnecting = false
            isWebSocketConnected = false

            // Transition to error state
            stateMachine.processEvent(.connectionFailed(error))

            // Fail all waiting continuations
            for continuation in webSocketConnectionContinuations {
                continuation.resume(throwing: error)
            }
            webSocketConnectionContinuations.removeAll()

            // Schedule reconnection
            scheduleReconnection()
        }
    }

    /// Start monitoring the WebSocket connection
    private func startConnectionMonitor() {
        // Cancel any existing monitor
        reconnectTask?.cancel()

        reconnectTask = Task { [weak self] in
            guard let self else { return }

            while !Task.isCancelled && shouldReconnect {
                try? await Task.sleep(nanoseconds: 5_000_000_000) // 5 seconds

                // Check if still connected
                if let webRTCManager = self.webRTCManager {
                    let connected = webRTCManager.isConnected
                    if !connected && self.isWebSocketConnected {
                        logger.warning("⚠️ WebSocket disconnected, marking as disconnected")
                        self.isWebSocketConnected = false
                        self.scheduleReconnection()
                    }
                }
            }
        }
    }

    /// Schedule a reconnection attempt
    private func scheduleReconnection() {
        guard shouldReconnect else { return }

        Task { [weak self] in
            guard let self else { return }

            // Wait before reconnecting (exponential backoff could be added here)
            logger.info("⏳ Scheduling reconnection in 2 seconds...")
            try? await Task.sleep(nanoseconds: 2_000_000_000) // 2 seconds

            if !self.isWebSocketConnected && self.shouldReconnect {
                logger.info("🔄 Attempting to reconnect WebSocket...")
                await self.setupWebSocketForAPIHandling()
            }
        }
    }

    // MARK: - Public Methods

    /// Handle WebSocket disconnection notification
    public func handleWebSocketDisconnection() async {
        logger.warning("⚠️ WebSocket disconnected, will attempt to reconnect")
        isWebSocketConnected = false
        scheduleReconnection()
    }

    /// Ensure WebSocket connection is established
    public func ensureWebSocketConnected() async throws {
        if !isWebSocketConnected && !isWebSocketConnecting {
            await setupWebSocketForAPIHandling()
        }

        // Wait for connection to complete if still connecting
        if isWebSocketConnecting && !isWebSocketConnected {
            try await withCheckedThrowingContinuation { continuation in
                webSocketConnectionContinuations.append(continuation)
            }
        }

        // Verify we're actually connected now
        guard isWebSocketConnected else {
            throw ScreencapError.webSocketNotConnected
        }
    }

    /// Test method to debug SCShareableContent issues
    func testShareableContent() async {
        logger.info("🧪 Testing SCShareableContent...")

        // Test 1: Check NSScreen
        logger.info("🧪 Test 1: NSScreen.screens")
        let screens = NSScreen.screens
        logger.info("  - Count: \(screens.count)")
        for (i, screen) in screens.enumerated() {
            logger.info("  - Screen \(i): \(screen.localizedName), frame: \(String(describing: screen.frame))")
        }

        // Test 2: Try SCShareableContent.current
        logger.info("🧪 Test 2: SCShareableContent.current")
        do {
            let currentContent = try await SCShareableContent.current
            logger.info("  - Displays: \(currentContent.displays.count)")
            logger.info("  - Windows: \(currentContent.windows.count)")
            for (i, display) in currentContent.displays.enumerated() {
                logger
                    .info(
                        "  - Display \(i): frame=\(String(describing: display.frame)), size=\(display.width)x\(display.height)"
                    )
            }
        } catch {
            logger.error("  - Failed: \(error)")
        }

        // Test 3: Try excludingDesktopWindows with different parameters
        logger.info("🧪 Test 3: SCShareableContent.excludingDesktopWindows(false, false)")
        do {
            let content1 = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)
            logger.info("  - Displays: \(content1.displays.count)")
            logger.info("  - Windows: \(content1.windows.count)")
        } catch {
            logger.error("  - Failed: \(error)")
        }

        // Test 4: Try excludingDesktopWindows with true, true
        logger.info("🧪 Test 4: SCShareableContent.excludingDesktopWindows(true, true)")
        do {
            let content2 = try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: true)
            logger.info("  - Displays: \(content2.displays.count)")
            logger.info("  - Windows: \(content2.windows.count)")
        } catch {
            logger.error("  - Failed: \(error)")
        }
    }

    /// Get all available displays
    func getDisplays() async throws -> [DisplayInfo] {
        logger.info("🔍 getDisplays() called")

        // First check NSScreen to see what the system reports
        let nsScreens = NSScreen.screens
        logger.info("🖥️ NSScreen.screens count: \(nsScreens.count)")
        for (index, screen) in nsScreens.enumerated() {
            logger.info("🖥️ NSScreen \(index): \(screen.localizedName), frame: \(String(describing: screen.frame))")
        }

        // Use SCShareableContent to ensure consistency with capture
        logger.info("🔍 Calling SCShareableContent.excludingDesktopWindows...")
        let content: SCShareableContent
        do {
            content = try await SCShareableContent.excludingDesktopWindows(
                false,
                onScreenWindowsOnly: false
            )
            logger.info("✅ SCShareableContent returned successfully")
            logger.info("📺 SCShareableContent displays count: \(content.displays.count)")
            logger.info("🪟 SCShareableContent windows count: \(content.windows.count)")
        } catch {
            logger.error("❌ SCShareableContent.excludingDesktopWindows failed: \(error)")
            throw error
        }

        guard !content.displays.isEmpty else {
            logger.error("❌ No displays found in SCShareableContent, trying NSScreen fallback")

            // Fallback to NSScreen when SCShareableContent fails
            let nsScreens = NSScreen.screens
            if nsScreens.isEmpty {
                logger.error("❌ No displays found in NSScreen either")
                throw ScreencapError.noDisplay
            }

            logger.warning("⚠️ Using NSScreen fallback - found \(nsScreens.count) displays")

            // Create DisplayInfo from NSScreen data
            var displayInfos: [DisplayInfo] = []
            for (index, screen) in nsScreens.enumerated() {
                let displayInfo = DisplayInfo(
                    id: "NSScreen-\(index)",
                    width: Int(screen.frame.width),
                    height: Int(screen.frame.height),
                    scaleFactor: screen.backingScaleFactor,
                    refreshRate: 60.0, // NSScreen doesn't provide refresh rate
                    x: Double(screen.frame.origin.x),
                    y: Double(screen.frame.origin.y),
                    name: screen.localizedName
                )
                displayInfos.append(displayInfo)
            }

            return displayInfos
        }

        logger.info("📺 Found \(content.displays.count) displays")

        var displayInfos: [DisplayInfo] = []

        for (index, display) in content.displays.enumerated() {
            // Log display details for debugging
            logger
                .debug(
                    "📺 SCDisplay \(index): frame=\(String(describing: display.frame)), width=\(display.width), height=\(display.height)"
                )

            // Log all NSScreen frames for comparison
            for (screenIndex, screen) in NSScreen.screens.enumerated() {
                let screenName = screen.localizedName
                logger.debug("🖥️ NSScreen \(screenIndex): frame=\(String(describing: screen.frame)), name=\(screenName)")
            }

            // Try to find corresponding NSScreen for additional info
            // First attempt: try direct matching
            var nsScreen = NSScreen.screens.first { screen in
                // Match by frame - SCDisplay and NSScreen should have the same frame
                let xMatch = abs(screen.frame.origin.x - display.frame.origin.x) < 1.0
                let yMatch = abs(screen.frame.origin.y - display.frame.origin.y) < 1.0
                let widthMatch = abs(screen.frame.width - display.frame.width) < 1.0
                let heightMatch = abs(screen.frame.height - display.frame.height) < 1.0

                let matches = xMatch && yMatch && widthMatch && heightMatch
                if matches {
                    let screenName = screen.localizedName
                    logger.debug("✅ Matched SCDisplay \(index) with NSScreen: \(screenName)")
                }
                return matches
            }

            // If no match found, try matching by size only (position might be different)
            if nsScreen == nil {
                nsScreen = NSScreen.screens.first { screen in
                    let widthMatch = abs(screen.frame.width - display.frame.width) < 1.0
                    let heightMatch = abs(screen.frame.height - display.frame.height) < 1.0

                    let matches = widthMatch && heightMatch
                    if matches {
                        let screenName = screen.localizedName
                        logger.debug("✅ Matched SCDisplay \(index) with NSScreen by size: \(screenName)")
                    }
                    return matches
                }
            }

            let name = nsScreen?.localizedName ?? "Display \(index + 1)"
            logger.info("📍 Display \(index): '\(name)' - size: \(display.width)x\(display.height)")

            let displayInfo = DisplayInfo(
                id: "\(index)",
                width: Int(display.width),
                height: Int(display.height),
                scaleFactor: Double(nsScreen?.backingScaleFactor ?? 2.0),
                refreshRate: Double(nsScreen?.maximumFramesPerSecond ?? 60),
                x: display.frame.origin.x,
                y: display.frame.origin.y,
                name: name
            )

            displayInfos.append(displayInfo)
        }

        return displayInfos
    }

    /// Get current display information (for backward compatibility)
    func getDisplayInfo() async throws -> DisplayInfo {
        let displays = try await getDisplays()
        guard let mainDisplay = displays.first else {
            throw ScreencapError.noDisplay
        }
        return mainDisplay
    }

    /// Get process groups with their windows
    func getProcessGroups() async throws -> [ProcessGroup] {
        logger.info("🔍 getProcessGroups called")

        // First check screen recording permission
        let hasPermission = await isScreenRecordingAllowed()
        logger.info("🔍 Screen recording permission check: \(hasPermission)")

        // Add timeout to detect if SCShareableContent is hanging
        let startTime = Date()
        defer {
            let elapsed = Date().timeIntervalSince(startTime)
            logger.info("🔍 getProcessGroups completed in \(elapsed) seconds")
        }

        logger.info("🔍 About to call SCShareableContent.excludingDesktopWindows")
        logger.info("🔍 Current thread: \(Thread.current)")
        logger.info("🔍 Main thread: \(Thread.isMainThread)")

        // Try to get shareable content with better error handling
        let content: SCShareableContent
        do {
            // Simple direct call with better error handling
            logger.info("🔍 Calling SCShareableContent.excludingDesktopWindows directly...")
            content = try await SCShareableContent.excludingDesktopWindows(
                false,
                onScreenWindowsOnly: false
            )
            logger.info("🔍 Got shareable content with \(content.windows.count) windows")
        } catch {
            logger.error("❌ Failed to get shareable content: \(error)")
            logger.error("❌ Error type: \(type(of: error))")
            logger.error("❌ Error description: \(error.localizedDescription)")

            if let nsError = error as NSError? {
                logger.error("❌ Error domain: \(nsError.domain)")
                logger.error("❌ Error code: \(nsError.code)")
                logger.error("❌ Error userInfo: \(nsError.userInfo)")
            }

            // Try alternative method
            logger.info("🔍 Trying SCShareableContent.current as fallback...")
            do {
                content = try await SCShareableContent.current
                logger.info("🔍 Got shareable content via .current with \(content.windows.count) windows")
            } catch {
                logger.error("❌ Fallback also failed: \(error)")
                throw ScreencapError.failedToGetContent(error)
            }
        }

        // Filter windows first
        let filteredWindows = content.windows.filter { window in
            // Skip windows that are not on screen
            guard window.isOnScreen else { return false }

            // Skip windows with zero size
            guard window.frame.width > 0 && window.frame.height > 0 else { return false }

            // Skip very small windows (less than 100x100 pixels)
            // These are often invisible utility windows or focus proxies
            guard window.frame.width >= 100 && window.frame.height >= 100 else {
                logger
                    .debug(
                        "Filtering out small window: \(window.title ?? "Untitled") - size: \(window.frame.width)x\(window.frame.height)"
                    )
                return false
            }

            // Skip system windows
            if let appName = window.owningApplication?.applicationName {
                let systemApps = [
                    "Window Server",
                    "WindowManager",
                    "Dock",
                    "SystemUIServer",
                    "Control Center",
                    "Notification Center",
                    "Spotlight",
                    "AXUIElement", // Accessibility UI elements
                    "Desktop" // Filter out Desktop entries
                ]

                if systemApps.contains(appName) {
                    return false
                }

                // Skip VibeTunnel itself
                if appName.lowercased().contains("vibetunnel") {
                    return false
                }
            }

            // Skip windows with certain titles
            if let title = window.title {
                if title.contains("Event Tap") ||
                    title.contains("Shield") ||
                    title.isEmpty || // Skip windows with empty titles
                    title == "Focus Proxy" || // Common invisible window
                    title == "Menu Bar" ||
                    title == "Desktop" // Skip Desktop windows
                {
                    return false
                }
            }

            return true
        }

        logger.info("🔍 Filtered to \(filteredWindows.count) windows")

        // Group windows by process
        let groupedWindows = Dictionary(grouping: filteredWindows) { window in
            window.owningApplication?.processID ?? 0
        }

        logger.info("🔍 Grouped into \(groupedWindows.count) process groups")

        // Convert to ProcessGroups
        // OPTIMIZATION: Skip icon loading for now to avoid timeout
        let processGroups = groupedWindows.compactMap { _, windows -> ProcessGroup? in
            guard let firstWindow = windows.first,
                  let app = firstWindow.owningApplication else { return nil }

            let windowInfos = windows.map { window in
                WindowInfo(
                    cgWindowID: Int(window.windowID),
                    title: window.title,
                    x: window.frame.origin.x,
                    y: window.frame.origin.y,
                    width: window.frame.width,
                    height: window.frame.height
                )
            }

            return ProcessGroup(
                processName: app.applicationName,
                pid: app.processID,
                bundleIdentifier: app.bundleIdentifier,
                iconData: getCachedAppIcon(for: app.processID),
                windows: windowInfos
            )
        }

        // Sort by largest window area (descending) - processes with bigger windows appear first
        return processGroups.sorted { group1, group2 in
            // Find the largest window area in each process group
            let maxArea1 = group1.windows.map { $0.width * $0.height }.max() ?? 0
            let maxArea2 = group2.windows.map { $0.width * $0.height }.max() ?? 0

            // Sort by area descending (larger windows first)
            return maxArea1 > maxArea2
        }
    }

    /// Check if screen recording permission is granted
    private func isScreenRecordingAllowed() async -> Bool {
        // Use ScreenCaptureKit to check permission instead of deprecated CGDisplayCreateImage
        do {
            // Try to get shareable content - this will fail if no permission
            _ = try await SCShareableContent.current
            logger.info("✅ Screen recording permission is granted")
            return true
        } catch {
            logger.warning("❌ Screen recording permission check failed: \(error)")
            return false
        }
    }

    /// Get cached application icon or load it if not cached
    private func getCachedAppIcon(for pid: Int32) -> String? {
        // Check cache first
        if let cachedIcon = iconCache[pid] {
            return cachedIcon
        }

        // Load icon and cache it
        let icon = getAppIcon(for: pid)
        iconCache[pid] = icon
        return icon
    }

    /// Get application icon as base64 encoded PNG
    private func getAppIcon(for pid: Int32) -> String? {
        let startTime = Date()
        defer {
            let elapsed = Date().timeIntervalSince(startTime)
            logger.info("⏱️ getAppIcon for PID \(pid) took \(elapsed) seconds")
        }

        guard let app = NSRunningApplication(processIdentifier: pid),
              let icon = app.icon
        else {
            logger.info("⚠️ No icon found for PID \(pid)")
            return nil
        }

        // Resize icon to reasonable size (32x32 for retina displays)
        let targetSize = NSSize(width: 32, height: 32)
        let resizedIcon = NSImage(size: targetSize)

        resizedIcon.lockFocus()
        NSGraphicsContext.current?.imageInterpolation = .high
        icon.draw(
            in: NSRect(origin: .zero, size: targetSize),
            from: NSRect(origin: .zero, size: icon.size),
            operation: .copy,
            fraction: 1.0
        )
        resizedIcon.unlockFocus()

        // Convert to PNG
        guard let tiffData = resizedIcon.tiffRepresentation,
              let bitmap = NSBitmapImageRep(data: tiffData),
              let pngData = bitmap.representation(using: .png, properties: [:])
        else {
            logger.error("❌ Failed to convert icon to PNG for PID \(pid)")
            return nil
        }

        return pngData.base64EncodedString()
    }

    /// Start capture with specified mode
    func startCapture(type: String, index: Int, useWebRTC: Bool = false, use8k: Bool = false) async throws {
        logger.info("🎬 Starting capture - type: \(type), index: \(index), WebRTC: \(useWebRTC), 8K: \(use8k)")

        // Check screen recording permission first
        let hasPermission = await isScreenRecordingAllowed()
        logger.info("🔒 Screen recording permission: \(hasPermission)")
        if !hasPermission {
            logger.error("❌ No screen recording permission!")
            logger.error("💡 Please grant Screen Recording permission in:")
            logger.error("   System Settings > Privacy & Security > Screen Recording > VibeTunnel")
        }

        // Stop any existing capture first to ensure clean state
        await stopCapture()

        // Ensure WebSocket is connected first
        try await ensureWebSocketConnected()

        // Check if we can start capture
        guard stateMachine.canPerformAction(.startCapture) else {
            logger.error("Cannot start capture in state: \(self.stateMachine.currentState)")
            throw ScreencapError.serviceNotReady
        }

        self.useWebRTC = useWebRTC

        // Determine capture mode for state machine
        let captureMode: CaptureMode = switch type {
        case "desktop":
            if index == -1 {
                .allDisplays
            } else {
                .desktop(displayIndex: index)
            }
        case "window":
            // For window capture, we'll need to select the window later
            // Use desktop mode as a placeholder until window is selected
            .desktop(displayIndex: 0)
        default:
            .desktop(displayIndex: 0)
        }

        // Transition to starting state
        stateMachine.processEvent(.startCapture(mode: captureMode, useWebRTC: useWebRTC))

        logger.debug("Requesting shareable content...")
        let content: SCShareableContent
        do {
            content = try await SCShareableContent.current
            logger
                .info(
                    "Got shareable content - displays: \(content.displays.count), windows: \(content.windows.count), apps: \(content.applications.count)"
                )
        } catch {
            logger.error("Failed to get shareable content: \(error)")
            throw ScreencapError.failedToGetContent(error)
        }

        // Determine capture mode
        switch type {
        case "desktop":
            // Check if index is -1 which means all displays
            if index == -1 {
                // Capture all displays
                guard let primaryDisplay = content.displays.first else {
                    throw ScreencapError.noDisplay
                }

                self.captureMode = .allDisplays
                currentDisplayIndex = -1

                logger.info("🖥️ Setting up all displays capture mode")
                logger.info("  Primary display: size=\(primaryDisplay.width)x\(primaryDisplay.height)")
                logger.info("  Total displays: \(content.displays.count)")

                // For all displays, capture everything including menu bar
                logger.info("🔍 Creating content filter for all displays including menu bar")

                // Create filter that includes the entire display content.
                captureFilter = SCContentFilter(display: primaryDisplay, excludingWindows: [])

                logger.info("✅ Created content filter for all displays capture including system UI")
            } else {
                // Single display capture
                let displayIndex = index < content.displays.count ? index : 0
                guard displayIndex < content.displays.count else {
                    throw ScreencapError.noDisplay
                }
                let display = content.displays[displayIndex]
                self.captureMode = .desktop(displayIndex: displayIndex)
                currentDisplayIndex = displayIndex

                // Log display selection for debugging
                logger
                    .info(
                        "📺 Capturing display \(displayIndex) of \(content.displays.count) - size: \(display.width)x\(display.height)"
                    )

                // Create filter to capture entire display including menu bar
                captureFilter = SCContentFilter(display: display, excludingWindows: [])
            }

        case "window":
            guard index < content.windows.count else {
                throw ScreencapError.invalidWindowIndex
            }
            let window = content.windows[index]
            selectedWindow = window
            self.captureMode = .window(window)

            logger
                .info(
                    "🪟 Capturing window: '\(window.title ?? "Untitled")' - size: \(window.frame.width)x\(window.frame.height)"
                )

            // For window capture, we need to find which display contains this window
            let windowDisplay = content.displays.first { display in
                // Check if window's frame intersects with display's frame
                display.frame.intersects(window.frame)
            } ?? content.displays.first

            guard let display = windowDisplay else {
                throw ScreencapError.noDisplay
            }

            // Create a filter that includes just the single window on its display.
            // This is the most reliable way to capture a single window.
            captureFilter = SCContentFilter(display: display, including: [window])

        case "application":
            guard index < content.applications.count else {
                throw ScreencapError.invalidApplicationIndex
            }
            let app = content.applications[index]
            self.captureMode = .application(app)

            // Get all windows for this application
            let appWindows = content.windows.filter { window in
                window.owningApplication?.processID == app.processID && window.isOnScreen && window.frame
                    .width > 1 && window.frame.height > 1
            }

            guard !appWindows.isEmpty else {
                logger.warning("No capturable windows found for application: \(app.applicationName)")
                throw ScreencapError.windowNotFound(0)
            }

            // Determine which display to use. Find the display that contains the largest window of the app.
            let largestWindow = appWindows.max { $0.frame.width * $0.frame.height < $1.frame.width * $1.frame.height }
            let displayForCapture = content.displays.first { $0.frame.intersects(largestWindow?.frame ?? .zero) }

            guard let display = displayForCapture else {
                throw ScreencapError.noDisplay
            }

            // Create a filter that includes all windows of the application on the chosen display.
            captureFilter = SCContentFilter(display: display, including: appWindows)
            logger
                .info(
                    "Capturing application \(app.applicationName) with \(appWindows.count) windows on display \(display.displayID)"
                )

        default:
            throw ScreencapError.invalidCaptureType
        }

        // Configure stream
        guard let filter = captureFilter else {
            logger.error("Capture filter is nil")
            throw ScreencapError.invalidConfiguration
        }

        let streamConfig = SCStreamConfiguration()

        // For all displays mode, calculate the combined dimensions
        if case .allDisplays = captureMode {
            // Calculate the bounding rectangle that encompasses all displays
            var minX = CGFloat.greatestFiniteMagnitude
            var minY = CGFloat.greatestFiniteMagnitude
            var maxX: CGFloat = -CGFloat.greatestFiniteMagnitude
            var maxY: CGFloat = -CGFloat.greatestFiniteMagnitude

            logger.info("🖥️ Calculating bounds for \(content.displays.count) displays:")
            for (index, display) in content.displays.enumerated() {
                logger
                    .info(
                        "  Display \(index): origin=(\(display.frame.origin.x), \(display.frame.origin.y)), size=\(display.frame.width)x\(display.frame.height)"
                    )
                minX = min(minX, display.frame.origin.x)
                minY = min(minY, display.frame.origin.y)
                maxX = max(maxX, display.frame.origin.x + display.frame.width)
                maxY = max(maxY, display.frame.origin.y + display.frame.height)
            }

            let totalWidth = maxX - minX
            let totalHeight = maxY - minY

            logger.info("📐 Combined display bounds: origin=(\(minX), \(minY)), size=\(totalWidth)x\(totalHeight)")

            streamConfig.width = Int(totalWidth)
            streamConfig.height = Int(totalHeight)
            streamConfig.sourceRect = CGRect(x: minX, y: minY, width: totalWidth, height: totalHeight)
            streamConfig.destinationRect = CGRect(x: 0, y: 0, width: totalWidth, height: totalHeight)

            logger
                .info(
                    "📐 Stream config: sourceRect = (\(minX), \(minY), \(totalWidth), \(totalHeight)), destinationRect = (0, 0, \(totalWidth), \(totalHeight))"
                )
        } else if case .window(let window) = captureMode {
            // For window capture, use the window's bounds
            // Note: The window frame might need to be scaled for Retina displays
            let scaleFactor = NSScreen.main?.backingScaleFactor ?? 2.0
            streamConfig.width = Int(window.frame.width * scaleFactor)
            streamConfig.height = Int(window.frame.height * scaleFactor)
            logger
                .info(
                    "🪟 Window stream config - size: \(streamConfig.width)x\(streamConfig.height) (scale: \(scaleFactor))"
                )
        } else if case .desktop(let displayIndex) = captureMode {
            // For desktop capture, use the display dimensions and set proper rects
            if displayIndex >= 0 && displayIndex < content.displays.count {
                let display = content.displays[displayIndex]
                streamConfig.width = Int(display.width)
                streamConfig.height = Int(display.height)

                // Set source rect to capture the entire display including menu bar and dock
                streamConfig.sourceRect = CGRect(x: 0, y: 0, width: display.width, height: display.height)
                streamConfig.destinationRect = CGRect(x: 0, y: 0, width: display.width, height: display.height)

                let sourceRectStr = String(describing: streamConfig.sourceRect)
                let destRectStr = String(describing: streamConfig.destinationRect)
                logger
                    .info(
                        "🖥️ Desktop stream config - display: \(streamConfig.width)x\(streamConfig.height), sourceRect: \(sourceRectStr), destRect: \(destRectStr)"
                    )
            } else {
                streamConfig.width = Int(filter.contentRect.width)
                streamConfig.height = Int(filter.contentRect.height)
            }
        } else if case .application(let app) = captureMode {
            // For application capture, calculate the bounding box of all its windows.
            let appWindows = content.windows
                .filter { $0.owningApplication?.processID == app.processID && $0.isOnScreen }
            if !appWindows.isEmpty {
                var unionRect = CGRect.null
                for window in appWindows {
                    unionRect = unionRect.union(window.frame)
                }

                // Set the stream to capture the exact bounding box of the application's windows.
                streamConfig.sourceRect = unionRect
                streamConfig.width = Int(unionRect.width)
                streamConfig.height = Int(unionRect.height)
                logger
                    .info(
                        "App capture rect: origin=(\(unionRect.origin.x), \(unionRect.origin.y)), size=(\(unionRect.width)x\(unionRect.height))"
                    )
            } else {
                // Fallback if no windows are found, though we've checked this already.
                streamConfig.width = 1
                streamConfig.height = 1
            }
        }

        // Basic configuration
        streamConfig.minimumFrameInterval = CMTime(value: 1, timescale: 30) // 30 FPS
        streamConfig.queueDepth = 5
        streamConfig.showsCursor = true
        streamConfig.capturesAudio = false

        // CRITICAL: Set pixel format to get raw frames
        streamConfig.pixelFormat = kCVPixelFormatType_32BGRA

        // Configure scaling behavior
        if case .allDisplays = captureMode {
            // For all displays, we want to capture the full virtual desktop
            streamConfig.scalesToFit = true
            streamConfig.preservesAspectRatio = true
            logger.info("📐 All displays mode: scalesToFit=true, preservesAspectRatio=true")
        } else {
            // No scaling for single display/window
            streamConfig.scalesToFit = false
        }

        // Color space
        streamConfig.colorSpaceName = CGColorSpace.sRGB

        logger.info("Stream config - size: \(streamConfig.width)x\(streamConfig.height), fps: 30")

        // Create and start stream
        let stream = SCStream(filter: filter, configuration: streamConfig, delegate: self)
        captureStream = stream

        // Add output and start capture
        do {
            // Add output with dedicated queue for optimal performance
            try stream.addStreamOutput(self, type: .screen, sampleHandlerQueue: sampleHandlerQueue)

            // Log stream output configuration
            logger.info("Added stream output handler for type: .screen")

            try await stream.startCapture()

            isCapturing = true
            logger.info("✅ Successfully started \(type) capture")
            logger.info("📺 Stream is now active and should be producing frames")

            // Transition to capturing state
            stateMachine.processEvent(.captureStarted)

            // Start WebRTC if enabled
            if useWebRTC {
                logger.info("🌐 Starting WebRTC capture...")
                await startWebRTCCapture(use8k: use8k)
            } else {
                logger.info("🖼️ Using JPEG mode (WebRTC disabled)")
            }
        } catch {
            logger.error("Failed to start capture: \(error)")
            captureStream = nil

            // Transition to error state
            stateMachine.processEvent(.captureFailure(error))

            throw ScreencapError.failedToStartCapture(error)
        }
    }

    /// Start capture for a specific window by its cgWindowID
    func startCaptureWindow(cgWindowID: Int, useWebRTC: Bool = false, use8k: Bool = false) async throws {
        logger.info("Starting window capture - cgWindowID: \(cgWindowID), WebRTC: \(useWebRTC), 8K: \(use8k)")

        self.useWebRTC = useWebRTC

        // Stop any existing capture
        await stopCapture()

        logger.debug("Requesting shareable content...")
        let content: SCShareableContent
        do {
            content = try await SCShareableContent.current
            logger
                .info(
                    "Got shareable content - displays: \(content.displays.count), windows: \(content.windows.count), apps: \(content.applications.count)"
                )
        } catch {
            logger.error("Failed to get shareable content: \(error)")
            throw ScreencapError.failedToGetContent(error)
        }

        // Find the window by cgWindowID
        guard let window = content.windows.first(where: { $0.windowID == CGWindowID(cgWindowID) }) else {
            logger.error("Window with cgWindowID \(cgWindowID) not found")
            throw ScreencapError.invalidWindowIndex
        }

        selectedWindow = window
        self.captureMode = .window(window)

        logger
            .info(
                "🪟 Capturing window: '\(window.title ?? "Untitled")' - size: \(window.frame.width)x\(window.frame.height)"
            )

        // Create filter for single window - use a simpler approach
        logger.info("📱 Creating filter for window on display")

        // Create a filter with just the single window
        captureFilter = SCContentFilter(
            desktopIndependentWindow: window
        )

        // Configure stream
        guard let filter = captureFilter else {
            logger.error("Capture filter is nil")
            throw ScreencapError.invalidConfiguration
        }

        let streamConfig = SCStreamConfiguration()

        // For window capture, use the window's bounds
        // Note: The window frame might need to be scaled for Retina displays
        let scaleFactor = NSScreen.main?.backingScaleFactor ?? 2.0
        streamConfig.width = Int(window.frame.width * scaleFactor)
        streamConfig.height = Int(window.frame.height * scaleFactor)
        logger
            .info("🪟 Window stream config - size: \(streamConfig.width)x\(streamConfig.height) (scale: \(scaleFactor))")

        // Basic configuration
        streamConfig.minimumFrameInterval = CMTime(value: 1, timescale: 30) // 30 FPS
        streamConfig.queueDepth = 5
        streamConfig.showsCursor = true
        streamConfig.capturesAudio = false

        // CRITICAL: Set pixel format to get raw frames
        streamConfig.pixelFormat = kCVPixelFormatType_32BGRA

        // No scaling for single window
        streamConfig.scalesToFit = false

        // Color space
        streamConfig.colorSpaceName = CGColorSpace.sRGB

        logger.info("Stream config - size: \(streamConfig.width)x\(streamConfig.height), fps: 30")

        // Create and start stream
        let stream = SCStream(filter: filter, configuration: streamConfig, delegate: self)
        captureStream = stream

        // Add output and start capture
        do {
            // Add output with dedicated queue for optimal performance
            try stream.addStreamOutput(self, type: .screen, sampleHandlerQueue: sampleHandlerQueue)

            // Log stream output configuration
            logger.info("Added stream output handler for type: .screen")

            try await stream.startCapture()

            isCapturing = true
            logger.info("✅ Successfully started window capture")

            // Start WebRTC if enabled
            if useWebRTC {
                logger.info("🌐 Starting WebRTC capture...")
                await startWebRTCCapture(use8k: use8k)
            } else {
                logger.info("🖼️ Using JPEG mode (WebRTC disabled)")
            }
        } catch {
            logger.error("Failed to start capture: \(error)")
            captureStream = nil
            throw ScreencapError.failedToStartCapture(error)
        }
    }

    private func startWebRTCCapture(use8k: Bool) async {
        logger.info("🌐 startWebRTCCapture called")
        do {
            // Get server URL from environment or use default
            let serverPort = UserDefaults.standard.string(forKey: "serverPort") ?? "4020"
            let serverURLString = ProcessInfo.processInfo
                .environment["VIBETUNNEL_SERVER_URL"] ?? "http://localhost:\(serverPort)"
            guard let serverURL = URL(string: serverURLString) else {
                logger.error("Invalid server URL: \(serverURLString)")
                return
            }

            // Check if authentication is disabled
            let authMode = UserDefaults.standard.string(forKey: "authenticationMode") ?? "os"
            let isNoAuth = authMode == "none"

            // Create WebRTC manager with appropriate auth token
            let localAuthToken = isNoAuth ? nil : ServerManager.shared.bunServer?.localToken
            webRTCManager = WebRTCManager(serverURL: serverURL, screencapService: self, localAuthToken: localAuthToken)

            // Set quality before starting
            webRTCManager?.setQuality(use8k: use8k)

            // Start WebRTC capture
            let modeString: String = switch captureMode {
            case .desktop(let index):
                "desktop-\(index)"
            case .allDisplays:
                "all-displays"
            case .window:
                "window"
            case .application:
                "application"
            }
            logger.info("🚀 Calling WebRTC manager startCapture with mode: \(modeString)")
            try await webRTCManager?.startCapture(mode: modeString)

            logger.info("✅ WebRTC capture started successfully")
        } catch {
            logger.error("❌ Failed to start WebRTC capture: \(error)")
            logger.error("🔄 Falling back to JPEG mode")
            // Continue with JPEG mode
            self.useWebRTC = false
        }
    }

    /// Stop current capture
    func stopCapture() async {
        guard isCapturing else { return }

        // Transition to stopping state
        if stateMachine.currentState == .capturing {
            stateMachine.processEvent(.stopCapture)
        }

        // Mark as not capturing first to stop frame processing
        isCapturing = false

        // Store references before clearing
        let stream = captureStream
        let webRTC = webRTCManager

        // Clear references
        captureStream = nil
        currentFrame = nil
        webRTCManager = nil
        frameCounter = 0

        // Wait a bit for any in-flight frames to complete
        try? await Task.sleep(nanoseconds: 100_000_000) // 100ms

        // Stop WebRTC if active
        if let webRTC {
            await webRTC.stopCapture()
        }

        // Stop the stream
        if let stream {
            do {
                try await stream.stopCapture()
                logger.info("Stopped capture")
            } catch {
                logger.error("Failed to stop capture: \(error)")
            }
        }

        // Transition to stopped state
        stateMachine.processEvent(.captureStopped)
    }

    /// Get current captured frame as JPEG data
    func getCurrentFrame() -> Data? {
        logger.info("🖼️ getCurrentFrame() called")
        guard isCapturing else {
            logger.warning("⚠️ Not capturing, cannot get frame")
            return nil
        }

        guard let frame = currentFrame else {
            logger.warning("⚠️ currentFrame is nil, no frame available to send")
            return nil
        }

        logger.info("✅ Frame is available, preparing JPEG data...")
        let ciImage = CIImage(cgImage: frame)
        let context = CIContext()

        // Convert to JPEG with good quality
        guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
              let jpegData = context.jpegRepresentation(
                  of: ciImage,
                  colorSpace: colorSpace,
                  options: [kCGImageDestinationLossyCompressionQuality as CIImageRepresentationOption: 0.8]
              )
        else {
            logger.error("Failed to convert frame to JPEG")
            return nil
        }

        logger.info("✅ JPEG data created successfully (\(jpegData.count) bytes)")
        return jpegData
    }

    /// Get current capture state information
    func getCaptureState() -> (state: String, description: String) {
        (
            state: stateMachine.currentState.rawValue,
            description: stateMachine.stateDescription()
        )
    }

    /// Send click at specified coordinates
    /// - Parameters:
    ///   - x: X coordinate in 0-1000 normalized range
    ///   - y: Y coordinate in 0-1000 normalized range
    ///   - cgWindowID: Optional window ID for window-specific clicks
    func sendClick(x: Double, y: Double, cgWindowID: Int? = nil) async throws {
        // Validate coordinate boundaries
        guard x >= 0 && x <= 1_000 && y >= 0 && y <= 1_000 else {
            logger.error("⚠️ Invalid click coordinates: (\(x), \(y)) - must be in range 0-1000")
            throw ScreencapError.invalidCoordinates(x: x, y: y)
        }

        // Security audit log - include timestamp for tracking
        let timestamp = Date().timeIntervalSince1970
        logger
            .info(
                "🔒 [AUDIT] Click event at \(timestamp): coords=(\(x), \(y)), windowID=\(cgWindowID?.description ?? "nil")"
            )

        logger.info("🖱️ Received click at normalized coordinates: (\(x), \(y))")

        // Get the capture filter to determine actual dimensions
        guard let filter = captureFilter else {
            throw ScreencapError.notCapturing
        }

        // Convert from 0-1000 normalized coordinates to actual pixel coordinates
        let normalizedX = x / 1_000.0
        let normalizedY = y / 1_000.0

        var pixelX: Double
        var pixelY: Double

        // Calculate pixel coordinates based on capture mode
        switch captureMode {
        case .desktop(let displayIndex):
            // Get SCShareableContent to ensure consistency
            let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)

            if displayIndex >= 0 && displayIndex < content.displays.count {
                let display = content.displays[displayIndex]
                // Convert normalized to pixel coordinates within the display
                pixelX = display.frame.origin.x + (normalizedX * display.frame.width)
                pixelY = display.frame.origin.y + (normalizedY * display.frame.height)

                logger
                    .info(
                        "📺 Display \(displayIndex): pixel coords=(\(String(format: "%.1f", pixelX)), \(String(format: "%.1f", pixelY)))"
                    )
            } else {
                throw ScreencapError.noDisplay
            }

        case .allDisplays:
            // For all displays, we need to calculate based on the combined bounds
            let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)

            // Calculate the bounding rectangle
            var minX = CGFloat.greatestFiniteMagnitude
            var minY = CGFloat.greatestFiniteMagnitude
            var maxX: CGFloat = -CGFloat.greatestFiniteMagnitude
            var maxY: CGFloat = -CGFloat.greatestFiniteMagnitude

            for display in content.displays {
                minX = min(minX, display.frame.origin.x)
                minY = min(minY, display.frame.origin.y)
                maxX = max(maxX, display.frame.origin.x + display.frame.width)
                maxY = max(maxY, display.frame.origin.y + display.frame.height)
            }

            let totalWidth = maxX - minX
            let totalHeight = maxY - minY

            // Convert normalized to pixel coordinates within the combined bounds
            pixelX = minX + (normalizedX * totalWidth)
            pixelY = minY + (normalizedY * totalHeight)

            logger
                .info(
                    "🖥️ All displays: pixel coords=(\(String(format: "%.1f", pixelX)), \(String(format: "%.1f", pixelY)))"
                )

        case .window(let window):
            // For window capture, use the window's frame
            pixelX = window.frame.origin.x + (normalizedX * window.frame.width)
            pixelY = window.frame.origin.y + (normalizedY * window.frame.height)

            logger.info("🪟 Window: pixel coords=(\(String(format: "%.1f", pixelX)), \(String(format: "%.1f", pixelY)))")

        case .application:
            // For application capture, use the filter's content rect
            pixelX = filter.contentRect.origin.x + (normalizedX * filter.contentRect.width)
            pixelY = filter.contentRect.origin.y + (normalizedY * filter.contentRect.height)
        }

        // CGEvent uses screen coordinates which have top-left origin, same as our pixel coordinates
        let clickLocation = CGPoint(x: pixelX, y: pixelY)

        logger
            .info(
                "🎯 Final click location: (\(String(format: "%.1f", clickLocation.x)), \(String(format: "%.1f", clickLocation.y)))"
            )

        // Create mouse down event
        guard let mouseDown = CGEvent(
            mouseEventSource: nil,
            mouseType: .leftMouseDown,
            mouseCursorPosition: clickLocation,
            mouseButton: .left
        ) else {
            throw ScreencapError.failedToCreateEvent
        }

        // Create mouse up event
        guard let mouseUp = CGEvent(
            mouseEventSource: nil,
            mouseType: .leftMouseUp,
            mouseCursorPosition: clickLocation,
            mouseButton: .left
        ) else {
            throw ScreencapError.failedToCreateEvent
        }

        // Post events
        mouseDown.post(tap: .cghidEventTap)
        try await Task.sleep(nanoseconds: 50_000_000) // 50ms delay
        mouseUp.post(tap: .cghidEventTap)

        logger.info("✅ Click sent successfully")
    }

    /// Send mouse down event at specified coordinates
    /// - Parameters:
    ///   - x: X coordinate in 0-1000 normalized range
    ///   - y: Y coordinate in 0-1000 normalized range
    func sendMouseDown(x: Double, y: Double) async throws {
        // Validate coordinate boundaries
        guard x >= 0 && x <= 1_000 && y >= 0 && y <= 1_000 else {
            logger.error("⚠️ Invalid mouse down coordinates: (\(x), \(y)) - must be in range 0-1000")
            throw ScreencapError.invalidCoordinates(x: x, y: y)
        }

        // Security audit log
        let timestamp = Date().timeIntervalSince1970
        logger.info("🔒 [AUDIT] Mouse down event at \(timestamp): coords=(\(x), \(y))")

        logger.info("🖱️ Received mouse down at normalized coordinates: (\(x), \(y))")

        // Calculate pixel coordinates (reuse the conversion logic)
        let clickLocation = try await calculateClickLocation(x: x, y: y)

        // Create mouse down event
        guard let mouseDown = CGEvent(
            mouseEventSource: nil,
            mouseType: .leftMouseDown,
            mouseCursorPosition: clickLocation,
            mouseButton: .left
        ) else {
            throw ScreencapError.failedToCreateEvent
        }

        // Post event
        mouseDown.post(tap: .cghidEventTap)

        logger.info("✅ Mouse down sent successfully")
    }

    /// Send mouse move (drag) event at specified coordinates
    /// - Parameters:
    ///   - x: X coordinate in 0-1000 normalized range
    ///   - y: Y coordinate in 0-1000 normalized range
    func sendMouseMove(x: Double, y: Double) async throws {
        // Validate coordinate boundaries
        guard x >= 0 && x <= 1_000 && y >= 0 && y <= 1_000 else {
            logger.error("⚠️ Invalid mouse move coordinates: (\(x), \(y)) - must be in range 0-1000")
            throw ScreencapError.invalidCoordinates(x: x, y: y)
        }

        // Calculate pixel coordinates
        let moveLocation = try await calculateClickLocation(x: x, y: y)

        // Create mouse dragged event
        guard let mouseDrag = CGEvent(
            mouseEventSource: nil,
            mouseType: .leftMouseDragged,
            mouseCursorPosition: moveLocation,
            mouseButton: .left
        ) else {
            throw ScreencapError.failedToCreateEvent
        }

        // Post event
        mouseDrag.post(tap: .cghidEventTap)
    }

    /// Send mouse up event at specified coordinates
    /// - Parameters:
    ///   - x: X coordinate in 0-1000 normalized range
    ///   - y: Y coordinate in 0-1000 normalized range
    func sendMouseUp(x: Double, y: Double) async throws {
        // Validate coordinate boundaries
        guard x >= 0 && x <= 1_000 && y >= 0 && y <= 1_000 else {
            logger.error("⚠️ Invalid mouse up coordinates: (\(x), \(y)) - must be in range 0-1000")
            throw ScreencapError.invalidCoordinates(x: x, y: y)
        }

        // Security audit log
        let timestamp = Date().timeIntervalSince1970
        logger.info("🔒 [AUDIT] Mouse up event at \(timestamp): coords=(\(x), \(y))")

        logger.info("🖱️ Received mouse up at normalized coordinates: (\(x), \(y))")

        // Calculate pixel coordinates
        let clickLocation = try await calculateClickLocation(x: x, y: y)

        // Create mouse up event
        guard let mouseUp = CGEvent(
            mouseEventSource: nil,
            mouseType: .leftMouseUp,
            mouseCursorPosition: clickLocation,
            mouseButton: .left
        ) else {
            throw ScreencapError.failedToCreateEvent
        }

        // Post event
        mouseUp.post(tap: .cghidEventTap)

        logger.info("✅ Mouse up sent successfully")
    }

    /// Calculate pixel location from normalized coordinates
    private func calculateClickLocation(x: Double, y: Double) async throws -> CGPoint {
        // Get the capture filter to determine actual dimensions
        guard let filter = captureFilter else {
            throw ScreencapError.notCapturing
        }

        // Convert from 0-1000 normalized coordinates to actual pixel coordinates
        let normalizedX = x / 1_000.0
        let normalizedY = y / 1_000.0

        var pixelX: Double
        var pixelY: Double

        // Calculate pixel coordinates based on capture mode
        switch captureMode {
        case .desktop(let displayIndex):
            // Get SCShareableContent to ensure consistency
            let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)

            if displayIndex >= 0 && displayIndex < content.displays.count {
                let display = content.displays[displayIndex]
                // Convert normalized to pixel coordinates within the display
                pixelX = display.frame.origin.x + (normalizedX * display.frame.width)
                pixelY = display.frame.origin.y + (normalizedY * display.frame.height)
            } else {
                throw ScreencapError.noDisplay
            }

        case .allDisplays:
            // For all displays, we need to calculate based on the combined bounds
            let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)

            // Calculate the bounding rectangle
            var minX = CGFloat.greatestFiniteMagnitude
            var minY = CGFloat.greatestFiniteMagnitude
            var maxX: CGFloat = -CGFloat.greatestFiniteMagnitude
            var maxY: CGFloat = -CGFloat.greatestFiniteMagnitude

            for display in content.displays {
                minX = min(minX, display.frame.origin.x)
                minY = min(minY, display.frame.origin.y)
                maxX = max(maxX, display.frame.origin.x + display.frame.width)
                maxY = max(maxY, display.frame.origin.y + display.frame.height)
            }

            let totalWidth = maxX - minX
            let totalHeight = maxY - minY

            // Convert normalized to pixel coordinates within the combined bounds
            pixelX = minX + (normalizedX * totalWidth)
            pixelY = minY + (normalizedY * totalHeight)

        case .window(let window):
            // For window capture, use the window's frame
            pixelX = window.frame.origin.x + (normalizedX * window.frame.width)
            pixelY = window.frame.origin.y + (normalizedY * window.frame.height)

        case .application:
            // For application capture, use the filter's content rect
            pixelX = filter.contentRect.origin.x + (normalizedX * filter.contentRect.width)
            pixelY = filter.contentRect.origin.y + (normalizedY * filter.contentRect.height)
        }

        // CGEvent uses screen coordinates which have top-left origin, same as our pixel coordinates
        return CGPoint(x: pixelX, y: pixelY)
    }

    /// Send keyboard input
    func sendKey(
        key: String,
        metaKey: Bool = false,
        ctrlKey: Bool = false,
        altKey: Bool = false,
        shiftKey: Bool = false
    )
        async throws
    {
        // Validate key input
        guard !key.isEmpty && key.count <= 20 else {
            logger.error("⚠️ Invalid key input: '\(key)' - must be non-empty and <= 20 characters")
            throw ScreencapError.invalidKeyInput(key)
        }

        // Security audit log - include timestamp for tracking
        let timestamp = Date().timeIntervalSince1970
        logger
            .info(
                "🔒 [AUDIT] Key event at \(timestamp): key='\(key)', modifiers=[cmd:\(metaKey), ctrl:\(ctrlKey), alt:\(altKey), shift:\(shiftKey)]"
            )

        // Convert key string to key code
        let keyCode = keyStringToKeyCode(key)

        // Create key down event
        guard let keyDown = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: true) else {
            throw ScreencapError.failedToCreateEvent
        }

        // Create key up event
        guard let keyUp = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: false) else {
            throw ScreencapError.failedToCreateEvent
        }

        // Set modifier flags
        var flags: CGEventFlags = []
        if metaKey { flags.insert(.maskCommand) }
        if ctrlKey { flags.insert(.maskControl) }
        if altKey { flags.insert(.maskAlternate) }
        if shiftKey { flags.insert(.maskShift) }

        keyDown.flags = flags
        keyUp.flags = flags

        // Post events
        keyDown.post(tap: .cghidEventTap)
        try await Task.sleep(nanoseconds: 50_000_000) // 50ms delay
        keyUp.post(tap: .cghidEventTap)

        logger.info("Sent key: \(key) with modifiers")
    }

    // MARK: - State Machine Setup

    /// Configure state machine callbacks
    private func setupStateMachine() {
        stateMachine.onStateChange = { [weak self] newState, previousState in
            guard let self else { return }
            self.logger.info("📊 State changed: \(previousState?.description ?? "nil") → \(newState)")

            // Notify WebRTC manager of state changes
            if let webRTCManager = self.webRTCManager {
                Task {
                    await webRTCManager.sendSignalMessage([
                        "type": "state-change",
                        "state": newState.rawValue,
                        "previousState": previousState?.rawValue as Any
                    ])
                }
            }
        }
    }

    // MARK: - Display Monitoring

    /// Set up notifications for display configuration changes
    private func setupDisplayNotifications() {
        // Monitor for display configuration changes
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(displayConfigurationChanged),
            name: NSApplication.didChangeScreenParametersNotification,
            object: nil
        )

        logger.info("📺 Display monitoring enabled")
    }

    /// Handle display configuration changes
    @objc
    private func displayConfigurationChanged(_ notification: Notification) {
        logger.warning("⚠️ Display configuration changed")

        // Check if we're currently capturing
        guard isCapturing else {
            logger.info("Not capturing, ignoring display change")
            return
        }

        Task { @MainActor in
            await handleDisplayChange()
        }
    }

    /// Handle display disconnection or reconfiguration during capture
    private func handleDisplayChange() async {
        logger.info("🔄 Handling display configuration change during capture")

        // Transition to reconnecting state
        stateMachine.processEvent(.displayChanged)

        // Get current capture mode
        let captureMode = self.captureMode

        // Stop current capture
        await stopCapture()

        // Wait a moment for the system to stabilize
        try? await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds

        do {
            // Check if displays are still available
            let displays = try await getDisplays()

            switch captureMode {
            case .desktop(let displayIndex):
                // Check if the display index is still valid
                if displayIndex < displays.count {
                    // Restart capture with same display
                    logger.info("✅ Display \(displayIndex) still available, restarting capture")
                    try await startCapture(type: "display", index: displayIndex, useWebRTC: useWebRTC)
                } else if !displays.isEmpty {
                    // Fall back to primary display
                    logger.warning("⚠️ Display \(displayIndex) no longer available, falling back to primary display")
                    try await startCapture(type: "display", index: 0, useWebRTC: useWebRTC)
                } else {
                    logger.error("❌ No displays available after configuration change")
                    // Notify connected clients
                    await notifyDisplayDisconnected()
                }

            case .window:
                // For window capture, try to restart with the same window
                if let window = selectedWindow {
                    do {
                        // Verify window still exists
                        let content = try await SCShareableContent.current
                        if content.windows.contains(where: { $0.windowID == window.windowID }) {
                            logger.info("✅ Window still available, restarting capture")
                            try await startCaptureWindow(cgWindowID: Int(window.windowID), useWebRTC: useWebRTC)
                        } else {
                            logger.warning("⚠️ Window no longer available after display change")
                            await notifyWindowDisconnected()
                        }
                    } catch {
                        logger.error("Failed to verify window availability: \(error)")
                        await notifyWindowDisconnected()
                    }
                }

            case .allDisplays:
                // For all displays mode, just restart
                logger.info("🔄 Restarting all displays capture after configuration change")
                try await startCapture(type: "display", index: -1, useWebRTC: useWebRTC)

            case .application:
                // For application capture, try to restart with the same application
                logger.info("🔄 Application capture mode - checking if still available")
                // For now, just notify that the display configuration changed
                await notifyDisplayDisconnected()
            }
        } catch {
            logger.error("❌ Failed to handle display change: \(error)")
            await notifyDisplayDisconnected()
        }
    }

    /// Notify connected clients that display was disconnected
    private func notifyDisplayDisconnected() async {
        if let webRTCManager {
            await webRTCManager.sendSignalMessage([
                "type": "display-disconnected",
                "message": "Display disconnected during capture"
            ])
        }
    }

    /// Notify connected clients that window was disconnected
    private func notifyWindowDisconnected() async {
        if let webRTCManager {
            await webRTCManager.sendSignalMessage([
                "type": "window-disconnected",
                "message": "Window closed or became unavailable"
            ])
        }
    }

    // MARK: - Private Methods

    private func keyStringToKeyCode(_ key: String) -> CGKeyCode {
        // Basic key mapping - this should be expanded
        switch key.lowercased() {
        case "a": 0x00
        case "s": 0x01
        case "d": 0x02
        case "f": 0x03
        case "h": 0x04
        case "g": 0x05
        case "z": 0x06
        case "x": 0x07
        case "c": 0x08
        case "v": 0x09
        case "b": 0x0B
        case "q": 0x0C
        case "w": 0x0D
        case "e": 0x0E
        case "r": 0x0F
        case "y": 0x10
        case "t": 0x11
        case "1": 0x12
        case "2": 0x13
        case "3": 0x14
        case "4": 0x15
        case "6": 0x16
        case "5": 0x17
        case "=": 0x18
        case "9": 0x19
        case "7": 0x1A
        case "-": 0x1B
        case "8": 0x1C
        case "0": 0x1D
        case "]": 0x1E
        case "o": 0x1F
        case "u": 0x20
        case "[": 0x21
        case "i": 0x22
        case "p": 0x23
        case "l": 0x25
        case "j": 0x26
        case "'": 0x27
        case "k": 0x28
        case ";": 0x29
        case "\\": 0x2A
        case ",": 0x2B
        case "/": 0x2C
        case "n": 0x2D
        case "m": 0x2E
        case ".": 0x2F
        case " ", "space": 0x31
        case "enter", "return": 0x24
        case "tab": 0x30
        case "escape", "esc": 0x35
        case "backspace", "delete": 0x33
        case "arrowup", "up": 0x7E
        case "arrowdown", "down": 0x7D
        case "arrowleft", "left": 0x7B
        case "arrowright", "right": 0x7C
        default: 0x00 // Default to 'a'
        }
    }
}

// MARK: - SCStreamDelegate

extension ScreencapService: SCStreamDelegate {
    public nonisolated func stream(_ stream: SCStream, didStopWithError error: Error) {
        Task { [weak self] in
            await self?.handleStreamError(error)
        }
    }

    private func handleStreamError(_ error: Error) {
        logger.error("Stream stopped with error: \(error)")
        isCapturing = false
        captureStream = nil
    }
}

// MARK: - SCStreamOutput

extension ScreencapService: SCStreamOutput {
    public nonisolated func stream(
        _ stream: SCStream,
        didOutputSampleBuffer sampleBuffer: CMSampleBuffer,
        of type: SCStreamOutputType
    ) {
        guard type == .screen else {
            // Log other types occasionally
            if Int.random(in: 0..<100) == 0 {
                // Cannot log from nonisolated context, skip logging
            }
            return
        }

        // Track frame reception - log first frame and then periodically
        // Use random sampling to avoid concurrency issues
        let shouldLog = Int.random(in: 0..<300) == 0

        // Log sample buffer format details
        if let formatDesc = CMSampleBufferGetFormatDescription(sampleBuffer) {
            _ = CMFormatDescriptionGetMediaType(formatDesc)
            let mediaSubType = CMFormatDescriptionGetMediaSubType(formatDesc)
            let dimensions = CMVideoFormatDescriptionGetDimensions(formatDesc)

            // Only log occasionally to reduce noise
            if shouldLog {
                Task { @MainActor in
                    self.logger.info("📊 Frame received - dimensions: \(dimensions.width)x\(dimensions.height)")
                    self.logger.info("🎨 Pixel format: \(String(format: "0x%08X", mediaSubType))")
                    // Mark that we're receiving frames
                    if self.frameCounter == 0 {
                        self.logger.info("🎬 FIRST FRAME RECEIVED!")
                    }
                    self.frameCounter += 1
                }
            }
        }

        // Check if sample buffer is ready
        if !CMSampleBufferDataIsReady(sampleBuffer) {
            // Cannot log from nonisolated context, skip warning
            return
        }

        // Get sample buffer attachments to check frame status
        guard let attachmentsArray = CMSampleBufferGetSampleAttachmentsArray(
            sampleBuffer,
            createIfNecessary: false
        ) as? [[SCStreamFrameInfo: Any]],
            let attachments = attachmentsArray.first
        else {
            if shouldLog {
                // Cannot log from nonisolated context, skip debug message
            }
            return
        }

        // Check frame status - only process complete frames
        if let statusRawValue = attachments[SCStreamFrameInfo.status] as? Int,
           let status = SCFrameStatus(rawValue: statusRawValue),
           status != .complete
        {
            if shouldLog {
                // Cannot log from nonisolated context, skip debug message
            }
            return
        }

        // Get pixel buffer immediately
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
            // Log this issue but only occasionally
            if shouldLog {
                // Cannot log from nonisolated context, skip warning
            }
            return
        }

        // We have a pixel buffer! Process it for WebRTC if enabled
        if useWebRTC, let webRTCManager {
            // The processVideoFrame method is nonisolated and accepts a sending parameter
            // We can call it directly without creating a Task, avoiding the closure capture issue
            webRTCManager.processVideoFrameSync(sampleBuffer)

            // Log occasionally
            if shouldLog {
                Task { @MainActor in
                    self.logger.info("🌐 Forwarding frame to WebRTC manager")
                }
            }
        } else if shouldLog {
            Task { @MainActor in
                self.logger.info("🖼️ WebRTC disabled - using JPEG mode")
            }
        }

        // Create CIImage and process for display
        // Only create and process if we have a valid pixel buffer
        guard CVPixelBufferGetWidth(pixelBuffer) > 0 && CVPixelBufferGetHeight(pixelBuffer) > 0 else {
            return
        }

        let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
        Task { @MainActor [weak self] in
            guard let self else { return }
            await self.processFrame(ciImage: ciImage)
        }
    }

    /// Separate async function to handle frame processing
    @MainActor
    private func processFrame(ciImage: CIImage) async {
        // Check if we're still capturing before processing
        guard isCapturing else {
            logger.debug("Skipping frame processing - capture stopped")
            return
        }

        let context = CIContext()

        // Check extent is valid
        guard !ciImage.extent.isEmpty else {
            logger.error("CIImage has empty extent, skipping frame")
            return
        }

        guard let cgImage = context.createCGImage(ciImage, from: ciImage.extent) else {
            logger.error("Failed to create CGImage from CIImage")
            return
        }

        // Check again if we're still capturing before updating frame
        guard isCapturing else {
            logger.debug("Capture stopped during frame processing")
            return
        }

        // Update current frame
        currentFrame = cgImage
        let frameCount = frameCounter
        frameCounter += 1

        // Log only every 300 frames (10 seconds at 30fps) to reduce noise
        if frameCount.isMultiple(of: 300) {
            logger.info("📹 Frame \(frameCount) received")
        }
    }
}

// MARK: - Error Types

enum ScreencapError: LocalizedError {
    case noDisplay
    case invalidWindowIndex
    case invalidApplicationIndex
    case invalidCaptureType
    case failedToCreateEvent
    case notCapturing
    case failedToGetContent(Error)
    case invalidConfiguration
    case failedToStartCapture(Error)
    case invalidCoordinates(x: Double, y: Double)
    case invalidKeyInput(String)
    case serviceNotReady

    var errorDescription: String? {
        switch self {
        case .noDisplay:
            "No display available"
        case .invalidWindowIndex:
            "Invalid window index"
        case .invalidApplicationIndex:
            "Invalid application index"
        case .invalidCaptureType:
            "Invalid capture type"
        case .failedToCreateEvent:
            "Failed to create input event"
        case .notCapturing:
            "Not currently capturing"
        case .failedToGetContent(let error):
            "Failed to get screen content: \(error.localizedDescription)"
        case .invalidConfiguration:
            "Invalid capture configuration"
        case .failedToStartCapture(let error):
            "Failed to start capture: \(error.localizedDescription)"
        case .invalidCoordinates(let x, let y):
            "Invalid coordinates (\(x), \(y)) - must be in range 0-1000"
        case .invalidKeyInput(let key):
            "Invalid key input: '\(key)' - must be non-empty and <= 20 characters"
        case .serviceNotReady:
            "Screen capture service is not ready. Connection may still be initializing."
        }
    }
}
