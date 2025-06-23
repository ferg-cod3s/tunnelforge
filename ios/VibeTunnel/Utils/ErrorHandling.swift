import SwiftUI

// MARK: - Error Alert Modifier

/// A view modifier that presents errors using SwiftUI's built-in alert system
struct ErrorAlertModifier: ViewModifier {
    @Binding var error: Error?
    let onDismiss: (() -> Void)?
    
    func body(content: Content) -> some View {
        content
            .alert(
                "Error",
                isPresented: .constant(error != nil),
                presenting: error
            ) { _ in
                Button("OK") {
                    error = nil
                    onDismiss?()
                }
            } message: { error in
                Text(error.localizedDescription)
            }
    }
}

extension View {
    /// Presents an error alert when an error is present
    func errorAlert(
        error: Binding<Error?>,
        onDismiss: (() -> Void)? = nil
    ) -> some View {
        modifier(ErrorAlertModifier(error: error, onDismiss: onDismiss))
    }
}

// MARK: - Identifiable Error

/// Makes any Error conform to Identifiable for SwiftUI presentation
struct IdentifiableError: Identifiable {
    let id = UUID()
    let error: Error
}

extension View {
    /// Presents an error alert using an identifiable error wrapper
    func errorAlert(item: Binding<IdentifiableError?>) -> some View {
        alert(item: item) { identifiableError in
            Alert(
                title: Text("Error"),
                message: Text(identifiableError.error.localizedDescription),
                dismissButton: .default(Text("OK"))
            )
        }
    }
}

// MARK: - Error Handling State

// AsyncState property wrapper removed as it's not used in the codebase

// MARK: - Error Recovery

/// Protocol for errors that can provide recovery suggestions
protocol RecoverableError: Error {
    var recoverySuggestion: String? { get }
}

extension APIError: RecoverableError {
    var recoverySuggestion: String? {
        switch self {
        case .noServerConfigured:
            return "Please configure a server connection in Settings."
        case .networkError:
            return "Check your internet connection and try again."
        case .serverError(let code, _):
            switch code {
            case 401:
                return "Check your authentication credentials in Settings."
            case 500...599:
                return "The server is experiencing issues. Please try again later."
            default:
                return nil
            }
        case .resizeDisabledByServer:
            return "Terminal resizing is not supported by this server."
        default:
            return nil
        }
    }
}

// MARK: - Error Banner View

/// A reusable error banner component
struct ErrorBanner: View {
    let message: String
    let isOffline: Bool
    let onDismiss: (() -> Void)?
    
    init(
        message: String,
        isOffline: Bool = false,
        onDismiss: (() -> Void)? = nil
    ) {
        self.message = message
        self.isOffline = isOffline
        self.onDismiss = onDismiss
    }
    
    var body: some View {
        HStack(spacing: Theme.Spacing.small) {
            Image(systemName: isOffline ? "wifi.exclamationmark" : "exclamationmark.triangle.fill")
                .font(.system(size: 14))
            
            Text(message)
                .font(Theme.Typography.terminalSystem(size: 13))
                .fixedSize(horizontal: false, vertical: true)
            
            Spacer()
            
            if let onDismiss {
                Button(action: onDismiss) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 16))
                        .foregroundColor(Theme.Colors.terminalForeground.opacity(0.5))
                }
            }
        }
        .foregroundColor(Theme.Colors.errorAccent)
        .padding(.horizontal, Theme.Spacing.medium)
        .padding(.vertical, Theme.Spacing.small)
        .background(
            RoundedRectangle(cornerRadius: Theme.CornerRadius.small)
                .fill(Theme.Colors.errorAccent.opacity(0.15))
        )
        .overlay(
            RoundedRectangle(cornerRadius: Theme.CornerRadius.small)
                .stroke(Theme.Colors.errorAccent.opacity(0.3), lineWidth: 1)
        )
        .padding(.horizontal)
    }
}

// MARK: - Task Error Handling

extension Task where Failure == Error {
    /// Executes an async operation with error handling
    @discardableResult
    static func withErrorHandling<T>(
        priority: TaskPriority? = nil,
        errorHandler: @escaping @Sendable (Error) -> Void,
        operation: @escaping @Sendable () async throws -> T
    ) -> Task<T, Error> {
        Task<T, Error>(priority: priority) {
            do {
                return try await operation()
            } catch {
                await MainActor.run {
                    errorHandler(error)
                }
                throw error
            }
        }
    }
}
