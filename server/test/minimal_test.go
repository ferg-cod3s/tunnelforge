package test

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/ferg-cod3s/tunnelforge/go-server/internal/server"
	"github.com/stretchr/testify/require"
)

func TestMinimalHealth(t *testing.T) {
	tmpDir := t.TempDir()
	os.Setenv("PERSISTENCE_DIR", tmpDir)
	os.Setenv("ENABLE_RATE_LIMIT", "false")
	defer os.Unsetenv("PERSISTENCE_DIR")
	defer os.Unsetenv("ENABLE_RATE_LIMIT")

	t.Log("Creating server...")
	cfg := &server.Config{Port: "0"}
	testServer, err := server.New(cfg)
	require.NoError(t, err)
	t.Log("Server created")

	t.Log("Testing direct handler call (bypassing HTTP stack)...")
	w := httptest.NewRecorder()
	r := httptest.NewRequest("GET", "/health", nil)

	t.Log("Calling ServeHTTP...")
	testServer.Handler().ServeHTTP(w, r)
	t.Log("ServeHTTP returned")

	t.Log("Got response:", w.Code)
	require.Equal(t, http.StatusOK, w.Code)
}

func TestMinimalHealthViaHTTP(t *testing.T) {
	tmpDir := t.TempDir()
	os.Setenv("PERSISTENCE_DIR", tmpDir)
	os.Setenv("ENABLE_RATE_LIMIT", "false")
	defer os.Unsetenv("PERSISTENCE_DIR")
	defer os.Unsetenv("ENABLE_RATE_LIMIT")

	t.Log("Creating server...")
	cfg := &server.Config{Port: "0"}
	testServer, err := server.New(cfg)
	require.NoError(t, err)
	t.Log("Server created")

	t.Log("Creating HTTP test server...")
	httpServer := httptest.NewServer(testServer.Handler())
	defer httpServer.Close()
	t.Log("HTTP server started at:", httpServer.URL)

	t.Log("Making health request...")
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(httpServer.URL + "/health")
	require.NoError(t, err)
	defer resp.Body.Close()

	t.Log("Got response:", resp.StatusCode)
	require.Equal(t, http.StatusOK, resp.StatusCode)
}
