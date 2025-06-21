import SwiftTerm
import SwiftUI


/// UIKit bridge for the SwiftTerm terminal emulator.
///
/// Wraps SwiftTerm's TerminalView in a UIViewRepresentable to integrate
/// with SwiftUI, handling terminal configuration, input/output, and resizing.
struct TerminalHostingView: UIViewRepresentable {
    let session: Session
    @Binding var fontSize: CGFloat
    let theme: TerminalTheme
    let onInput: (String) -> Void
    let onResize: (Int, Int) -> Void
    var viewModel: TerminalViewModel
    @State private var isAutoScrollEnabled = true
    @AppStorage("enableURLDetection") private var enableURLDetection = true

    func makeUIView(context: Context) -> SwiftTerm.TerminalView {
        let terminal = SwiftTerm.TerminalView()

        // Configure terminal appearance with theme
        terminal.backgroundColor = UIColor(theme.background)
        terminal.nativeForegroundColor = UIColor(theme.foreground)
        terminal.nativeBackgroundColor = UIColor(theme.background)
        
        // Set ANSI colors from theme
        let ansiColors: [SwiftTerm.Color] = [
            UIColor(theme.black).toSwiftTermColor(),         // 0
            UIColor(theme.red).toSwiftTermColor(),          // 1
            UIColor(theme.green).toSwiftTermColor(),        // 2
            UIColor(theme.yellow).toSwiftTermColor(),       // 3
            UIColor(theme.blue).toSwiftTermColor(),         // 4
            UIColor(theme.magenta).toSwiftTermColor(),      // 5
            UIColor(theme.cyan).toSwiftTermColor(),         // 6
            UIColor(theme.white).toSwiftTermColor(),        // 7
            UIColor(theme.brightBlack).toSwiftTermColor(),  // 8
            UIColor(theme.brightRed).toSwiftTermColor(),    // 9
            UIColor(theme.brightGreen).toSwiftTermColor(),  // 10
            UIColor(theme.brightYellow).toSwiftTermColor(), // 11
            UIColor(theme.brightBlue).toSwiftTermColor(),   // 12
            UIColor(theme.brightMagenta).toSwiftTermColor(),// 13
            UIColor(theme.brightCyan).toSwiftTermColor(),   // 14
            UIColor(theme.brightWhite).toSwiftTermColor()   // 15
        ]
        terminal.installColors(ansiColors)
        
        // Set cursor color
        terminal.caretColor = UIColor(theme.cursor)
        
        // Set selection color
        terminal.selectedTextBackgroundColor = UIColor(theme.selection)

        // Set up delegates
        // SwiftTerm's TerminalView uses terminalDelegate, not delegate
        terminal.terminalDelegate = context.coordinator

        // Configure terminal options
        terminal.allowMouseReporting = false
        terminal.optionAsMetaKey = true

        // URL detection is handled by SwiftTerm automatically

        // Configure font
        updateFont(terminal, size: fontSize)

        // Start with default size
        let cols = Int(UIScreen.main.bounds.width / 9) // Approximate char width
        let rows = 24
        terminal.resize(cols: cols, rows: rows)

        return terminal
    }

    func updateUIView(_ terminal: SwiftTerm.TerminalView, context: Context) {
        updateFont(terminal, size: fontSize)
        
        // URL detection is handled by SwiftTerm automatically
        
        // Update theme colors
        terminal.backgroundColor = UIColor(theme.background)
        terminal.nativeForegroundColor = UIColor(theme.foreground)
        terminal.nativeBackgroundColor = UIColor(theme.background)
        terminal.caretColor = UIColor(theme.cursor)
        terminal.selectedTextBackgroundColor = UIColor(theme.selection)
        
        // Update ANSI colors
        let ansiColors: [SwiftTerm.Color] = [
            UIColor(theme.black).toSwiftTermColor(),         // 0
            UIColor(theme.red).toSwiftTermColor(),          // 1
            UIColor(theme.green).toSwiftTermColor(),        // 2
            UIColor(theme.yellow).toSwiftTermColor(),       // 3
            UIColor(theme.blue).toSwiftTermColor(),         // 4
            UIColor(theme.magenta).toSwiftTermColor(),      // 5
            UIColor(theme.cyan).toSwiftTermColor(),         // 6
            UIColor(theme.white).toSwiftTermColor(),        // 7
            UIColor(theme.brightBlack).toSwiftTermColor(),  // 8
            UIColor(theme.brightRed).toSwiftTermColor(),    // 9
            UIColor(theme.brightGreen).toSwiftTermColor(),  // 10
            UIColor(theme.brightYellow).toSwiftTermColor(), // 11
            UIColor(theme.brightBlue).toSwiftTermColor(),   // 12
            UIColor(theme.brightMagenta).toSwiftTermColor(),// 13
            UIColor(theme.brightCyan).toSwiftTermColor(),   // 14
            UIColor(theme.brightWhite).toSwiftTermColor()   // 15
        ]
        terminal.installColors(ansiColors)

        // Update terminal content from viewModel
        context.coordinator.terminal = terminal
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(
            onInput: onInput,
            onResize: onResize,
            viewModel: viewModel
        )
    }

    private func updateFont(_ terminal: SwiftTerm.TerminalView, size: CGFloat) {
        let font: UIFont = if let customFont = UIFont(name: Theme.Typography.terminalFont, size: size) {
            customFont
        } else if let fallbackFont = UIFont(name: Theme.Typography.terminalFontFallback, size: size) {
            fallbackFont
        } else {
            UIFont.monospacedSystemFont(ofSize: size, weight: .regular)
        }
        // SwiftTerm uses the font property directly
        terminal.font = font
    }

    @MainActor
    class Coordinator: NSObject {
        let onInput: (String) -> Void
        let onResize: (Int, Int) -> Void
        let viewModel: TerminalViewModel
        weak var terminal: SwiftTerm.TerminalView?

        init(
            onInput: @escaping (String) -> Void,
            onResize: @escaping (Int, Int) -> Void,
            viewModel: TerminalViewModel
        ) {
            self.onInput = onInput
            self.onResize = onResize
            self.viewModel = viewModel
            super.init()

            // Set the coordinator reference on the viewModel
            Task { @MainActor in
                viewModel.terminalCoordinator = self
            }
        }

        func feedData(_ data: String) {
            Task { @MainActor in
                guard let terminal else { 
                    print("[Terminal] No terminal instance available")
                    return 
                }

                // Debug: Log first 100 chars of data
                let preview = String(data.prefix(100))
                print("[Terminal] Feeding \(data.count) bytes: \(preview)")

                // Store current scroll position before feeding data
                let wasAtBottom = viewModel.isAutoScrollEnabled

                // Feed the output to the terminal
                terminal.feed(text: data)

                // Auto-scroll to bottom if enabled
                if wasAtBottom {
                    // SwiftTerm automatically scrolls when feeding data at bottom
                    // No explicit API needed for auto-scrolling
                }
            }
        }

        // MARK: - TerminalViewDelegate

        func send(source: SwiftTerm.TerminalView, data: ArraySlice<UInt8>) {
            if let string = String(bytes: data, encoding: .utf8) {
                onInput(string)
            }
        }

        func sizeChanged(source: SwiftTerm.TerminalView, newCols: Int, newRows: Int) {
            onResize(newCols, newRows)
        }

        func scrolled(source: SwiftTerm.TerminalView, position: Double) {
            // Check if user is at bottom
            Task { @MainActor in
                // Estimate if at bottom based on position
                let isAtBottom = position >= 0.95
                viewModel.updateScrollState(isAtBottom: isAtBottom)
                
                // The view model will handle button visibility through its state
            }
        }
        
        func scrollToBottom() {
            // Scroll to bottom by sending page down keys
            if let terminal = terminal {
                terminal.feed(text: "\u{001b}[B")
            }
        }

        func setTerminalTitle(source: SwiftTerm.TerminalView, title: String) {
            // Handle title change if needed
        }

        func hostCurrentDirectoryUpdate(source: SwiftTerm.TerminalView, directory: String?) {
            // Handle directory update if needed
        }

        func requestOpenLink(source: SwiftTerm.TerminalView, link: String, params: [String: String]) {
            // Open URL with haptic feedback
            if let url = URL(string: link) {
                DispatchQueue.main.async {
                    HapticFeedback.impact(.light)
                    UIApplication.shared.open(url, options: [:], completionHandler: nil)
                }
            }
        }

        func clipboardCopy(source: SwiftTerm.TerminalView, content: Data) {
            // Handle clipboard copy
            if let string = String(data: content, encoding: .utf8) {
                UIPasteboard.general.string = string
            }
        }

        func rangeChanged(source: SwiftTerm.TerminalView, startY: Int, endY: Int) {
            // Handle range change if needed
        }
    }
}

/// Add conformance with proper isolation
extension TerminalHostingView.Coordinator: @preconcurrency SwiftTerm.TerminalViewDelegate {}

// MARK: - UIColor Extension for SwiftTerm

extension UIColor {
    /// Convert UIColor to SwiftTerm.Color (which uses 16-bit color components)
    func toSwiftTermColor() -> SwiftTerm.Color {
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0
        
        getRed(&red, green: &green, blue: &blue, alpha: &alpha)
        
        // Convert from 0.0-1.0 range to 0-65535 range
        let red16 = UInt16(red * 65535.0)
        let green16 = UInt16(green * 65535.0)
        let blue16 = UInt16(blue * 65535.0)
        
        return SwiftTerm.Color(red: red16, green: green16, blue: blue16)
    }
}
