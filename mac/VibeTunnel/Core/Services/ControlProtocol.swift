import Foundation

/// Control message protocol for unified Unix socket communication
enum ControlProtocol {
    // MARK: - Message Types

    enum MessageType: String, Codable {
        case request
        case response
        case event
    }

    enum Category: String, Codable {
        case terminal
        case git
        case system
    }

    // MARK: - Control Message Structure (with generic payload support)

    struct ControlMessage<Payload: Codable>: Codable {
        let id: String
        let type: MessageType
        let category: Category
        let action: String
        let payload: Payload?
        let sessionId: String?
        let error: String?

        init(
            id: String = UUID().uuidString,
            type: MessageType,
            category: Category,
            action: String,
            payload: Payload? = nil,
            sessionId: String? = nil,
            error: String? = nil
        ) {
            self.id = id
            self.type = type
            self.category = category
            self.action = action
            self.payload = payload
            self.sessionId = sessionId
            self.error = error
        }
    }

    // MARK: - Base message for runtime dispatch

    protocol AnyControlMessage {
        var id: String { get }
        var type: MessageType { get }
        var category: Category { get }
        var action: String { get }
        var sessionId: String? { get }
        var error: String? { get }
    }

    // MARK: - Type aliases for common message types

    typealias TerminalSpawnRequestMessage = ControlMessage<TerminalSpawnRequest>
    typealias TerminalSpawnResponseMessage = ControlMessage<TerminalSpawnResponse>
    typealias SystemReadyMessage = ControlMessage<SystemReadyEvent>
    typealias SystemPingRequestMessage = ControlMessage<SystemPingRequest>
    typealias SystemPingResponseMessage = ControlMessage<SystemPingResponse>
    typealias RepositoryPathUpdateRequestMessage = ControlMessage<RepositoryPathUpdateRequest>
    typealias RepositoryPathUpdateResponseMessage = ControlMessage<RepositoryPathUpdateResponse>

    // MARK: - Convenience builders for specific message types

    /// Terminal messages
    static func terminalSpawnRequest(
        sessionId: String,
        workingDirectory: String? = nil,
        command: String? = nil,
        terminalPreference: String? = nil
    )
        -> TerminalSpawnRequestMessage
    {
        ControlMessage(
            type: .request,
            category: .terminal,
            action: "spawn",
            payload: TerminalSpawnRequest(
                sessionId: sessionId,
                workingDirectory: workingDirectory,
                command: command,
                terminalPreference: terminalPreference
            ),
            sessionId: sessionId
        )
    }

    /// Build a spawn response
    /// NOTE: Error Duplication Pattern
    /// Both top-level error and payload error fields are set intentionally:
    /// - Top-level error: Indicates transport/protocol-level errors (malformed request, handler not found)
    /// - Payload error: Indicates application-level errors (spawn failed due to permissions)
    /// This separation allows clients to distinguish between different error types.
    static func terminalSpawnResponse(
        to request: TerminalSpawnRequestMessage,
        success: Bool,
        pid: Int? = nil,
        error: String? = nil
    )
        -> TerminalSpawnResponseMessage
    {
        ControlMessage(
            id: request.id,
            type: .response,
            category: .terminal,
            action: "spawn",
            payload: TerminalSpawnResponse(success: success, pid: pid, error: error),
            sessionId: request.sessionId,
            error: error
        )
    }

    /// System messages
    static func systemReadyEvent() -> SystemReadyMessage {
        ControlMessage(
            type: .event,
            category: .system,
            action: "ready",
            payload: SystemReadyEvent()
        )
    }

    static func systemPingRequest() -> SystemPingRequestMessage {
        ControlMessage(
            type: .request,
            category: .system,
            action: "ping",
            payload: SystemPingRequest()
        )
    }

    static func systemPingResponse(
        to request: SystemPingRequestMessage
    )
        -> SystemPingResponseMessage
    {
        ControlMessage(
            id: request.id,
            type: .response,
            category: .system,
            action: "ping",
            payload: SystemPingResponse()
        )
    }

    static func repositoryPathUpdateRequest(path: String) -> RepositoryPathUpdateRequestMessage {
        ControlMessage(
            type: .request,
            category: .system,
            action: "repository-path-update",
            payload: RepositoryPathUpdateRequest(path: path)
        )
    }

    static func repositoryPathUpdateResponse(
        to request: RepositoryPathUpdateRequestMessage,
        success: Bool,
        path: String? = nil,
        error: String? = nil
    )
        -> RepositoryPathUpdateResponseMessage
    {
        ControlMessage(
            id: request.id,
            type: .response,
            category: .system,
            action: "repository-path-update",
            payload: RepositoryPathUpdateResponse(
                success: success,
                path: path,
                error: error
            ),
            error: error
        )
    }

    // MARK: - Message Serialization

    static func encode(_ message: ControlMessage<some Codable>) throws -> Data {
        let encoder = JSONEncoder()
        return try encoder.encode(message)
    }

    static func decode<T: Codable>(_ data: Data, as messageType: ControlMessage<T>.Type) throws -> ControlMessage<T> {
        let decoder = JSONDecoder()
        return try decoder.decode(messageType, from: data)
    }

    /// Special encoder for messages with [String: Any] payloads
    static func encodeWithDictionaryPayload(
        id: String = UUID().uuidString,
        type: MessageType,
        category: Category,
        action: String,
        payload: [String: Any]? = nil,
        sessionId: String? = nil,
        error: String? = nil
    )
        throws -> Data
    {
        var dict: [String: Any] = [
            "id": id,
            "type": type.rawValue,
            "category": category.rawValue,
            "action": action
        ]

        if let payload {
            dict["payload"] = payload
        }
        if let sessionId {
            dict["sessionId"] = sessionId
        }
        if let error {
            dict["error"] = error
        }

        return try JSONSerialization.data(withJSONObject: dict)
    }

    /// For handlers that need to decode specific message types based on action
    static func decodeTerminalSpawnRequest(_ data: Data) throws -> TerminalSpawnRequestMessage {
        try decode(data, as: TerminalSpawnRequestMessage.self)
    }

    static func decodeSystemPingRequest(_ data: Data) throws -> SystemPingRequestMessage {
        try decode(data, as: SystemPingRequestMessage.self)
    }

    // Empty payload for messages that don't need data
    struct EmptyPayload: Codable {}
    typealias EmptyMessage = ControlMessage<EmptyPayload>
}

// MARK: - Protocol Conformance

extension ControlProtocol.ControlMessage: ControlProtocol.AnyControlMessage {}
