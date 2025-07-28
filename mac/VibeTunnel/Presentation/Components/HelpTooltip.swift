import SwiftUI

/// A help icon with tooltip for explaining settings
struct HelpTooltip: View {
    let text: String
    @State private var isHovering = false

    var body: some View {
        Image(systemName: "questionmark.circle")
            .foregroundColor(.secondary)
            .imageScale(.small)
            .help(text)
            .onHover { hovering in
                isHovering = hovering
            }
            .scaleEffect(isHovering ? 1.1 : 1.0)
            .animation(.easeInOut(duration: 0.1), value: isHovering)
    }
}

/// Notification setting descriptions
enum NotificationHelp {
    static let sessionStarts = "Get notified when a new terminal session begins. Useful for monitoring when someone starts using your shared terminal."

    static let sessionEnds = "Get notified when a terminal session closes. Shows exit code if the session crashed or exited abnormally."

    static let commandsComplete = "Get notified when commands that take longer than 3 seconds finish. Perfect for long builds, tests, or data processing tasks."

    static let commandsFail = "Get notified when any command exits with an error (non-zero exit code). Helps you quickly spot and fix problems."

    static let terminalBell = "Get notified when programs output the terminal bell character (^G). Common in vim alerts, IRC mentions, and completion notifications."

    static let claudeTurn = "Get notified when Claude AI finishes responding and is waiting for your input. Automatically detects Claude CLI sessions and tracks activity transitions."
}

#Preview {
    VStack(alignment: .leading, spacing: 20) {
        HStack {
            Text("Session starts")
            HelpTooltip(text: NotificationHelp.sessionStarts)
        }

        HStack {
            Text("Commands complete (> 3 seconds)")
            HelpTooltip(text: NotificationHelp.commandsComplete)
        }

        HStack {
            Text("Claude turn notifications")
            HelpTooltip(text: NotificationHelp.claudeTurn)
        }
    }
    .padding()
}
