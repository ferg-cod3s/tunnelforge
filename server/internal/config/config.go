package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds server configuration
type Config struct {
	Port               string
	Host               string
	AllowedOrigins     []string
	MaxSessions        int
	SessionTimeout     int // in minutes
	EnableAuth         bool
	AuthRequired       bool   // Whether auth is required for API access
	AllowLocalBypass   bool   // Whether to allow local bypass auth (X-TunnelForge-Local header)
	ServerName         string // Server name for display
	StaticDir          string
	FileSystemBasePath string // Base path for filesystem operations
	GitBasePath        string // Base path for git operations
	VAPIDKeyPath       string // Path to store VAPID keys for push notifications

	// Session persistence configuration
	EnablePersistence    bool   // Whether to enable session persistence
	PersistenceDir       string // Directory to store persisted sessions
	PersistenceInterval  time.Duration // Auto-save interval

	// Security middleware configuration
	EnableRateLimit   bool
	RateLimitPerMin   int // Requests per minute per IP
	EnableCSRF        bool
	CSRFSecret        string
	EnableIPWhitelist bool
	AllowedIPs        []string // CIDR notation allowed
	EnableRequestLog  bool

	// Cloudflare tunnel configuration
	EnableCloudflareTunnels bool   // Whether to enable Cloudflare tunnel support
	CloudflareAPIToken      string // Cloudflare API token for tunnel management
	CloudflareAccountID     string // Cloudflare account ID
	CloudflareConfigDir     string // Directory to store tunnel configurations
}

// LoadConfig loads configuration from environment variables with defaults
func LoadConfig() *Config {
	cfg := &Config{
		Port:               getEnv("PORT", "4021"),
		Host:               getEnv("HOST", "localhost"),
		AllowedOrigins:     []string{"*"}, // For development - should be restricted in production
		MaxSessions:        getEnvInt("MAX_SESSIONS", 50),
		SessionTimeout:     getEnvInt("SESSION_TIMEOUT", 1440), // 24 hours
		EnableAuth:         getEnvBool("ENABLE_AUTH", false),
		AuthRequired:       getEnvBool("AUTH_REQUIRED", false),       // Whether auth is required for API access
		AllowLocalBypass:   getEnvBool("ALLOW_LOCAL_BYPASS", true),   // Whether to allow local bypass auth (X-TunnelForge-Local header)
		ServerName:         getEnv("SERVER_NAME", "TunnelForge Go Server"),
		StaticDir:          getEnv("STATIC_DIR", "../web/public"),                           // Relative to web frontend
		FileSystemBasePath: getEnv("FILESYSTEM_BASE_PATH", os.Getenv("HOME")),               // Default to user's home directory
		GitBasePath:        getEnv("GIT_BASE_PATH", os.Getenv("HOME")),                      // Default to user's home directory
		VAPIDKeyPath:       getEnv("VAPID_KEY_PATH", os.Getenv("HOME")+"/.tunnelforge/keys"), // Default to user's config directory

		// Session persistence defaults
		EnablePersistence:   getEnvBool("ENABLE_PERSISTENCE", true),                                    // Enable by default
		PersistenceDir:      getEnv("PERSISTENCE_DIR", os.Getenv("HOME")+"/.tunnelforge/sessions"),     // Default to user's config directory
		PersistenceInterval: getEnvDuration("PERSISTENCE_INTERVAL", 30*time.Second),                   // Auto-save every 30 seconds

		// Security middleware defaults
		EnableRateLimit:   getEnvBool("ENABLE_RATE_LIMIT", true),
		RateLimitPerMin:   getEnvInt("RATE_LIMIT_PER_MIN", 100),
		EnableCSRF:        getEnvBool("ENABLE_CSRF", false), // Disabled by default for development
		CSRFSecret:        getEnv("CSRF_SECRET", "tunnelforge-csrf-secret-change-in-production"),
		EnableIPWhitelist: getEnvBool("ENABLE_IP_WHITELIST", false),                             // Disabled by default
		AllowedIPs:        getEnvStringSlice("ALLOWED_IPS", []string{"127.0.0.1/8", "::1/128"}), // Localhost by default
		EnableRequestLog:  getEnvBool("ENABLE_REQUEST_LOG", true),

		// Cloudflare tunnel defaults
		EnableCloudflareTunnels: getEnvBool("ENABLE_CLOUDFLARE_TUNNELS", false),                                    // Disabled by default
		CloudflareAPIToken:      getEnv("CLOUDFLARE_API_TOKEN", ""),                                               // Must be set to enable
		CloudflareAccountID:     getEnv("CLOUDFLARE_ACCOUNT_ID", ""),                                              // Must be set to enable
		CloudflareConfigDir:     getEnv("CLOUDFLARE_CONFIG_DIR", os.Getenv("HOME")+"/.tunnelforge/cloudflare"),     // Default config directory
	}

	return cfg
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}

func getEnvStringSlice(key string, defaultValue []string) []string {
	if value := os.Getenv(key); value != "" {
		return strings.Split(value, ",")
	}
	return defaultValue
}

func getEnvDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}
