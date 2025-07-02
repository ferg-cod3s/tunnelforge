import SwiftUI

/// Bottom action bar for the menu with New Session, Settings, and Quit buttons.
///
/// Provides quick access to common actions with keyboard navigation support
/// and visual feedback for hover and focus states.
struct MenuActionBar: View {
    @Binding var showingNewSession: Bool
    @Binding var focusedField: VibeTunnelMenuView.FocusField?
    let hasStartedKeyboardNavigation: Bool

    @Environment(\.openWindow)
    private var openWindow
    @Environment(\.colorScheme)
    private var colorScheme

    @State private var isHoveringNewSession = false
    @State private var isHoveringSettings = false
    @State private var isHoveringQuit = false

    var body: some View {
        HStack(spacing: 8) {
            Button(action: {
                showingNewSession = true
            }) {
                Label("New Session", systemImage: "plus.circle")
                    .font(.system(size: 12))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 3)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(isHoveringNewSession ? AppColors.Fallback.controlBackground(for: colorScheme)
                                .opacity(0.15) : Color.clear
                            )
                            .scaleEffect(isHoveringNewSession ? 1.1 : 1.0)
                            .animation(.easeInOut(duration: 0.15), value: isHoveringNewSession)
                    )
            }
            .buttonStyle(.plain)
            .foregroundColor(.primary)
            .onHover { hovering in
                isHoveringNewSession = hovering
            }
            .focusable()
            .overlay(
                RoundedRectangle(cornerRadius: 4)
                    .strokeBorder(
                        focusedField == .newSessionButton && hasStartedKeyboardNavigation ? AppColors.Fallback
                            .accentHover(for: colorScheme).opacity(2) : Color.clear,
                        lineWidth: 1
                    )
                    .animation(.easeInOut(duration: 0.15), value: focusedField)
            )

            Button(action: {
                SettingsOpener.openSettings()
            }) {
                Label("Settings", systemImage: "gearshape")
                    .font(.system(size: 12))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 3)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(isHoveringSettings ? AppColors.Fallback.controlBackground(for: colorScheme)
                                .opacity(0.15) : Color.clear
                            )
                            .scaleEffect(isHoveringSettings ? 1.1 : 1.0)
                            .animation(.easeInOut(duration: 0.15), value: isHoveringSettings)
                    )
            }
            .buttonStyle(.plain)
            .foregroundColor(.secondary)
            .onHover { hovering in
                isHoveringSettings = hovering
            }
            .focusable()
            .overlay(
                RoundedRectangle(cornerRadius: 4)
                    .strokeBorder(
                        focusedField == .settingsButton && hasStartedKeyboardNavigation ? AppColors.Fallback
                            .accentHover(for: colorScheme).opacity(2) : Color.clear,
                        lineWidth: 1
                    )
                    .animation(.easeInOut(duration: 0.15), value: focusedField)
            )

            Spacer()

            Button(action: {
                NSApplication.shared.terminate(nil)
            }) {
                Label("Quit", systemImage: "power")
                    .font(.system(size: 12))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 3)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(isHoveringQuit ? AppColors.Fallback.controlBackground(for: colorScheme)
                                .opacity(0.15) : Color.clear
                            )
                            .scaleEffect(isHoveringQuit ? 1.1 : 1.0)
                            .animation(.easeInOut(duration: 0.15), value: isHoveringQuit)
                    )
            }
            .buttonStyle(.plain)
            .foregroundColor(.secondary)
            .onHover { hovering in
                isHoveringQuit = hovering
            }
            .focusable()
            .overlay(
                RoundedRectangle(cornerRadius: 4)
                    .strokeBorder(
                        focusedField == .quitButton && hasStartedKeyboardNavigation ? AppColors.Fallback
                            .accentHover(for: colorScheme).opacity(2) : Color.clear,
                        lineWidth: 1
                    )
                    .animation(.easeInOut(duration: 0.15), value: focusedField)
            )
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
    }
}
