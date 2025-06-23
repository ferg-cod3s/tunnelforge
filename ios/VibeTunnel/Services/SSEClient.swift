import Foundation

/// Server-Sent Events (SSE) client for real-time terminal output streaming.
///
/// SSEClient handles the text-based streaming protocol used by the VibeTunnel server
/// to send terminal output in real-time. It parses the event stream format and
/// provides decoded events to a delegate.
final class SSEClient: NSObject, @unchecked Sendable {
    private var task: URLSessionDataTask?
    private var session: URLSession!
    private let url: URL
    private var buffer = Data()
    weak var delegate: SSEClientDelegate?
    
    /// Events received from the SSE stream
    enum SSEEvent {
        case terminalOutput(timestamp: Double, type: String, data: String)
        case exit(exitCode: Int, sessionId: String)
        case error(String)
    }
    
    init(url: URL) {
        self.url = url
        super.init()
        
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 0 // No timeout for SSE
        configuration.timeoutIntervalForResource = 0
        configuration.requestCachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        
        self.session = URLSession(configuration: configuration, delegate: self, delegateQueue: .main)
    }
    
    func start() {
        var request = URLRequest(url: url)
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        request.setValue("no-cache", forHTTPHeaderField: "Cache-Control")
        
        // Add authentication if needed
        if let authHeader = ConnectionManager.shared.currentServerConfig?.authorizationHeader {
            request.setValue(authHeader, forHTTPHeaderField: "Authorization")
        }
        
        task = session.dataTask(with: request)
        task?.resume()
    }
    
    func stop() {
        task?.cancel()
        task = nil
    }
    
    private func processBuffer() {
        // Convert buffer to string
        guard let string = String(data: buffer, encoding: .utf8) else { return }
        
        // Split by double newline (SSE event separator)
        let events = string.components(separatedBy: "\n\n")
        
        // Keep the last incomplete event in buffer
        if !string.hasSuffix("\n\n") && events.count > 1 {
            if let lastEvent = events.last, let lastEventData = lastEvent.data(using: .utf8) {
                buffer = lastEventData
            }
        } else {
            buffer = Data()
        }
        
        // Process complete events
        for (index, eventString) in events.enumerated() {
            // Skip the last event if buffer wasn't cleared (it's incomplete)
            if index == events.count - 1 && !buffer.isEmpty {
                continue
            }
            
            if !eventString.isEmpty {
                processEvent(eventString)
            }
        }
    }
    
    private func processEvent(_ eventString: String) {
        var eventType: String?
        var eventData: String?
        
        // Parse SSE format
        let lines = eventString.components(separatedBy: "\n")
        for line in lines {
            if line.hasPrefix("event:") {
                eventType = String(line.dropFirst(6)).trimmingCharacters(in: .whitespaces)
            } else if line.hasPrefix("data:") {
                let data = String(line.dropFirst(5)).trimmingCharacters(in: .whitespaces)
                if eventData == nil {
                    eventData = data
                } else {
                    eventData! += "\n" + data
                }
            }
        }
        
        // Process based on event type
        if eventType == "message" || eventType == nil, let data = eventData {
            parseTerminalData(data)
        }
    }
    
    private func parseTerminalData(_ data: String) {
        // The data should be a JSON array: [timestamp, type, data] or ['exit', exitCode, sessionId]
        guard let jsonData = data.data(using: .utf8) else { return }
        
        do {
            if let array = try JSONSerialization.jsonObject(with: jsonData) as? [Any] {
                if array.count >= 3 {
                    // Check for exit event
                    if let firstElement = array[0] as? String, firstElement == "exit",
                       let exitCode = array[1] as? Int,
                       let sessionId = array[2] as? String {
                        delegate?.sseClient(self, didReceiveEvent: .exit(exitCode: exitCode, sessionId: sessionId))
                    }
                    // Regular terminal output
                    else if let timestamp = array[0] as? Double,
                            let type = array[1] as? String,
                            let outputData = array[2] as? String {
                        delegate?.sseClient(self, didReceiveEvent: .terminalOutput(timestamp: timestamp, type: type, data: outputData))
                    }
                }
            }
        } catch {
            print("[SSEClient] Failed to parse event data: \(error)")
        }
    }
    
    deinit {
        stop()
    }
}

// MARK: - URLSessionDataDelegate
extension SSEClient: URLSessionDataDelegate {
    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse, completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
        guard let httpResponse = response as? HTTPURLResponse else {
            completionHandler(.cancel)
            return
        }
        
        if httpResponse.statusCode == 200 {
            completionHandler(.allow)
        } else {
            delegate?.sseClient(self, didReceiveEvent: .error("HTTP \(httpResponse.statusCode)"))
            completionHandler(.cancel)
        }
    }
    
    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        buffer.append(data)
        processBuffer()
    }
    
    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let error = error {
            if (error as NSError).code != NSURLErrorCancelled {
                delegate?.sseClient(self, didReceiveEvent: .error(error.localizedDescription))
            }
        }
    }
}

// MARK: - SSEClientDelegate
protocol SSEClientDelegate: AnyObject {
    func sseClient(_ client: SSEClient, didReceiveEvent event: SSEClient.SSEEvent)
}