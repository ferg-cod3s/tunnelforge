package api

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/gorilla/websocket"
	"github.com/vibetunnel/linux/pkg/protocol"
	"github.com/vibetunnel/linux/pkg/session"
)

const (
	// Magic byte for binary messages
	BufferMagicByte = 0xbf
	
	// WebSocket timeouts
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 512 * 1024 // 512KB
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins for now
		return true
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

type BufferWebSocketHandler struct {
	manager *session.Manager
	clients sync.Map // sessionID -> *websocket.Conn
}

func NewBufferWebSocketHandler(manager *session.Manager) *BufferWebSocketHandler {
	return &BufferWebSocketHandler{
		manager: manager,
	}
}

func (h *BufferWebSocketHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WebSocket] Failed to upgrade connection: %v", err)
		return
	}
	defer conn.Close()

	// Set up connection parameters
	conn.SetReadLimit(maxMessageSize)
	conn.SetReadDeadline(time.Now().Add(pongWait))
	conn.SetPongHandler(func(string) error { 
		conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil 
	})

	// Start ping ticker
	ticker := time.NewTicker(pingPeriod)
	defer ticker.Stop()

	// Channel for writing messages
	send := make(chan []byte, 256)
	done := make(chan struct{})

	// Start writer goroutine
	go h.writer(conn, send, ticker, done)

	// Handle incoming messages
	for {
		select {
		case <-done:
			return
		default:
			messageType, message, err := conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("[WebSocket] Error: %v", err)
				}
				close(done)
				return
			}

			if messageType == websocket.TextMessage {
				h.handleTextMessage(conn, message, send, done)
			}
		}
	}
}

func (h *BufferWebSocketHandler) handleTextMessage(conn *websocket.Conn, message []byte, send chan []byte, done chan struct{}) {
	var msg map[string]interface{}
	if err := json.Unmarshal(message, &msg); err != nil {
		log.Printf("[WebSocket] Failed to parse message: %v", err)
		return
	}

	msgType, ok := msg["type"].(string)
	if !ok {
		return
	}

	switch msgType {
	case "ping":
		// Send pong response
		pong, _ := json.Marshal(map[string]string{"type": "pong"})
		select {
		case send <- pong:
		case <-done:
			return
		}

	case "subscribe":
		sessionID, ok := msg["sessionId"].(string)
		if !ok {
			return
		}
		
		// Start streaming session data
		go h.streamSession(sessionID, send, done)

	case "unsubscribe":
		// Currently we just close the connection when unsubscribing
		close(done)
	}
}

func (h *BufferWebSocketHandler) streamSession(sessionID string, send chan []byte, done chan struct{}) {
	sess, err := h.manager.GetSession(sessionID)
	if err != nil {
		log.Printf("[WebSocket] Session not found: %v", err)
		errorMsg, _ := json.Marshal(map[string]string{
			"type":    "error",
			"message": fmt.Sprintf("Session not found: %v", err),
		})
		select {
		case send <- errorMsg:
		case <-done:
		}
		return
	}

	streamPath := sess.StreamOutPath()

	// Create file watcher
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		log.Printf("[WebSocket] Failed to create watcher: %v", err)
		return
	}
	defer watcher.Close()

	// Add the stream file to the watcher
	err = watcher.Add(streamPath)
	if err != nil {
		log.Printf("[WebSocket] Failed to watch file: %v", err)
		return
	}

	headerSent := false
	seenBytes := int64(0)

	// Send initial content
	h.processAndSendContent(sessionID, streamPath, &headerSent, &seenBytes, send, done)

	// Watch for changes
	for {
		select {
		case <-done:
			return
			
		case event, ok := <-watcher.Events:
			if !ok {
				return
			}

			if event.Op&fsnotify.Write == fsnotify.Write {
				h.processAndSendContent(sessionID, streamPath, &headerSent, &seenBytes, send, done)
			}

		case err, ok := <-watcher.Errors:
			if !ok {
				return
			}
			log.Printf("[WebSocket] Watcher error: %v", err)

		case <-time.After(1 * time.Second):
			// Check if session is still alive
			if !sess.IsAlive() {
				// Send exit event
				exitMsg := h.createBinaryMessage(sessionID, []byte(`{"type":"exit","code":0}`))
				select {
				case send <- exitMsg:
				case <-done:
				}
				return
			}
		}
	}
}

func (h *BufferWebSocketHandler) processAndSendContent(sessionID, streamPath string, headerSent *bool, seenBytes *int64, send chan []byte, done chan struct{}) {
	file, err := os.Open(streamPath)
	if err != nil {
		log.Printf("[WebSocket] Failed to open stream file: %v", err)
		return
	}
	defer file.Close()

	// Get current file size
	fileInfo, err := file.Stat()
	if err != nil {
		return
	}

	currentSize := fileInfo.Size()
	if currentSize <= *seenBytes {
		return
	}

	// Seek to last position
	if _, err := file.Seek(*seenBytes, 0); err != nil {
		return
	}

	// Read new content
	newContentSize := currentSize - *seenBytes
	newContent := make([]byte, newContentSize)

	bytesRead, err := file.Read(newContent)
	if err != nil {
		return
	}

	*seenBytes = currentSize

	// Process content line by line
	content := string(newContent[:bytesRead])
	lines := strings.Split(content, "\n")

	// Handle incomplete last line
	endIndex := len(lines)
	if !strings.HasSuffix(content, "\n") && len(lines) > 0 {
		incompleteLineBytes := int64(len(lines[len(lines)-1]))
		*seenBytes -= incompleteLineBytes
		endIndex = len(lines) - 1
	}

	// Process complete lines
	for i := 0; i < endIndex; i++ {
		line := lines[i]
		if line == "" {
			continue
		}

		// Try to parse as header first
		if !*headerSent {
			var header protocol.AsciinemaHeader
			if err := json.Unmarshal([]byte(line), &header); err == nil && header.Version > 0 {
				*headerSent = true
				// Send header as binary message
				headerData, _ := json.Marshal(map[string]interface{}{
					"type": "header",
					"width": header.Width,
					"height": header.Height,
				})
				msg := h.createBinaryMessage(sessionID, headerData)
				select {
				case send <- msg:
				case <-done:
					return
				}
				continue
			}
		}

		// Try to parse as event array [timestamp, type, data]
		var eventArray []interface{}
		if err := json.Unmarshal([]byte(line), &eventArray); err == nil && len(eventArray) == 3 {
			timestamp, ok1 := eventArray[0].(float64)
			eventType, ok2 := eventArray[1].(string)
			data, ok3 := eventArray[2].(string)

			if ok1 && ok2 && ok3 && eventType == "o" {
				// Create terminal output message
				outputData, _ := json.Marshal(map[string]interface{}{
					"type": "output",
					"timestamp": timestamp,
					"data": data,
				})
				
				msg := h.createBinaryMessage(sessionID, outputData)
				select {
				case send <- msg:
				case <-done:
					return
				}
			} else if ok1 && ok2 && ok3 && eventType == "r" {
				// Create resize message
				resizeData, _ := json.Marshal(map[string]interface{}{
					"type": "resize",
					"timestamp": timestamp,
					"dimensions": data,
				})
				
				msg := h.createBinaryMessage(sessionID, resizeData)
				select {
				case send <- msg:
				case <-done:
					return
				}
			}
		}
	}
}

func (h *BufferWebSocketHandler) createBinaryMessage(sessionID string, data []byte) []byte {
	// Binary message format:
	// [magic byte (1)] [session ID length (4, little endian)] [session ID] [data]
	
	sessionIDBytes := []byte(sessionID)
	totalLen := 1 + 4 + len(sessionIDBytes) + len(data)
	
	msg := make([]byte, totalLen)
	offset := 0
	
	// Magic byte
	msg[offset] = BufferMagicByte
	offset++
	
	// Session ID length (little endian)
	binary.LittleEndian.PutUint32(msg[offset:], uint32(len(sessionIDBytes)))
	offset += 4
	
	// Session ID
	copy(msg[offset:], sessionIDBytes)
	offset += len(sessionIDBytes)
	
	// Data
	copy(msg[offset:], data)
	
	return msg
}

func (h *BufferWebSocketHandler) writer(conn *websocket.Conn, send chan []byte, ticker *time.Ticker, done chan struct{}) {
	defer close(send)
	
	for {
		select {
		case message, ok := <-send:
			conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			// Check if it's a text message (JSON) or binary
			if len(message) > 0 && message[0] == '{' {
				// Text message
				if err := conn.WriteMessage(websocket.TextMessage, message); err != nil {
					return
				}
			} else {
				// Binary message
				if err := conn.WriteMessage(websocket.BinaryMessage, message); err != nil {
					return
				}
			}

		case <-ticker.C:
			conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
			
		case <-done:
			return
		}
	}
}