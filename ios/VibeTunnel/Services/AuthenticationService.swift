import Foundation

/// Authentication service for managing JWT token-based authentication
@MainActor
final class AuthenticationService: ObservableObject {
    private let logger = Logger(category: "AuthenticationService")

    // MARK: - Published Properties

    @Published private(set) var isAuthenticated = false
    @Published private(set) var currentUser: String?
    @Published private(set) var authMethod: AuthMethod?
    @Published private(set) var authToken: String?

    // MARK: - Types

    enum AuthMethod: String, Codable {
        case password = "password"
        case sshKey = "ssh-key"
        case noAuth = "no-auth"
    }

    struct AuthConfig: Codable {
        let noAuth: Bool
        let enableSSHKeys: Bool
        let disallowUserPassword: Bool
    }

    struct AuthResponse: Codable {
        let success: Bool
        let token: String?
        let userId: String?
        let authMethod: String?
        let error: String?
    }

    struct UserData: Codable {
        let userId: String
        let authMethod: String
        let loginTime: Date
    }

    // MARK: - Properties

    private let apiClient: APIClient
    private let serverConfig: ServerConfig

    private let tokenKey: String
    private let userDataKey: String

    // MARK: - Initialization

    init(apiClient: APIClient, serverConfig: ServerConfig) {
        self.apiClient = apiClient
        self.serverConfig = serverConfig
        self.tokenKey = "auth_token_\(serverConfig.id)"
        self.userDataKey = "user_data_\(serverConfig.id)"

        // Check for existing authentication
        Task {
            await checkExistingAuth()
        }
    }

    // MARK: - Public Methods

    /// Get the current system username
    func getCurrentUsername() async throws -> String {
        let url = serverConfig.apiURL(path: "/api/auth/current-user")
        var request = URLRequest(url: url)
        request.httpMethod = "GET"

        let (data, _) = try await URLSession.shared.data(for: request)

        struct CurrentUserResponse: Codable {
            let userId: String
        }

        let response = try JSONDecoder().decode(CurrentUserResponse.self, from: data)
        return response.userId
    }

    /// Get authentication configuration from server
    func getAuthConfig() async throws -> AuthConfig {
        let url = serverConfig.apiURL(path: "/api/auth/config")
        var request = URLRequest(url: url)
        request.httpMethod = "GET"

        let (data, _) = try await URLSession.shared.data(for: request)
        return try JSONDecoder().decode(AuthConfig.self, from: data)
    }

    /// Authenticate with password
    func authenticateWithPassword(username: String, password: String) async throws {
        let url = serverConfig.apiURL(path: "/api/auth/password")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = ["userId": username, "password": password]
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        let authResponse = try JSONDecoder().decode(AuthResponse.self, from: data)

        if httpResponse.statusCode == 200, authResponse.success, let token = authResponse.token {
            // Store token and user data
            try KeychainService.savePassword(token, for: tokenKey)

            let userData = UserData(
                userId: username,
                authMethod: authResponse.authMethod ?? "password",
                loginTime: Date()
            )
            let userDataJson = try JSONEncoder().encode(userData)
            guard let userDataString = String(data: userDataJson, encoding: .utf8) else {
                logger.error("Failed to convert user data to UTF-8 string")
                throw APIError.dataEncodingFailed
            }
            try KeychainService.savePassword(userDataString, for: userDataKey)

            // Update state
            self.authToken = token
            self.currentUser = username
            self.authMethod = AuthMethod(rawValue: authResponse.authMethod ?? "password")
            self.isAuthenticated = true

            logger.info("Successfully authenticated user: \(username)")
        } else {
            throw APIError.authenticationFailed(authResponse.error ?? "Authentication failed")
        }
    }

    /// Verify if current token is still valid
    func verifyToken() async -> Bool {
        guard let token = authToken else { return false }

        let url = serverConfig.apiURL(path: "/api/auth/verify")
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            if let httpResponse = response as? HTTPURLResponse {
                return httpResponse.statusCode == 200
            }
        } catch {
            logger.error("Token verification failed: \(error)")
        }

        return false
    }

    /// Logout and clear authentication
    func logout() async {
        // Call logout endpoint if authenticated
        if let token = authToken {
            let url = serverConfig.apiURL(path: "/api/auth/logout")
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

            do {
                _ = try await URLSession.shared.data(for: request)
            } catch {
                logger.error("Logout request failed: \(error)")
            }
        }

        // Clear stored credentials
        try? KeychainService.deletePassword(for: tokenKey)
        try? KeychainService.deletePassword(for: userDataKey)

        // Clear state
        authToken = nil
        currentUser = nil
        authMethod = nil
        isAuthenticated = false
    }

    /// Get authentication header for API requests
    func getAuthHeader() -> [String: String] {
        guard let token = authToken else { return [:] }
        return ["Authorization": "Bearer \(token)"]
    }

    /// Get token for query parameters (used for SSE)
    func getTokenForQuery() -> String? {
        authToken
    }

    // MARK: - Private Methods

    private func checkExistingAuth() async {
        // Try to load existing token
        if let token = try? KeychainService.loadPassword(for: tokenKey),
           let userDataJson = try? KeychainService.loadPassword(for: userDataKey),
           let userDataData = userDataJson.data(using: .utf8),
           let userData = try? JSONDecoder().decode(UserData.self, from: userDataData)
        {
            // Check if token is less than 24 hours old
            let tokenAge = Date().timeIntervalSince(userData.loginTime)
            if tokenAge < 24 * 60 * 60 { // 24 hours
                self.authToken = token
                self.currentUser = userData.userId
                self.authMethod = AuthMethod(rawValue: userData.authMethod)

                // Verify token is still valid
                if await verifyToken() {
                    self.isAuthenticated = true
                    logger.info("Restored authentication for user: \(userData.userId)")
                } else {
                    // Token invalid, clear it
                    await logout()
                }
            } else {
                // Token too old, clear it
                await logout()
            }
        }
    }
}

// MARK: - API Error Extension

extension APIError {
    static func authenticationFailed(_ message: String) -> APIError {
        APIError.serverError(500, message)
    }

    static var dataEncodingFailed: APIError {
        APIError.serverError(500, "Failed to encode authentication data")
    }
}
