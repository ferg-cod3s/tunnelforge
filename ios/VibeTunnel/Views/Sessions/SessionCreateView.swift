import SwiftUI

/// Custom text field style for terminal-like appearance
struct TerminalTextFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .font(Theme.Typography.terminalSystem(size: 16))
            .foregroundColor(Theme.Colors.terminalForeground)
            .padding()
            .background(
                RoundedRectangle(cornerRadius: Theme.CornerRadius.small)
                    .fill(Theme.Colors.cardBackground)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Theme.CornerRadius.small)
                    .stroke(Theme.Colors.cardBorder, lineWidth: 1)
            )
    }
}

struct SessionCreateView: View {
    @Binding var isPresented: Bool
    let onCreated: (String) -> Void

    @State private var command = "claude"
    @State private var workingDirectory = "~"
    @State private var sessionName = ""
    @State private var isCreating = false
    @State private var errorMessage: String?
    @State private var showFileBrowser = false

    @FocusState private var focusedField: Field?

    enum Field {
        case command
        case workingDir
        case name
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.Colors.terminalBackground
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: Theme.Spacing.large) {
                        // Configuration Fields
                        VStack(spacing: Theme.Spacing.large) {
                            // Command Field
                            VStack(alignment: .leading, spacing: Theme.Spacing.small) {
                                Label("Command", systemImage: "terminal")
                                    .font(Theme.Typography.terminalSystem(size: 12))
                                    .foregroundColor(Theme.Colors.primaryAccent)

                                TextField("zsh", text: $command)
                                    .textFieldStyle(TerminalTextFieldStyle())
                                    .autocapitalization(.none)
                                    .disableAutocorrection(true)
                                    .focused($focusedField, equals: .command)
                            }

                            // Working Directory
                            VStack(alignment: .leading, spacing: Theme.Spacing.small) {
                                Label("Working Directory", systemImage: "folder")
                                    .font(Theme.Typography.terminalSystem(size: 12))
                                    .foregroundColor(Theme.Colors.primaryAccent)

                                HStack(spacing: Theme.Spacing.small) {
                                    TextField("~", text: $workingDirectory)
                                        .textFieldStyle(TerminalTextFieldStyle())
                                        .autocapitalization(.none)
                                        .disableAutocorrection(true)
                                        .focused($focusedField, equals: .workingDir)

                                    Button(action: {
                                        HapticFeedback.impact(.light)
                                        showFileBrowser = true
                                    }, label: {
                                        Image(systemName: "folder")
                                            .font(.system(size: 16))
                                            .foregroundColor(Theme.Colors.primaryAccent)
                                            .frame(width: 44, height: 44)
                                            .background(
                                                RoundedRectangle(cornerRadius: Theme.CornerRadius.small)
                                                    .fill(Theme.Colors.cardBorder.opacity(0.1))
                                            )
                                            .overlay(
                                                RoundedRectangle(cornerRadius: Theme.CornerRadius.small)
                                                    .stroke(Theme.Colors.cardBorder.opacity(0.3), lineWidth: 1)
                                            )
                                    })
                                    .buttonStyle(PlainButtonStyle())
                                }
                            }

                            // Session Name
                            VStack(alignment: .leading, spacing: Theme.Spacing.small) {
                                Label("Session Name (Optional)", systemImage: "tag")
                                    .font(Theme.Typography.terminalSystem(size: 12))
                                    .foregroundColor(Theme.Colors.primaryAccent)

                                TextField("My Session", text: $sessionName)
                                    .textFieldStyle(TerminalTextFieldStyle())
                                    .focused($focusedField, equals: .name)
                            }

                            // Error Message
                            if let error = errorMessage {
                                HStack(spacing: Theme.Spacing.small) {
                                    Image(systemName: "exclamationmark.triangle.fill")
                                        .font(.system(size: 14))
                                    Text(error)
                                        .font(Theme.Typography.terminalSystem(size: 13))
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                                .foregroundColor(Theme.Colors.errorAccent)
                                .padding(.horizontal, Theme.Spacing.medium)
                                .padding(.vertical, Theme.Spacing.small)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(
                                    RoundedRectangle(cornerRadius: Theme.CornerRadius.small)
                                        .fill(Theme.Colors.errorAccent.opacity(0.15))
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: Theme.CornerRadius.small)
                                        .stroke(Theme.Colors.errorAccent.opacity(0.3), lineWidth: 1)
                                )
                                .transition(.asymmetric(
                                    insertion: .scale(scale: 0.95).combined(with: .opacity),
                                    removal: .scale(scale: 0.95).combined(with: .opacity)
                                ))
                            }
                        }
                        .padding(.horizontal)
                        .padding(.top, Theme.Spacing.large)

                        // Quick Directories
                        if focusedField == .workingDir {
                            VStack(alignment: .leading, spacing: Theme.Spacing.small) {
                                Text("COMMON DIRECTORIES")
                                    .font(Theme.Typography.terminalSystem(size: 10))
                                    .foregroundColor(Theme.Colors.terminalForeground.opacity(0.5))
                                    .tracking(1)
                                    .padding(.horizontal)

                                ScrollView(.horizontal, showsIndicators: false) {
                                    HStack(spacing: Theme.Spacing.small) {
                                        ForEach(commonDirectories, id: \.self) { dir in
                                            Button(action: {
                                                workingDirectory = dir
                                                HapticFeedback.selection()
                                            }, label: {
                                                HStack(spacing: 4) {
                                                    Image(systemName: "folder.fill")
                                                        .font(.system(size: 12))
                                                    Text(dir)
                                                        .font(Theme.Typography.terminalSystem(size: 13))
                                                }
                                                .foregroundColor(workingDirectory == dir ? Theme.Colors
                                                    .terminalBackground : Theme.Colors.terminalForeground
                                                )
                                                .padding(.horizontal, 12)
                                                .padding(.vertical, 8)
                                                .background(
                                                    RoundedRectangle(cornerRadius: Theme.CornerRadius.small)
                                                        .fill(workingDirectory == dir ? Theme.Colors
                                                            .primaryAccent : Theme.Colors.cardBorder.opacity(0.1)
                                                        )
                                                )
                                                .overlay(
                                                    RoundedRectangle(cornerRadius: Theme.CornerRadius.small)
                                                        .stroke(
                                                            workingDirectory == dir ? Theme.Colors.primaryAccent : Theme
                                                                .Colors.cardBorder.opacity(0.3),
                                                            lineWidth: 1
                                                        )
                                                )
                                            })
                                            .buttonStyle(PlainButtonStyle())
                                        }
                                    }
                                    .padding(.horizontal)
                                }
                            }
                        }

                        // Quick Start Commands
                        VStack(alignment: .leading, spacing: Theme.Spacing.small) {
                            Text("QUICK START")
                                .font(Theme.Typography.terminalSystem(size: 10))
                                .foregroundColor(Theme.Colors.terminalForeground.opacity(0.5))
                                .tracking(1)
                                .padding(.horizontal)

                            LazyVGrid(columns: [
                                GridItem(.flexible()),
                                GridItem(.flexible())
                            ], spacing: Theme.Spacing.small) {
                                ForEach(recentCommands, id: \.self) { cmd in
                                    Button(action: {
                                        command = cmd
                                        HapticFeedback.selection()
                                    }, label: {
                                        HStack {
                                            Image(systemName: commandIcon(for: cmd))
                                                .font(.system(size: 14))
                                            Text(cmd)
                                                .font(Theme.Typography.terminalSystem(size: 14))
                                            Spacer()
                                        }
                                        .foregroundColor(command == cmd ? Theme.Colors.terminalBackground : Theme.Colors
                                            .terminalForeground
                                        )
                                        .padding(.horizontal, Theme.Spacing.medium)
                                        .padding(.vertical, Theme.Spacing.small)
                                        .background(
                                            RoundedRectangle(cornerRadius: Theme.CornerRadius.small)
                                                .fill(command == cmd ? Theme.Colors.primaryAccent : Theme.Colors
                                                    .cardBorder.opacity(0.3)
                                                )
                                        )
                                        .overlay(
                                            RoundedRectangle(cornerRadius: Theme.CornerRadius.small)
                                                .stroke(
                                                    command == cmd ? Theme.Colors.primaryAccent : Theme.Colors
                                                        .cardBorder,
                                                    lineWidth: 1
                                                )
                                        )
                                    })
                                    .buttonStyle(PlainButtonStyle())
                                    .scaleEffect(command == cmd ? 0.95 : 1.0)
                                    .animation(Theme.Animation.quick, value: command == cmd)
                                }
                            }
                            .padding(.horizontal)
                        }

                        Spacer(minLength: 40)
                    }
                }
            }
            .navigationBarHidden(true)
            .safeAreaInset(edge: .top) {
                // Custom Navigation Bar with proper safe area handling
                ZStack {
                    // Background with blur and transparency
                    Rectangle()
                        .fill(.ultraThinMaterial)
                        .background(Theme.Colors.terminalBackground.opacity(0.5))

                    // Content
                    HStack {
                        Button(action: {
                            HapticFeedback.impact(.light)
                            isPresented = false
                        }, label: {
                            Text("Cancel")
                                .font(.system(size: 17))
                                .foregroundColor(Theme.Colors.errorAccent)
                        })
                        .buttonStyle(PlainButtonStyle())

                        Spacer()

                        Text("New Session")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundColor(Theme.Colors.terminalForeground)

                        Spacer()

                        Button(action: {
                            HapticFeedback.impact(.medium)
                            createSession()
                        }, label: {
                            if isCreating {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: Theme.Colors.primaryAccent))
                                    .scaleEffect(0.8)
                            } else {
                                Text("Create")
                                    .font(.system(size: 17, weight: .semibold))
                                    .foregroundColor(command.isEmpty ? Theme.Colors.primaryAccent.opacity(0.5) : Theme
                                        .Colors.primaryAccent
                                    )
                            }
                        })
                        .buttonStyle(PlainButtonStyle())
                        .disabled(isCreating || command.isEmpty)
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 16)
                }
                .frame(height: 56) // Fixed height for the header
                .overlay(
                    // Subtle bottom border
                    Rectangle()
                        .fill(Theme.Colors.cardBorder.opacity(0.15))
                        .frame(height: 0.5),
                    alignment: .bottom
                )
            }
            .onAppear {
                loadDefaults()
                focusedField = .command
            }
        }
        .preferredColorScheme(.dark)
        .sheet(isPresented: $showFileBrowser) {
            FileBrowserView(initialPath: workingDirectory) { selectedPath in
                workingDirectory = selectedPath
                HapticFeedback.notification(.success)
            }
        }
    }

    private var recentCommands: [String] {
        ["claude", "zsh", "bash", "python3", "node", "npm run dev"]
    }

    private var commonDirectories: [String] {
        ["~", "~/Desktop", "~/Documents", "~/Downloads", "~/Projects", "/tmp"]
    }

    private func commandIcon(for command: String) -> String {
        switch command {
        case "claude":
            "sparkle"
        case "zsh", "bash":
            "terminal"
        case "python3":
            "chevron.left.forwardslash.chevron.right"
        case "node":
            "server.rack"
        case "npm run dev":
            "play.circle"
        case "irb":
            "diamond"
        default:
            "terminal"
        }
    }

    private func loadDefaults() {
        // Load last used values
        if let lastCommand = UserDefaults.standard.string(forKey: "lastCommand") {
            command = lastCommand
        }
        if let lastDir = UserDefaults.standard.string(forKey: "lastWorkingDir") {
            workingDirectory = lastDir
        } else {
            // Default to home directory on the server
            workingDirectory = "~"
        }
    }

    private func createSession() {
        isCreating = true
        errorMessage = nil

        // Save preferences
        UserDefaults.standard.set(command, forKey: "lastCommand")
        UserDefaults.standard.set(workingDirectory, forKey: "lastWorkingDir")

        Task {
            do {
                let sessionData = SessionCreateData(
                    command: command,
                    workingDir: workingDirectory.isEmpty ? "~" : workingDirectory,
                    name: sessionName.isEmpty ? nil : sessionName
                )

                // Log the request for debugging
                print("[SessionCreate] Creating session with data:")
                print("  Command: \(sessionData.command)")
                print("  Working Dir: \(sessionData.workingDir)")
                print("  Name: \(sessionData.name ?? "nil")")
                print("  Spawn Terminal: \(sessionData.spawnTerminal ?? false)")
                print("  Cols: \(sessionData.cols ?? 0), Rows: \(sessionData.rows ?? 0)")

                let sessionId = try await SessionService.shared.createSession(sessionData)

                print("[SessionCreate] Session created successfully with ID: \(sessionId)")

                await MainActor.run {
                    onCreated(sessionId)
                    isPresented = false
                }
            } catch {
                print("[SessionCreate] Failed to create session:")
                print("  Error: \(error)")
                if let apiError = error as? APIError {
                    print("  API Error: \(apiError)")
                }

                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isCreating = false
                }
            }
        }
    }
}
