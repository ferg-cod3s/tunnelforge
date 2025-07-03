import AppKit
import Foundation
import OSLog

/// Handles window matching and session-to-window mapping algorithms.
@MainActor
final class WindowMatcher {
    private let logger = Logger(
        subsystem: "sh.vibetunnel.vibetunnel",
        category: "WindowMatcher"
    )

    private let processTracker = ProcessTracker()

    /// Find a window for a specific terminal and session
    func findWindow(
        for terminal: Terminal,
        sessionID: String,
        sessionInfo: ServerSessionInfo?,
        tabReference: String?,
        tabID: String?,
        terminalWindows: [WindowEnumerator.WindowInfo]
    )
        -> WindowEnumerator.WindowInfo?
    {
        // Filter windows for the specific terminal
        let filteredWindows = terminalWindows.filter { $0.terminalApp == terminal }

        // First try to find window by process PID traversal
        if let sessionInfo, let sessionPID = sessionInfo.pid {
            logger.debug("Attempting to find window by process PID: \(sessionPID)")

            // For debugging: log the process tree
            processTracker.logProcessTree(for: pid_t(sessionPID))

            // Try to find the parent process (shell) that owns this session
            if let parentPID = processTracker.getParentProcessID(of: pid_t(sessionPID)) {
                logger.debug("Found parent process PID: \(parentPID)")

                // Look for windows owned by the parent process
                let parentPIDWindows = filteredWindows.filter { window in
                    window.ownerPID == parentPID
                }
                
                if parentPIDWindows.count == 1 {
                    logger.info("Found single window by parent process match: PID \(parentPID)")
                    return parentPIDWindows.first
                } else if parentPIDWindows.count > 1 {
                    logger.info("Found \(parentPIDWindows.count) windows for PID \(parentPID), checking session ID in titles")
                    
                    // Multiple windows - try to match by session ID in title
                    if let matchingWindow = parentPIDWindows.first(where: { window in
                        window.title?.contains("Session \(sessionID)") ?? false
                    }) {
                        logger.info("Found window by session ID '\(sessionID)' in title")
                        return matchingWindow
                    }
                    
                    // If no session ID match, return first window
                    logger.warning("No window with session ID in title, using first window")
                    return parentPIDWindows.first
                }

                // If direct parent match fails, try to find grandparent or higher ancestors
                var currentPID = parentPID
                var depth = 0
                while depth < 10 { // Increased depth for nested shell sessions
                    if let grandParentPID = processTracker.getParentProcessID(of: currentPID) {
                        logger.debug("Checking ancestor process PID: \(grandParentPID) at depth \(depth + 2)")

                        let ancestorPIDWindows = filteredWindows.filter { window in
                            window.ownerPID == grandParentPID
                        }
                        
                        if ancestorPIDWindows.count == 1 {
                            logger
                                .info(
                                    "Found single window by ancestor process match: PID \(grandParentPID) at depth \(depth + 2)"
                                )
                            return ancestorPIDWindows.first
                        } else if ancestorPIDWindows.count > 1 {
                            logger
                                .info(
                                    "Found \(ancestorPIDWindows.count) windows for ancestor PID \(grandParentPID), checking session ID"
                                )
                            
                            // Multiple windows - try to match by session ID in title
                            if let matchingWindow = ancestorPIDWindows.first(where: { window in
                                window.title?.contains("Session \(sessionID)") ?? false
                            }) {
                                logger.info("Found window by session ID '\(sessionID)' in title")
                                return matchingWindow
                            }
                            
                            // If no session ID match, return first window
                            return ancestorPIDWindows.first
                        }

                        currentPID = grandParentPID
                        depth += 1
                    } else {
                        break
                    }
                }
            }
        }

        // Fallback: try to find window by title containing session path or command
        if let sessionInfo {
            let workingDir = sessionInfo.workingDir
            let dirName = (workingDir as NSString).lastPathComponent

            // Look for windows whose title contains the directory name
            if let matchingWindow = filteredWindows.first(where: { window in
                WindowEnumerator.windowTitleContains(window, identifier: dirName) ||
                    WindowEnumerator.windowTitleContains(window, identifier: workingDir)
            }) {
                logger.debug("Found window by directory match: \(dirName)")
                return matchingWindow
            }
        }

        // For Terminal.app with specific tab reference
        if terminal == .terminal, let tabRef = tabReference {
            if let windowID = WindowEnumerator.extractWindowID(from: tabRef) {
                if let matchingWindow = filteredWindows.first(where: { $0.windowID == windowID }) {
                    logger.debug("Found Terminal.app window by ID: \(windowID)")
                    return matchingWindow
                }
            }
        }

        // For iTerm2 with tab ID
        if terminal == .iTerm2, let tabID {
            // Try to match by window title which often includes the window ID
            if let matchingWindow = filteredWindows.first(where: { window in
                WindowEnumerator.windowTitleContains(window, identifier: tabID)
            }) {
                logger.debug("Found iTerm2 window by ID in title: \(tabID)")
                return matchingWindow
            }
        }

        // Fallback: return the most recently created window (highest window ID)
        if let latestWindow = filteredWindows.max(by: { $0.windowID < $1.windowID }) {
            logger.debug("Using most recent window as fallback for session: \(sessionID)")
            return latestWindow
        }

        return nil
    }

    /// Find a terminal window for a session that was attached via `vt`
    func findWindowForSession(
        _ sessionID: String,
        sessionInfo: ServerSessionInfo,
        allWindows: [WindowEnumerator.WindowInfo]
    )
        -> WindowEnumerator.WindowInfo?
    {
        // First try to find window by process PID traversal
        if let sessionPID = sessionInfo.pid {
            logger.debug("Scanning for window by process PID: \(sessionPID) for session \(sessionID)")

            // Log the process tree for debugging
            processTracker.logProcessTree(for: pid_t(sessionPID))

            // Try to traverse up the process tree to find a terminal window
            var currentPID = pid_t(sessionPID)
            var depth = 0
            let maxDepth = 20 // Increased depth for deeply nested sessions

            while depth < maxDepth {
                // Check if any window is owned by this PID
                if let matchingWindow = allWindows.first(where: { window in
                    window.ownerPID == currentPID
                }) {
                    logger.info("Found window by PID \(currentPID) at depth \(depth) for session \(sessionID)")
                    return matchingWindow
                }

                // Move up to parent process
                if let parentPID = processTracker.getParentProcessID(of: currentPID) {
                    if parentPID == 0 || parentPID == 1 {
                        // Reached root process
                        break
                    }
                    currentPID = parentPID
                    depth += 1
                } else {
                    break
                }
            }

            logger.debug("Process traversal completed at depth \(depth) without finding window")
        }

        // Fallback: Find by working directory
        let workingDir = sessionInfo.workingDir
        let dirName = (workingDir as NSString).lastPathComponent

        logger.debug("Trying to match by directory: \(dirName) or full path: \(workingDir)")

        // Look for windows whose title contains the directory name
        if let matchingWindow = allWindows.first(where: { window in
            if let title = window.title {
                let matches = title.contains(dirName) || title.contains(workingDir)
                if matches {
                    logger.debug("Window title '\(title)' matches directory")
                }
                return matches
            }
            return false
        }) {
            logger.info("Found window by directory match: \(dirName) for session \(sessionID)")
            return matchingWindow
        }

        // Try to match by activity status (for sessions with specific activities)
        if let activity = sessionInfo.activityStatus?.specificStatus?.status, !activity.isEmpty {
            logger.debug("Trying to match by activity: \(activity)")

            if let matchingWindow = allWindows.first(where: { window in
                if let title = window.title {
                    return title.contains(activity)
                }
                return false
            }) {
                logger.info("Found window by activity match: \(activity) for session \(sessionID)")
                return matchingWindow
            }
        }

        logger.warning("Could not find window for session \(sessionID) after all attempts")
        logger.debug("Available windows: \(allWindows.count)")
        for (index, window) in allWindows.enumerated() {
            logger
                .debug(
                    "  Window \(index): PID=\(window.ownerPID), Terminal=\(window.terminalApp.rawValue), Title=\(window.title ?? "<no title>")"
                )
        }

        return nil
    }

    /// Find matching tab using accessibility APIs
    func findMatchingTab(tabs: [AXElement], sessionInfo: ServerSessionInfo?) -> AXElement? {
        guard let sessionInfo else { return nil }

        let workingDir = sessionInfo.workingDir
        let dirName = (workingDir as NSString).lastPathComponent
        let sessionID = sessionInfo.id
        let activityStatus = sessionInfo.activityStatus?.specificStatus?.status
        let sessionName = sessionInfo.name

        logger.debug("Looking for tab matching session \(sessionID) in \(tabs.count) tabs")
        logger.debug("  Working dir: \(workingDir)")
        logger.debug("  Dir name: \(dirName)")
        logger.debug("  Session name: \(sessionName ?? "none")")
        logger.debug("  Activity: \(activityStatus ?? "none")")

        for (index, tab) in tabs.enumerated() {
            if let title = tab.title {
                logger.debug("Tab \(index) title: \(title)")

                // Check for session ID match first (most precise)
                if title.contains(sessionID) || title.contains("TTY_SESSION_ID=\(sessionID)") {
                    logger.info("Found tab by session ID match at index \(index)")
                    return tab
                }

                // Check for session name match
                if let name = sessionName, !name.isEmpty, title.contains(name) {
                    logger.info("Found tab by session name match: \(name) at index \(index)")
                    return tab
                }

                // Check for activity status match
                if let activity = activityStatus, !activity.isEmpty, title.contains(activity) {
                    logger.info("Found tab by activity match: \(activity) at index \(index)")
                    return tab
                }

                // Check for directory match - be more flexible
                let titleLower = title.lowercased()
                let dirNameLower = dirName.lowercased()
                let workingDirLower = workingDir.lowercased()

                if titleLower.contains(dirNameLower) || titleLower.contains(workingDirLower) {
                    logger.info("Found tab by directory match at index \(index)")
                    return tab
                }

                // Check if the tab title ends with the directory name (common pattern)
                if title.hasSuffix(dirName) || title.hasSuffix(" - \(dirName)") {
                    logger.info("Found tab by directory suffix match at index \(index)")
                    return tab
                }
            } else {
                logger.debug("Tab \(index): Could not get title")
            }
        }

        logger.warning("No matching tab found for session \(sessionID)")
        return nil
    }
}
