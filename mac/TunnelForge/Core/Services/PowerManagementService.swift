import Foundation
import IOKit.pwr_mgt
import Observation
import OSLog

/// Manages system power assertions to prevent the Mac from sleeping while TunnelForge is running.
///
/// This service uses IOKit's power management APIs to create power assertions that prevent
/// the system from entering idle sleep when terminal sessions are active. The service is
/// integrated with ServerManager to automatically manage sleep prevention based on server
/// state and user preferences.
@Observable
@MainActor
final class PowerManagementService {
    static let shared = PowerManagementService()

    private(set) var isSleepPrevented = false

    private var assertionID: IOPMAssertionID = 0
    private var isAssertionActive = false

    private let logger = Logger(subsystem: BundleIdentifiers.loggerSubsystem, category: "PowerManagement")

    private init() {}

    /// Prevents the system from sleeping
    func preventSleep() {
        guard !isAssertionActive else { return }

        let success = createPowerAssertion()
        if success == kIOReturnSuccess {
            isAssertionActive = true
            isSleepPrevented = true
            logger.info("Sleep prevention enabled")
        } else {
            logger.error("Failed to prevent sleep: \(success)")

            // Retry once for transient failures
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
                guard let self = self, !self.isAssertionActive else { return }
                let retrySuccess = self.createPowerAssertion()
                if retrySuccess == kIOReturnSuccess {
                    self.isAssertionActive = true
                    self.isSleepPrevented = true
                    self.logger.info("Sleep prevention enabled on retry")
                } else {
                    self.logger.error("Power assertion retry failed: \(retrySuccess)")
                }
            }
        }
    }

    /// Allows the system to sleep normally
    func allowSleep() {
        guard isAssertionActive else { return }

        let success = IOPMAssertionRelease(assertionID)

        if success == kIOReturnSuccess {
            isAssertionActive = false
            isSleepPrevented = false
            assertionID = 0
            logger.info("Sleep prevention disabled")
        } else {
            logger.error("Failed to release sleep assertion: \(success)")
        }
    }

    /// Updates sleep prevention based on user preference and server state
    func updateSleepPrevention(enabled: Bool, serverRunning: Bool) {
        if enabled && serverRunning {
            preventSleep()
        } else {
            allowSleep()
        }
    }

    /// Helper method to create power assertion
    private func createPowerAssertion() -> IOReturn {
        let reason = "TunnelForge is running terminal sessions" as CFString
        let assertionType = kIOPMAssertionTypeNoIdleSleep as CFString

        return IOPMAssertionCreateWithName(
            assertionType,
            IOPMAssertionLevel(kIOPMAssertionLevelOn),
            reason,
            &assertionID
        )
    }

    deinit {
        // Force cleanup regardless of MainActor constraints
        // Note: We cannot access main actor properties in deinit, so we rely on
        // proper cleanup during normal operation via allowSleep()
        // This is safe because the service is a singleton that should not be deallocated
        // during normal app operation
    }
}
