import Foundation

/// Errors that can occur during API operations.
enum APIError: LocalizedError {
    case invalidURL
    case noData
    case decodingError(Error)
    case serverError(Int, String?)
    case networkError(Error)
    case noServerConfigured
    case invalidResponse
    case resizeDisabledByServer

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .noData:
            return "No data received"
        case .decodingError(let error):
            return "Failed to decode response: \(error.localizedDescription)"
        case .serverError(let code, let message):
            if let message {
                return message
            }
            switch code {
            case 400:
                return "Bad request - check your input"
            case 401:
                return "Unauthorized - authentication required"
            case 403:
                return "Forbidden - access denied"
            case 404:
                return "Not found - endpoint doesn't exist"
            case 500:
                return "Server error - internal server error"
            case 502:
                return "Bad gateway - server is down"
            case 503:
                return "Service unavailable"
            default:
                return "Server error: \(code)"
            }
        case .networkError(let error):
            if let urlError = error as? URLError {
                switch urlError.code {
                case .notConnectedToInternet:
                    return "No internet connection"
                case .cannotFindHost:
                    return "Cannot find server - check the address"
                case .cannotConnectToHost:
                    return "Cannot connect to server - is it running?"
                case .timedOut:
                    return "Connection timed out"
                case .networkConnectionLost:
                    return "Network connection lost"
                default:
                    return urlError.localizedDescription
                }
            }
            return error.localizedDescription
        case .noServerConfigured:
            return "No server configured"
        case .invalidResponse:
            return "Invalid server response"
        case .resizeDisabledByServer:
            return "Terminal resizing is disabled by the server"
        }
    }
}

/// Protocol defining the API client interface for VibeTunnel server communication.
protocol APIClientProtocol {
    func getSessions() async throws -> [Session]
    func getSession(_ sessionId: String) async throws -> Session
    func createSession(_ data: SessionCreateData) async throws -> String
    func killSession(_ sessionId: String) async throws
    func cleanupSession(_ sessionId: String) async throws
    func cleanupAllExitedSessions() async throws -> [String]
    func killAllSessions() async throws
    func sendInput(sessionId: String, text: String) async throws
    func resizeTerminal(sessionId: String, cols: Int, rows: Int) async throws
    func checkHealth() async throws -> Bool
}

/// Main API client for communicating with the VibeTunnel server.
///
/// APIClient handles all HTTP requests to the server including session management,
/// terminal I/O, and file system operations. It uses URLSession for networking
/// and provides async/await interfaces for all operations.
@MainActor
class APIClient: APIClientProtocol {
    static let shared = APIClient()
    private let session = URLSession.shared
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    private var baseURL: URL? {
        guard let config = UserDefaults.standard.data(forKey: "savedServerConfig"),
              let serverConfig = try? JSONDecoder().decode(ServerConfig.self, from: config)
        else {
            return nil
        }
        return serverConfig.baseURL
    }

    private init() {}

    // MARK: - Session Management

    func getSessions() async throws -> [Session] {
        guard let baseURL else {
            throw APIError.noServerConfigured
        }

        let url = baseURL.appendingPathComponent("api/sessions")
        let (data, response) = try await session.data(from: url)

        try validateResponse(response)

        do {
            return try decoder.decode([Session].self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    func getSession(_ sessionId: String) async throws -> Session {
        guard let baseURL else {
            throw APIError.noServerConfigured
        }

        let url = baseURL.appendingPathComponent("api/sessions/\(sessionId)")
        let (data, response) = try await session.data(from: url)

        try validateResponse(response)

        do {
            return try decoder.decode(Session.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    func createSession(_ data: SessionCreateData) async throws -> String {
        guard let baseURL else {
            print("[APIClient] No server configured")
            throw APIError.noServerConfigured
        }

        let url = baseURL.appendingPathComponent("api/sessions")
        print("[APIClient] Creating session at URL: \(url)")

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        addAuthenticationIfNeeded(&request)

        do {
            request.httpBody = try encoder.encode(data)
            if let bodyString = String(data: request.httpBody ?? Data(), encoding: .utf8) {
                print("[APIClient] Request body: \(bodyString)")
            }
        } catch {
            print("[APIClient] Failed to encode session data: \(error)")
            throw error
        }

        do {
            let (responseData, response) = try await session.data(for: request)

            print("[APIClient] Response received")
            if let httpResponse = response as? HTTPURLResponse {
                print("[APIClient] Status code: \(httpResponse.statusCode)")
                print("[APIClient] Headers: \(httpResponse.allHeaderFields)")
            }

            if let responseString = String(data: responseData, encoding: .utf8) {
                print("[APIClient] Response body: \(responseString)")
            }

            // Check if the response is an error
            if let httpResponse = response as? HTTPURLResponse, !(200..<300).contains(httpResponse.statusCode) {
                // Try to parse error response
                struct ErrorResponse: Codable {
                    let error: String?
                    let details: String?
                    let code: String?
                }

                if let errorResponse = try? decoder.decode(ErrorResponse.self, from: responseData) {
                    let errorMessage = errorResponse.details ?? errorResponse.error ?? "Unknown error"
                    print("[APIClient] Server error: \(errorMessage)")
                    throw APIError.serverError(httpResponse.statusCode, errorMessage)
                } else {
                    // Fallback to generic error
                    throw APIError.serverError(httpResponse.statusCode, nil)
                }
            }

            struct CreateResponse: Codable {
                let sessionId: String
            }

            let createResponse = try decoder.decode(CreateResponse.self, from: responseData)
            print("[APIClient] Session created with ID: \(createResponse.sessionId)")
            return createResponse.sessionId
        } catch {
            print("[APIClient] Request failed: \(error)")
            if let urlError = error as? URLError {
                print("[APIClient] URL Error code: \(urlError.code), description: \(urlError.localizedDescription)")
            }
            throw error
        }
    }

    func killSession(_ sessionId: String) async throws {
        guard let baseURL else {
            throw APIError.noServerConfigured
        }

        let url = baseURL.appendingPathComponent("api/sessions/\(sessionId)")
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        addAuthenticationIfNeeded(&request)

        let (_, response) = try await session.data(for: request)
        try validateResponse(response)
    }

    func cleanupSession(_ sessionId: String) async throws {
        guard let baseURL else {
            throw APIError.noServerConfigured
        }

        let url = baseURL.appendingPathComponent("api/sessions/\(sessionId)/cleanup")
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        addAuthenticationIfNeeded(&request)

        let (_, response) = try await session.data(for: request)
        try validateResponse(response)
    }

    func cleanupAllExitedSessions() async throws -> [String] {
        guard let baseURL else {
            throw APIError.noServerConfigured
        }

        let url = baseURL.appendingPathComponent("api/cleanup-exited")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        addAuthenticationIfNeeded(&request)

        let (data, response) = try await session.data(for: request)
        try validateResponse(response)

        // Handle empty response (204 No Content) from Go server
        if data.isEmpty {
            return []
        }

        struct CleanupResponse: Codable {
            let cleanedSessions: [String]
        }

        do {
            let cleanupResponse = try decoder.decode(CleanupResponse.self, from: data)
            return cleanupResponse.cleanedSessions
        } catch {
            // If decoding fails, return empty array
            return []
        }
    }

    func killAllSessions() async throws {
        // First get all sessions
        let sessions = try await getSessions()

        // Filter running sessions
        let runningSessions = sessions.filter(\.isRunning)

        // Kill each running session concurrently
        await withThrowingTaskGroup(of: Void.self) { group in
            for session in runningSessions {
                group.addTask { [weak self] in
                    try await self?.killSession(session.id)
                }
            }
        }
    }

    // MARK: - Terminal I/O

    func sendInput(sessionId: String, text: String) async throws {
        guard let baseURL else {
            throw APIError.noServerConfigured
        }

        let url = baseURL.appendingPathComponent("api/sessions/\(sessionId)/input")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        addAuthenticationIfNeeded(&request)

        let input = TerminalInput(text: text)
        request.httpBody = try encoder.encode(input)

        let (_, response) = try await session.data(for: request)
        try validateResponse(response)
    }

    func resizeTerminal(sessionId: String, cols: Int, rows: Int) async throws {
        guard let baseURL else {
            throw APIError.noServerConfigured
        }

        let url = baseURL.appendingPathComponent("api/sessions/\(sessionId)/resize")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        addAuthenticationIfNeeded(&request)

        let resize = TerminalResize(cols: cols, rows: rows)
        request.httpBody = try encoder.encode(resize)

        let (_, response) = try await session.data(for: request)
        try validateResponse(response)
    }

    // MARK: - SSE Stream URL

    func streamURL(for sessionId: String) -> URL? {
        guard let baseURL else { return nil }
        return baseURL.appendingPathComponent("api/sessions/\(sessionId)/stream")
    }

    func snapshotURL(for sessionId: String) -> URL? {
        guard let baseURL else { return nil }
        return baseURL.appendingPathComponent("api/sessions/\(sessionId)/snapshot")
    }

    func getSessionSnapshot(sessionId: String) async throws -> TerminalSnapshot {
        guard let baseURL else {
            throw APIError.noServerConfigured
        }

        let url = baseURL.appendingPathComponent("api/sessions/\(sessionId)/snapshot")
        let (data, response) = try await session.data(from: url)

        try validateResponse(response)

        // The snapshot endpoint returns plain text asciinema format, not JSON
        guard let text = String(data: data, encoding: .utf8) else {
            throw APIError.invalidResponse
        }

        // Parse asciinema format
        return try parseAsciinemaSnapshot(sessionId: sessionId, text: text)
    }

    private func parseAsciinemaSnapshot(sessionId: String, text: String) throws -> TerminalSnapshot {
        let lines = text.components(separatedBy: .newlines).filter { !$0.isEmpty }

        var header: AsciinemaHeader?
        var events: [AsciinemaEvent] = []

        for line in lines {
            guard let data = line.data(using: .utf8) else { continue }

            // Try to parse as JSON
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                // This is the header
                if let version = json["version"] as? Int,
                   let width = json["width"] as? Int,
                   let height = json["height"] as? Int {
                    header = AsciinemaHeader(
                        version: version,
                        width: width,
                        height: height,
                        timestamp: json["timestamp"] as? Double,
                        duration: json["duration"] as? Double,
                        command: json["command"] as? String,
                        title: json["title"] as? String,
                        env: json["env"] as? [String: String]
                    )
                }
            } else if let json = try? JSONSerialization.jsonObject(with: data) as? [Any] {
                // This is an event array [timestamp, type, data]
                if json.count >= 3,
                   let timestamp = json[0] as? Double,
                   let typeStr = json[1] as? String,
                   let eventData = json[2] as? String {
                    let eventType: AsciinemaEvent.EventType
                    switch typeStr {
                    case "o": eventType = .output
                    case "i": eventType = .input
                    case "r": eventType = .resize
                    case "m": eventType = .marker
                    default: continue
                    }

                    events.append(AsciinemaEvent(
                        time: timestamp,
                        type: eventType,
                        data: eventData
                    ))
                }
            }
        }

        return TerminalSnapshot(
            sessionId: sessionId,
            header: header,
            events: events
        )
    }

    // MARK: - Server Health

    func checkHealth() async throws -> Bool {
        guard let baseURL else {
            throw APIError.noServerConfigured
        }

        let url = baseURL.appendingPathComponent("api/health")
        var request = URLRequest(url: url)
        request.timeoutInterval = 5.0 // Quick timeout for health check

        do {
            let (_, response) = try await session.data(for: request)

            if let httpResponse = response as? HTTPURLResponse {
                return httpResponse.statusCode == 200
            }
            return false
        } catch {
            // Health check failure doesn't throw, just returns false
            return false
        }
    }

    // MARK: - Helpers

    private func validateResponse(_ response: URLResponse) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            print("[APIClient] Invalid response type (not HTTP)")
            throw APIError.networkError(URLError(.badServerResponse))
        }

        guard 200..<300 ~= httpResponse.statusCode else {
            print("[APIClient] Server error: HTTP \(httpResponse.statusCode)")
            throw APIError.serverError(httpResponse.statusCode, nil)
        }
    }

    private func addAuthenticationIfNeeded(_ request: inout URLRequest) {
        // Add authorization header from server config
        if let authHeader = ConnectionManager.shared.currentServerConfig?.authorizationHeader {
            request.setValue(authHeader, forHTTPHeaderField: "Authorization")
        }
    }

    // MARK: - File System Operations

    func browseDirectory(path: String, showHidden: Bool = false, gitFilter: String = "all") async throws -> DirectoryListing {
        guard let baseURL else {
            throw APIError.noServerConfigured
        }

        guard var components = URLComponents(
            url: baseURL.appendingPathComponent("api/fs/browse"),
            resolvingAgainstBaseURL: false
        ) else {
            throw APIError.invalidURL
        }
        components.queryItems = [
            URLQueryItem(name: "path", value: path),
            URLQueryItem(name: "showHidden", value: String(showHidden)),
            URLQueryItem(name: "gitFilter", value: gitFilter)
        ]

        guard let url = components.url else {
            throw APIError.invalidResponse
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"

        // Add authentication header if needed
        addAuthenticationIfNeeded(&request)

        let (data, response) = try await session.data(for: request)

        // Log response for debugging
        if let httpResponse = response as? HTTPURLResponse {
            print("[APIClient] Browse directory response: \(httpResponse.statusCode)")
            if httpResponse.statusCode >= 400 {
                if let errorString = String(data: data, encoding: .utf8) {
                    print("[APIClient] Error response body: \(errorString)")
                }
            }
        }

        try validateResponse(response)

        // Decode the DirectoryListing response
        return try decoder.decode(DirectoryListing.self, from: data)
    }

    func createDirectory(path: String) async throws {
        guard let baseURL else {
            throw APIError.noServerConfigured
        }

        let url = baseURL.appendingPathComponent("api/mkdir")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        addAuthenticationIfNeeded(&request)

        struct CreateDirectoryRequest: Codable {
            let path: String
        }

        let requestBody = CreateDirectoryRequest(path: path)
        request.httpBody = try encoder.encode(requestBody)

        let (_, response) = try await session.data(for: request)
        try validateResponse(response)
    }

    func downloadFile(path: String, progressHandler: ((Double) -> Void)? = nil) async throws -> Data {
        guard let baseURL else {
            throw APIError.noServerConfigured
        }

        guard var components = URLComponents(
            url: baseURL.appendingPathComponent("api/fs/read"),
            resolvingAgainstBaseURL: false
        ) else {
            throw APIError.invalidURL
        }
        components.queryItems = [URLQueryItem(name: "path", value: path)]

        guard let url = components.url else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"

        // Add authentication header if needed
        addAuthenticationIfNeeded(&request)

        // For progress tracking, we'll use URLSession delegate
        // For now, just download the whole file
        let (data, response) = try await session.data(for: request)
        try validateResponse(response)

        return data
    }

    func getFileInfo(path: String) async throws -> FileInfo {
        guard let baseURL else {
            throw APIError.noServerConfigured
        }

        guard var components = URLComponents(
            url: baseURL.appendingPathComponent("api/fs/info"),
            resolvingAgainstBaseURL: false
        ) else {
            throw APIError.invalidURL
        }
        components.queryItems = [URLQueryItem(name: "path", value: path)]

        guard let url = components.url else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"

        // Add authentication header if needed
        addAuthenticationIfNeeded(&request)

        let (data, response) = try await session.data(for: request)
        try validateResponse(response)

        return try decoder.decode(FileInfo.self, from: data)
    }
}
