package types

import (
	"encoding/json"
	"testing"
)

func TestSessionCreateRequestUnmarshalJSON(t *testing.T) {
	tests := []struct {
		name        string
		jsonInput   string
		expected    string
		expectError bool
	}{
		{
			name:      "String command format",
			jsonInput: `{"command": "echo test", "cwd": "/home", "title": "Test", "cols": 80, "rows": 24}`,
			expected:  "echo test",
		},
		{
			name:      "Array command format",
			jsonInput: `{"command": ["echo", "test"], "cwd": "/home", "title": "Test", "cols": 80, "rows": 24}`,
			expected:  "echo test",
		},
		{
			name:      "Array command with spaces",
			jsonInput: `{"command": ["bash", "-c", "echo 'hello world'"], "cwd": "/home"}`,
			expected:  "bash -c echo 'hello world'",
		},
		{
			name:      "Single element array",
			jsonInput: `{"command": ["ls"]}`,
			expected:  "ls",
		},
		{
			name:      "Empty string command",
			jsonInput: `{"command": "", "cwd": "/home"}`,
			expected:  "",
		},
		{
			name:      "Missing command field",
			jsonInput: `{"cwd": "/home", "title": "Test"}`,
			expected:  "",
		},
		{
			name:      "Complex command with arguments",
			jsonInput: `{"command": ["git", "commit", "-m", "test message"]}`,
			expected:  "git commit -m test message",
		},
		{
			name:      "Command with path",
			jsonInput: `{"command": ["/usr/bin/python3", "-m", "http.server"]}`,
			expected:  "/usr/bin/python3 -m http.server",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var req SessionCreateRequest
			err := json.Unmarshal([]byte(tt.jsonInput), &req)

			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error but got none")
				}
				return
			}

			if err != nil {
				t.Errorf("Unexpected error: %v", err)
				return
			}

			if req.Command != tt.expected {
				t.Errorf("Command mismatch:\nExpected: %q\nGot:      %q", tt.expected, req.Command)
			}
		})
	}
}

func TestSessionCreateRequestUnmarshalJSON_OtherFields(t *testing.T) {
	jsonInput := `{
		"command": ["bash", "-c", "echo test"],
		"cwd": "/home/user/project",
		"title": "My Session",
		"cols": 120,
		"rows": 30
	}`

	var req SessionCreateRequest
	err := json.Unmarshal([]byte(jsonInput), &req)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if req.Command != "bash -c echo test" {
		t.Errorf("Command = %q, want %q", req.Command, "bash -c echo test")
	}
	if req.Cwd != "/home/user/project" {
		t.Errorf("Cwd = %q, want %q", req.Cwd, "/home/user/project")
	}
	if req.Title != "My Session" {
		t.Errorf("Title = %q, want %q", req.Title, "My Session")
	}
	if req.Cols != 120 {
		t.Errorf("Cols = %d, want %d", req.Cols, 120)
	}
	if req.Rows != 30 {
		t.Errorf("Rows = %d, want %d", req.Rows, 30)
	}
}

func TestSessionCreateRequestUnmarshalJSON_InvalidJSON(t *testing.T) {
	tests := []struct {
		name      string
		jsonInput string
	}{
		{
			name:      "Invalid JSON syntax",
			jsonInput: `{"command": ["echo", "test"`,
		},
		{
			name:      "Invalid command type",
			jsonInput: `{"command": 123}`,
		},
		{
			name:      "Invalid command type object",
			jsonInput: `{"command": {"test": "value"}}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var req SessionCreateRequest
			err := json.Unmarshal([]byte(tt.jsonInput), &req)
			if err == nil {
				t.Errorf("Expected error for invalid JSON but got none")
			}
		})
	}
}
