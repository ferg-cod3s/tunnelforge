import Darwin
import Foundation
import OSLog

/// Manages UNIX socket connection for screen capture communication with automatic reconnection
@MainActor
final class UnixSocketConnection {
    private let logger = Logger(subsystem: "sh.vibetunnel.vibetunnel", category: "UnixSocket")

    // MARK: - Properties

    private nonisolated(unsafe) var socketFD: Int32 = -1
    private let socketPath: String
    private let queue = DispatchQueue(label: "sh.vibetunnel.unix-socket", qos: .userInitiated)

    /// Socket state
    private(set) var isConnected = false
    private var isConnecting = false

    /// Buffer for accumulating partial messages
    private var receiveBuffer = Data()

    /// Task for continuous message receiving
    private var receiveTask: Task<Void, Never>?

    /// Keep-alive timer
    private var keepAliveTimer: Timer?
    private let keepAliveInterval: TimeInterval = 30.0
    private var lastPongTime = Date()

    /// Reconnection management
    private var reconnectTask: Task<Void, Never>?
    private var reconnectDelay: TimeInterval = 1.0
    private let initialReconnectDelay: TimeInterval = 1.0
    private let maxReconnectDelay: TimeInterval = 30.0
    private var isReconnecting = false
    private var shouldReconnect = true
    private var consecutiveFailures = 0

    /// Message queuing for reliability
    private var pendingMessages: [(data: Data, completion: (@Sendable (Error?) -> Void)?)] = []
    private let maxPendingMessages = 100

    /// Connection state tracking
    private var lastConnectionTime: Date?

    /// Message handler callback
    var onMessage: ((Data) -> Void)?

    /// Connection state change callback
    var onStateChange: ((ConnectionState) -> Void)?

    /// Connection states similar to NWConnection.State
    enum ConnectionState {
        case setup
        case preparing
        case ready
        case failed(Error)
        case cancelled
        case waiting(Error)
    }

    // MARK: - Initialization

    init(socketPath: String? = nil) {
        // Use socket path in user's home directory to avoid /tmp issues
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        self.socketPath = socketPath ?? "\(home)/.vibetunnel/control.sock"
        logger.info("Unix socket initialized with path: \(self.socketPath)")
    }

    deinit {
        shouldReconnect = false
        // Close socket directly in deinit since we can't call @MainActor methods
        if socketFD >= 0 {
            close(socketFD)
            socketFD = -1
        }
    }

    // MARK: - Public Methods

    /// Connect to the UNIX socket with automatic reconnection
    func connect() {
        logger.info("🔌 Connecting to UNIX socket at \(self.socketPath)")

        guard !isConnecting else {
            logger.debug("Connection attempt already in progress.")
            return
        }

        // Reset reconnection state if this is a new top-level call
        if !isReconnecting {
            shouldReconnect = true
            reconnectDelay = initialReconnectDelay
            consecutiveFailures = 0
        }

        isConnecting = true
        onStateChange?(.preparing)

        // Connect on background queue
        queue.async { [weak self] in
            self?.establishConnection()
        }
    }

    /// Establish the actual connection using C socket API
    private nonisolated func establishConnection() {
        // Close any existing socket
        if socketFD >= 0 {
            close(socketFD)
            socketFD = -1
        }

        // Create socket
        socketFD = socket(AF_UNIX, SOCK_STREAM, 0)
        guard socketFD >= 0 else {
            let error = POSIXError(POSIXErrorCode(rawValue: errno) ?? .ECONNREFUSED)
            logger.error("Failed to create socket: \(error.localizedDescription)")
            Task { @MainActor in
                self.handleConnectionError(error)
            }
            return
        }

        // Set socket buffer sizes for large messages
        var bufferSize: Int32 = 1_024 * 1_024 // 1MB buffer
        if setsockopt(socketFD, SOL_SOCKET, SO_SNDBUF, &bufferSize, socklen_t(MemoryLayout<Int32>.size)) < 0 {
            logger.warning("Failed to set send buffer size: \(String(cString: strerror(errno)))")
        } else {
            logger.info("📊 Set socket send buffer to 1MB")
        }

        if setsockopt(socketFD, SOL_SOCKET, SO_RCVBUF, &bufferSize, socklen_t(MemoryLayout<Int32>.size)) < 0 {
            logger.warning("Failed to set receive buffer size: \(String(cString: strerror(errno)))")
        } else {
            logger.info("📊 Set socket receive buffer to 1MB")
        }

        // Set socket to non-blocking mode
        let flags = fcntl(socketFD, F_GETFL, 0)
        if flags < 0 {
            logger.error("Failed to get socket flags")
            close(socketFD)
            socketFD = -1
            return
        }

        if fcntl(socketFD, F_SETFL, flags | O_NONBLOCK) < 0 {
            logger.error("Failed to set non-blocking mode")
            close(socketFD)
            socketFD = -1
            return
        }

        // Create socket address
        var address = sockaddr_un()
        address.sun_family = sa_family_t(AF_UNIX)

        // Copy socket path
        let pathBytes = socketPath.utf8CString
        guard pathBytes.count <= MemoryLayout.size(ofValue: address.sun_path) else {
            logger.error("Socket path too long")
            close(socketFD)
            socketFD = -1
            return
        }

        withUnsafeMutableBytes(of: &address.sun_path) { ptr in
            pathBytes.withUnsafeBytes { pathPtr in
                ptr.copyMemory(from: pathPtr)
            }
        }

        // Connect to socket
        let result = withUnsafePointer(to: &address) { ptr in
            ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { sockaddrPtr in
                Darwin.connect(socketFD, sockaddrPtr, socklen_t(MemoryLayout<sockaddr_un>.size))
            }
        }

        if result < 0 {
            let errorCode = errno
            if errorCode == EINPROGRESS {
                // Connection in progress (non-blocking)
                logger.info("Connection in progress...")
                waitForConnection()
            } else {
                let error = POSIXError(POSIXErrorCode(rawValue: errorCode) ?? .ECONNREFUSED)
                logger.error("Failed to connect: \(error.localizedDescription) (errno: \(errorCode))")
                close(socketFD)
                socketFD = -1
                Task { @MainActor in
                    self.handleConnectionError(error)
                }
            }
        } else {
            // Connected immediately
            Task { @MainActor in
                self.handleConnectionSuccess()
            }
        }
    }

    /// Wait for non-blocking connection to complete
    private nonisolated func waitForConnection() {
        queue.asyncAfter(deadline: .now() + 0.1) { [weak self] in
            guard let self, self.socketFD >= 0 else { return }

            var error: Int32 = 0
            var errorLen = socklen_t(MemoryLayout<Int32>.size)

            let result = getsockopt(self.socketFD, SOL_SOCKET, SO_ERROR, &error, &errorLen)

            if result < 0 {
                logger.error("Failed to get socket error")
                close(self.socketFD)
                self.socketFD = -1
                return
            }

            if error == 0 {
                // Connected successfully
                Task { @MainActor in
                    self.handleConnectionSuccess()
                }
            } else if error == EINPROGRESS {
                // Still connecting
                self.waitForConnection()
            } else {
                // Connection failed
                let posixError = POSIXError(POSIXErrorCode(rawValue: error) ?? .ECONNREFUSED)
                logger.error("Connection failed: \(posixError.localizedDescription)")
                close(self.socketFD)
                self.socketFD = -1
                Task { @MainActor in
                    self.handleConnectionError(posixError)
                }
            }
        }
    }

    /// Handle successful connection
    private func handleConnectionSuccess() {
        logger.info("✅ UNIX socket connected")
        isConnected = true
        isConnecting = false
        lastConnectionTime = Date()
        consecutiveFailures = 0
        reconnectDelay = initialReconnectDelay

        onStateChange?(.ready)

        // Start continuous receive loop
        startReceiveLoop()

        // Start keep-alive timer
        startKeepAlive()

        // Send any pending messages
        flushPendingMessages()
    }

    /// Handle connection error
    private func handleConnectionError(_ error: Error) {
        logger.error("❌ Connection failed: \(error)")
        isConnected = false
        isConnecting = false
        consecutiveFailures += 1

        onStateChange?(.failed(error))

        // Clean up
        cleanupConnection()

        // Schedule reconnection if appropriate
        if shouldReconnect {
            scheduleReconnect()
        }
    }

    /// Send a message with automatic retry on failure
    func send(_ message: some Encodable) async throws {
        logger.info("📤 Sending control message...")
        let encoder = JSONEncoder()
        let data = try encoder.encode(message)

        // Log the message content for debugging
        if let str = String(data: data, encoding: .utf8) {
            logger.info("📤 Message content: \(String(str.prefix(500)))")
        }

        try await sendData(data)
    }

    /// Serial queue for message sending to prevent concurrent writes
    private let sendQueue = DispatchQueue(label: "sh.vibetunnel.unix-socket.send", qos: .userInitiated)

    /// Send raw dictionary message (for compatibility) with queuing
    func sendMessage(_ dict: [String: Any]) async {
        do {
            let data = try JSONSerialization.data(withJSONObject: dict, options: [])
            await sendDataWithErrorHandling(data)
        } catch {
            logger.error("Failed to serialize message: \(error)")
        }
    }

    /// Send data with proper error handling and reconnection
    private func sendData(_ data: Data) async throws {
        guard isConnected, socketFD >= 0 else {
            throw UnixSocketError.notConnected
        }

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            sendQueue.async { [weak self] in
                guard let self else {
                    continuation.resume(throwing: UnixSocketError.notConnected)
                    return
                }

                // Ensure socket is still valid
                guard self.socketFD >= 0 else {
                    continuation.resume(throwing: UnixSocketError.notConnected)
                    return
                }

                // Create message with 4-byte length header
                let lengthValue = UInt32(data.count).bigEndian
                var headerData = Data()
                withUnsafeBytes(of: lengthValue) { bytes in
                    headerData.append(contentsOf: bytes)
                }
                let fullData = headerData + data

                // Send data in chunks if needed
                var totalSent = 0
                var remainingData = fullData

                while totalSent < fullData.count {
                    let result = remainingData.withUnsafeBytes { ptr in
                        Darwin.send(self.socketFD, ptr.baseAddress, remainingData.count, 0)
                    }

                    if result < 0 {
                        let errorCode = errno
                        // Check if it's EAGAIN (would block) - that's okay for non-blocking
                        if errorCode == EAGAIN || errorCode == EWOULDBLOCK {
                            // Socket buffer is full, wait a bit and retry
                            usleep(1_000) // Wait 1ms
                            continue
                        }

                        let error = POSIXError(POSIXErrorCode(rawValue: errorCode) ?? .ECONNREFUSED)
                        Task { @MainActor in
                            self.handleSendError(error, errorCode: errorCode)
                        }
                        continuation.resume(throwing: error)
                        return
                    } else if result == 0 {
                        // Connection closed
                        let error = UnixSocketError.connectionClosed
                        Task { @MainActor in
                            self.logger.error("Connection closed during send")
                        }
                        continuation.resume(throwing: error)
                        return
                    } else {
                        totalSent += result
                        if result < remainingData.count {
                            // Partial send - remove sent bytes and continue
                            remainingData = remainingData.dropFirst(result)
                            let currentTotal = totalSent
                            Task { @MainActor in
                                self.logger.debug("Partial send: \(result) bytes, total: \(currentTotal)/\(data.count)")
                            }
                        } else {
                            // All data sent
                            break
                        }
                    }
                }

                continuation.resume()
            }
        }

        // Add a small delay between messages to prevent concatenation
        try? await Task.sleep(nanoseconds: 5_000_000) // 5ms
    }

    /// Send data with error handling but no throwing
    private func sendDataWithErrorHandling(_ data: Data) async {
        guard isConnected, socketFD >= 0 else {
            queueMessage(data)
            return
        }

        // Use send queue to ensure serialized writes
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            sendQueue.async { [weak self] in
                guard let self else {
                    continuation.resume()
                    return
                }

                // Ensure socket is still valid
                guard self.socketFD >= 0 else {
                    Task { @MainActor in
                        self.queueMessage(data)
                    }
                    continuation.resume()
                    return
                }

                // Create message with 4-byte length header
                let lengthValue = UInt32(data.count).bigEndian
                var headerData = Data()
                withUnsafeBytes(of: lengthValue) { bytes in
                    headerData.append(contentsOf: bytes)
                }
                let fullData = headerData + data

                // Send data in chunks if needed
                var totalSent = 0
                var remainingData = fullData

                while totalSent < fullData.count {
                    let result = remainingData.withUnsafeBytes { ptr in
                        Darwin.send(self.socketFD, ptr.baseAddress, remainingData.count, 0)
                    }

                    if result < 0 {
                        let errorCode = errno
                        // Check if it's EAGAIN (would block) - that's okay for non-blocking
                        if errorCode == EAGAIN || errorCode == EWOULDBLOCK {
                            // Socket buffer is full, wait a bit and retry
                            usleep(1_000) // Wait 1ms
                            continue
                        }

                        let error = POSIXError(POSIXErrorCode(rawValue: errorCode) ?? .ECONNREFUSED)
                        Task { @MainActor in
                            self.handleSendError(error, errorCode: errorCode)
                        }
                        break // Exit the loop on error
                    } else if result == 0 {
                        // Connection closed
                        Task { @MainActor in
                            self.logger.error("Connection closed during send")
                            self.handleConnectionError(UnixSocketError.connectionClosed)
                        }
                        break
                    } else {
                        totalSent += result
                        if result < remainingData.count {
                            // Partial send - remove sent bytes and continue
                            remainingData = remainingData.dropFirst(result)
                            let currentTotal = totalSent
                            Task { @MainActor in
                                self.logger.debug("Partial send: \(result) bytes, total: \(currentTotal)/\(data.count)")
                            }
                        } else {
                            // All data sent
                            Task { @MainActor in
                                self.logger.debug("✅ Message sent successfully: \(data.count) bytes")
                            }
                            break
                        }
                    }
                }

                continuation.resume()
            }
        }

        // Add a small delay between messages to prevent concatenation
        try? await Task.sleep(nanoseconds: 5_000_000) // 5ms
    }

    /// Handle send errors and trigger reconnection if needed
    private func handleSendError(_ error: Error, errorCode: Int32) {
        logger.error("Failed to send message: \(error)")
        logger.error("  Error code: \(errorCode)")

        // Check for broken pipe (EPIPE = 32)
        if errorCode == EPIPE {
            logger.warning("🔥 Broken pipe detected (EPIPE), triggering reconnection")
            scheduleReconnect()
        }
        // Check for other connection errors
        else if errorCode == ECONNRESET || // 54 - Connection reset
            errorCode == ECONNREFUSED || // 61 - Connection refused
            errorCode == ENOTCONN
        { // 57 - Not connected
            logger.warning("🔥 Connection error detected, triggering reconnection")
            scheduleReconnect()
        }
    }

    /// Disconnect from the socket
    func disconnect() {
        logger.info("🔌 Disconnecting from UNIX socket")

        // Stop reconnection attempts
        shouldReconnect = false

        // Cancel timers and tasks
        keepAliveTimer?.invalidate()
        keepAliveTimer = nil

        reconnectTask?.cancel()
        reconnectTask = nil

        // Cancel receive task
        receiveTask?.cancel()
        receiveTask = nil

        // Clear buffers
        receiveBuffer.removeAll()
        pendingMessages.removeAll()

        // Close socket
        if socketFD >= 0 {
            close(socketFD)
            socketFD = -1
        }

        isConnected = false

        onStateChange?(.cancelled)
    }

    // MARK: - Private Methods

    /// Clean up connection resources
    private func cleanupConnection() {
        keepAliveTimer?.invalidate()
        keepAliveTimer = nil

        receiveTask?.cancel()
        receiveTask = nil

        receiveBuffer.removeAll()
    }

    /// Schedule a reconnection attempt
    private func scheduleReconnect() {
        guard shouldReconnect && !isReconnecting else {
            logger
                .debug(
                    "Skipping reconnect: shouldReconnect=\(self.shouldReconnect), isReconnecting=\(self.isReconnecting)"
                )
            return
        }

        isReconnecting = true

        // Cancel any existing reconnect task
        reconnectTask?.cancel()

        logger
            .info(
                "🔄 Scheduling reconnection in \(String(format: "%.1f", self.reconnectDelay)) seconds (attempt #\(self.consecutiveFailures + 1))"
            )

        reconnectTask = Task { [weak self] in
            guard let self else { return }

            do {
                try await Task.sleep(nanoseconds: UInt64(self.reconnectDelay * 1_000_000_000))

                guard !Task.isCancelled && self.shouldReconnect else {
                    self.isReconnecting = false
                    return
                }

                logger.info("🔁 Attempting reconnection...")
                self.isReconnecting = false
                self.connect()

                // Increase delay for next attempt (exponential backoff)
                self.reconnectDelay = min(self.reconnectDelay * 1.5, self.maxReconnectDelay)
            } catch {
                self.isReconnecting = false
                if !Task.isCancelled {
                    logger.error("Reconnection task error: \(error)")
                }
            }
        }
    }

    /// Queue a message for later delivery
    private func queueMessage(_ data: Data, completion: (@Sendable (Error?) -> Void)? = nil) {
        guard pendingMessages.count < maxPendingMessages else {
            logger.warning("Pending message queue full, dropping oldest message")
            pendingMessages.removeFirst()
            return
        }

        pendingMessages.append((data: data, completion: completion))
        logger.debug("Queued message (total pending: \(self.pendingMessages.count))")
    }

    /// Send all pending messages
    private func flushPendingMessages() {
        guard !pendingMessages.isEmpty else { return }

        logger.info("📤 Flushing \(self.pendingMessages.count) pending messages")

        let messages = pendingMessages
        pendingMessages.removeAll()

        Task {
            for (data, completion) in messages {
                guard isConnected, socketFD >= 0 else {
                    // Re-queue if connection lost again
                    queueMessage(data, completion: completion)
                    break
                }

                // Use send queue to ensure serialized writes
                await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
                    sendQueue.async { [weak self] in
                        guard let self else {
                            continuation.resume()
                            return
                        }

                        guard self.socketFD >= 0 else {
                            Task { @MainActor in
                                self.queueMessage(data)
                            }
                            // Call completion with not connected error
                            completion?(UnixSocketError.notConnected)
                            continuation.resume()
                            return
                        }

                        // Create message with 4-byte length header
                        var lengthHeader = UInt32(data.count).bigEndian
                        let headerData = Data(bytes: &lengthHeader, count: 4)
                        let fullData = headerData + data

                        // Send data in chunks if needed
                        var totalSent = 0
                        var remainingData = fullData
                        var sendError: Error?

                        while totalSent < fullData.count && sendError == nil {
                            let result = remainingData.withUnsafeBytes { ptr in
                                Darwin.send(self.socketFD, ptr.baseAddress, remainingData.count, 0)
                            }

                            if result < 0 {
                                let errorCode = errno
                                // Check if it's EAGAIN (would block) - that's okay for non-blocking
                                if errorCode == EAGAIN || errorCode == EWOULDBLOCK {
                                    // Socket buffer is full, wait a bit and retry
                                    usleep(1_000) // Wait 1ms
                                    continue
                                }

                                let error = POSIXError(POSIXErrorCode(rawValue: errorCode) ?? .ECONNREFUSED)
                                sendError = error
                                Task { @MainActor in
                                    self.logger.error("Failed to send pending message: \(error)")
                                }
                            } else if result == 0 {
                                sendError = UnixSocketError.connectionClosed
                                Task { @MainActor in
                                    self.logger.error("Connection closed while sending pending message")
                                }
                            } else {
                                totalSent += result
                                if result < remainingData.count {
                                    // Partial send - remove sent bytes and continue
                                    remainingData = remainingData.dropFirst(result)
                                } else {
                                    // All data sent
                                    Task { @MainActor in
                                        self.logger.debug("✅ Sent pending message: \(data.count) bytes")
                                    }
                                }
                            }
                        }

                        completion?(sendError)

                        continuation.resume()
                    }
                }

                // Small delay between messages to avoid concatenation
                try? await Task.sleep(nanoseconds: 10_000_000) // 10ms
            }
        }
    }

    // MARK: - Keep-Alive

    /// Start keep-alive mechanism
    private func startKeepAlive() {
        keepAliveTimer?.invalidate()

        keepAliveTimer = Timer.scheduledTimer(withTimeInterval: keepAliveInterval, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                await self?.sendKeepAlive()
            }
        }
    }

    /// Send keep-alive ping
    private func sendKeepAlive() async {
        guard isConnected else { return }

        let timeSinceLastPong = Date().timeIntervalSince(lastPongTime)
        if timeSinceLastPong > keepAliveInterval * 2 {
            logger
                .warning("⚠️ No pong received for \(String(format: "%.0f", timeSinceLastPong))s, connection may be dead")
            // Trigger reconnection
            scheduleReconnect()
            return
        }

        let pingMessage = ControlProtocol.createRequest(category: .system, action: "ping")
        Task {
            do {
                try await send(pingMessage)
                logger.debug("🏓 Sent keep-alive ping")
            } catch {
                logger.error("Failed to send keep-alive ping: \(error)")
            }
        }
    }

    /// Start continuous receive loop
    private func startReceiveLoop() {
        receiveTask?.cancel()
        receiveTask = Task { [weak self] in
            while !Task.isCancelled {
                guard let self else { break }
                await self.receiveNextMessage()
            }
        }
    }

    /// Receive next message from the connection
    private func receiveNextMessage() async {
        guard isConnected, socketFD >= 0 else {
            // Add a small delay to prevent busy loop
            try? await Task.sleep(nanoseconds: 100_000_000) // 100ms
            return
        }

        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            queue.async { [weak self] in
                guard let self, self.socketFD >= 0 else {
                    continuation.resume()
                    return
                }

                var buffer = [UInt8](repeating: 0, count: 65_536) // Increased from 4KB to 64KB
                let bytesRead = recv(self.socketFD, &buffer, buffer.count, 0)

                if bytesRead > 0 {
                    let data = Data(bytes: buffer, count: bytesRead)
                    Task { @MainActor in
                        self.processReceivedData(data)
                    }
                } else if bytesRead == 0 {
                    // Connection closed
                    Task { @MainActor in
                        self.logger.warning("⚠️ Connection closed by peer (recv returned 0)")
                        self.logger.warning("  Socket FD: \(self.socketFD)")
                        self.logger.warning("  Was connected: \(self.isConnected)")
                        self.logger.warning("  Receive buffer had \(self.receiveBuffer.count) bytes")
                        self.handleConnectionError(UnixSocketError.connectionClosed)
                    }
                } else {
                    let errorCode = errno
                    if errorCode != EAGAIN && errorCode != EWOULDBLOCK {
                        let error = POSIXError(POSIXErrorCode(rawValue: errorCode) ?? .ECONNREFUSED)
                        Task { @MainActor in
                            self.logger.error("Receive error: \(error) (errno: \(errorCode))")
                            if errorCode == EPIPE || errorCode == ECONNRESET || errorCode == ENOTCONN {
                                self.logger.warning("Connection error during receive, triggering reconnection")
                                self.scheduleReconnect()
                            }
                        }
                    }
                }

                continuation.resume()
            }
        }

        // Small delay between receive attempts
        try? await Task.sleep(nanoseconds: 10_000_000) // 10ms
    }

    /// Process received data with proper message framing
    private func processReceivedData(_ data: Data) {
        logger.debug("📥 Received \(data.count) bytes of data")
        receiveBuffer.append(data)
        logger.debug("📦 Buffer now contains \(self.receiveBuffer.count) bytes")

        // Process as many messages as we can from the buffer
        while receiveBuffer.count >= 4 {
            // Read the message length header (4 bytes, big-endian UInt32)
            let messageLength = receiveBuffer.prefix(4)
                .withUnsafeBytes { UInt32(bigEndian: $0.loadUnaligned(as: UInt32.self)) }

            logger.debug("📏 Next message length from header: \(messageLength) bytes")

            // Check against reasonable upper bound to guard against corrupted headers
            guard messageLength < 10_000_000 else { // 10MB max message size (matching Node.js peer)
                logger.error("Corrupted message header: length=\(messageLength)")
                receiveBuffer.removeAll() // Clear corrupted buffer
                break
            }

            let needed = Int(messageLength) + 4
            guard receiveBuffer.count >= needed else { break }

            // Extract the complete message body (skip the 4-byte header)
            let body = Data(receiveBuffer.dropFirst(4).prefix(Int(messageLength)))
            receiveBuffer.removeFirst(needed)

            // Check for keep-alive pong
            if let msgDict = try? JSONSerialization.jsonObject(with: body) as? [String: Any],
               let type = msgDict["type"] as? String,
               type == "response",
               let category = msgDict["category"] as? String,
               category == "system",
               let action = msgDict["action"] as? String,
               action == "ping"
            {
                lastPongTime = Date()
                logger.debug("🏓 Received keep-alive pong")
                continue
            }

            // Deliver the complete message
            logger.info("📨 Delivering message of size \(body.count) bytes")
            if let str = String(data: body, encoding: .utf8) {
                logger.info("📨 Message content: \(String(str.prefix(500)))")
            }

            if let handler = onMessage {
                handler(body)
            } else {
                logger.warning("⚠️ No message handler registered - message will be dropped!")
            }
        }

        // If buffer grows too large, clear it to prevent memory issues
        if receiveBuffer.count > 10 * 1_024 * 1_024 { // 10MB limit (matching Node.js peer)
            logger.warning("Receive buffer exceeded 10MB, clearing to prevent memory issues")
            receiveBuffer.removeAll()
        }
    }
}

// MARK: - Errors

enum UnixSocketError: LocalizedError {
    case notConnected
    case connectionFailed(Error)
    case sendFailed(Error)
    case connectionClosed

    var errorDescription: String? {
        switch self {
        case .notConnected:
            "UNIX socket not connected"
        case .connectionFailed(let error):
            "Connection failed: \(error.localizedDescription)"
        case .sendFailed(let error):
            "Send failed: \(error.localizedDescription)"
        case .connectionClosed:
            "Connection closed by peer"
        }
    }
}
