import AppKit
import ApplicationServices
import CoreGraphics
import Foundation
import Observation
import OSLog

/// Types of system permissions that VibeTunnel requires
enum SystemPermission {
    case appleScript
    case screenRecording
    case accessibility

    var displayName: String {
        switch self {
        case .appleScript:
            "Automation"
        case .screenRecording:
            "Screen Recording"
        case .accessibility:
            "Accessibility"
        }
    }

    var explanation: String {
        switch self {
        case .appleScript:
            "Required to launch and control terminal applications"
        case .screenRecording:
            "Required to track and focus terminal windows"
        case .accessibility:
            "Required to send keystrokes to terminal windows"
        }
    }

    fileprivate var settingsURLString: String {
        switch self {
        case .appleScript:
            "x-apple.systempreferences:com.apple.preference.security?Privacy_Automation"
        case .screenRecording:
            "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
        case .accessibility:
            "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
        }
    }
}

/// Unified manager for all system permissions required by VibeTunnel
@MainActor
@Observable
final class SystemPermissionManager {
    static let shared = SystemPermissionManager()

    /// Permission states
    private(set) var permissions: [SystemPermission: Bool] = [
        .appleScript: false,
        .screenRecording: false,
        .accessibility: false
    ]

    private let logger = Logger(
        subsystem: "sh.vibetunnel.vibetunnel",
        category: "SystemPermissions"
    )

    private init() {
        // No automatic monitoring - UI components will check when visible
    }

    // MARK: - Public API

    /// Check if a specific permission is granted
    func hasPermission(_ permission: SystemPermission) -> Bool {
        permissions[permission] ?? false
    }

    /// Check if all permissions are granted
    var hasAllPermissions: Bool {
        permissions.values.allSatisfy(\.self)
    }

    /// Get list of missing permissions
    var missingPermissions: [SystemPermission] {
        permissions.compactMap { permission, granted in
            granted ? nil : permission
        }
    }

    /// Request a specific permission
    func requestPermission(_ permission: SystemPermission) {
        logger.info("Requesting \(permission.displayName) permission")

        switch permission {
        case .appleScript:
            requestAppleScriptPermission()
        case .screenRecording:
            openSystemSettings(for: permission)
        case .accessibility:
            requestAccessibilityPermission()
        }
    }

    /// Request all missing permissions
    func requestAllMissingPermissions() {
        for permission in missingPermissions {
            requestPermission(permission)
        }
    }

    /// Show alert explaining why a permission is needed
    func showPermissionAlert(for permission: SystemPermission) {
        let alert = NSAlert()
        alert.messageText = "\(permission.displayName) Permission Required"
        alert.informativeText = """
        VibeTunnel needs \(permission.displayName) permission.

        \(permission.explanation)

        Please grant permission in System Settings > Privacy & Security > \(permission.displayName).
        """
        alert.alertStyle = .informational
        alert.addButton(withTitle: "Open System Settings")
        alert.addButton(withTitle: "Cancel")

        if alert.runModal() == .alertFirstButtonReturn {
            requestPermission(permission)
        }
    }

    // MARK: - Permission Checking

    func checkAllPermissions() async {
        // Check each permission type
        permissions[.appleScript] = await checkAppleScriptPermission()
        permissions[.screenRecording] = checkScreenRecordingPermission()
        permissions[.accessibility] = checkAccessibilityPermission()
    }

    // MARK: - AppleScript Permission

    private func checkAppleScriptPermission() async -> Bool {
        // Try a simple AppleScript that doesn't require automation permission
        let testScript = "return \"test\""

        do {
            _ = try await AppleScriptExecutor.shared.executeAsync(testScript, timeout: 1.0)
            return true
        } catch {
            logger.debug("AppleScript check failed: \(error)")
            return false
        }
    }

    private func requestAppleScriptPermission() {
        Task {
            // Trigger permission dialog by targeting Terminal
            let triggerScript = """
                tell application "Terminal"
                    exists
                end tell
            """

            do {
                _ = try await AppleScriptExecutor.shared.executeAsync(triggerScript, timeout: 15.0)
            } catch {
                logger.info("AppleScript permission dialog triggered")
            }

            // Open System Settings after a delay
            try? await Task.sleep(for: .milliseconds(500))
            openSystemSettings(for: .appleScript)
        }
    }

    // MARK: - Screen Recording Permission

    private func checkScreenRecordingPermission() -> Bool {
        // Try to get window information
        let options: CGWindowListOption = [.excludeDesktopElements, .optionOnScreenOnly]

        if let windowList = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] {
            // If we get a non-empty list or truly no windows are open, we have permission
            return !windowList.isEmpty || hasNoWindowsOpen()
        }

        return false
    }

    private func hasNoWindowsOpen() -> Bool {
        // Check if any regular apps are running (they likely have windows)
        NSWorkspace.shared.runningApplications.contains { app in
            app.activationPolicy == .regular
        }
    }

    // MARK: - Accessibility Permission

    private func checkAccessibilityPermission() -> Bool {
        AXIsProcessTrusted()
    }

    private func requestAccessibilityPermission() {
        // Trigger the system dialog
        let options: NSDictionary = ["AXTrustedCheckOptionPrompt": true]
        let alreadyTrusted = AXIsProcessTrustedWithOptions(options)

        if alreadyTrusted {
            logger.info("Accessibility permission already granted")
        } else {
            logger.info("Accessibility permission dialog triggered")

            // Also open System Settings as a fallback
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
                self?.openSystemSettings(for: .accessibility)
            }
        }
    }

    // MARK: - Utilities

    private func openSystemSettings(for permission: SystemPermission) {
        if let url = URL(string: permission.settingsURLString) {
            NSWorkspace.shared.open(url)
        }
    }
}
