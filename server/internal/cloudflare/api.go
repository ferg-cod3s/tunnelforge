package cloudflare

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

// APIClient handles Cloudflare API interactions
type APIClient struct {
	apiToken   string
	accountID  string
	httpClient *http.Client
	baseURL    string
}

// NewAPIClient creates a new Cloudflare API client
func NewAPIClient(apiToken, accountID string) *APIClient {
	return &APIClient{
		apiToken:  apiToken,
		accountID: accountID,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		baseURL: "https://api.cloudflare.com/client/v4",
	}
}

// Tunnel represents a Cloudflare tunnel
type Tunnel struct {
	ID           string            `json:"id"`
	Name         string            `json:"name"`
	CreatedAt    time.Time         `json:"created_at"`
	DeletedAt    *time.Time        `json:"deleted_at,omitempty"`
	Connections  []TunnelConnection `json:"connections"`
	Config       TunnelConfig      `json:"config"`
	Status       string            `json:"status"`
}

// TunnelConnection represents a tunnel connection
type TunnelConnection struct {
	ID          string     `json:"id"`
	ColoName    string     `json:"colo_name"`
	IsPendingReconnect bool `json:"is_pending_reconnect"`
}

// TunnelConfig represents tunnel configuration
type TunnelConfig struct {
	OriginRequest TunnelOriginRequest `json:"originRequest"`
}

// TunnelOriginRequest represents origin request configuration
type TunnelOriginRequest struct {
	ConnectTimeout string `json:"connectTimeout"`
	NoTLSVerify    bool   `json:"noTLSVerify"`
}

// CreateTunnelRequest represents a request to create a tunnel
type CreateTunnelRequest struct {
	Name string `json:"name"`
	Config TunnelConfig `json:"config"`
}

// CreateTunnelResponse represents the response from creating a tunnel
type CreateTunnelResponse struct {
	Success bool   `json:"success"`
	Errors  []APIError `json:"errors"`
	Messages []string `json:"messages"`
	Result   Tunnel `json:"result"`
}

// APIError represents a Cloudflare API error
type APIError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// ListTunnelsResponse represents the response from listing tunnels
type ListTunnelsResponse struct {
	Success bool     `json:"success"`
	Errors  []APIError `json:"errors"`
	Messages []string `json:"messages"`
	Result   []Tunnel `json:"result"`
}

// DeleteTunnelResponse represents the response from deleting a tunnel
type DeleteTunnelResponse struct {
	Success bool     `json:"success"`
	Errors  []APIError `json:"errors"`
	Messages []string `json:"messages"`
	Result   interface{} `json:"result"`
}

// CreateTunnel creates a new Cloudflare tunnel
func (c *APIClient) CreateTunnel(req CreateTunnelRequest) (*Tunnel, error) {
	url := fmt.Sprintf("%s/accounts/%s/cfd_tunnel", c.baseURL, c.accountID)
	
	jsonData, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.apiToken))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var createResp CreateTunnelResponse
	if err := json.Unmarshal(body, &createResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if !createResp.Success {
		if len(createResp.Errors) > 0 {
			return nil, fmt.Errorf("API error: %s", createResp.Errors[0].Message)
		}
		return nil, fmt.Errorf("API request failed")
	}

	return &createResp.Result, nil
}

// ListTunnels lists all tunnels for the account
func (c *APIClient) ListTunnels() ([]Tunnel, error) {
	url := fmt.Sprintf("%s/accounts/%s/cfd_tunnel", c.baseURL, c.accountID)
	
	httpReq, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.apiToken))

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var listResp ListTunnelsResponse
	if err := json.Unmarshal(body, &listResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if !listResp.Success {
		if len(listResp.Errors) > 0 {
			return nil, fmt.Errorf("API error: %s", listResp.Errors[0].Message)
		}
		return nil, fmt.Errorf("API request failed")
	}

	return listResp.Result, nil
}

// DeleteTunnel deletes a tunnel
func (c *APIClient) DeleteTunnel(tunnelID string) error {
	url := fmt.Sprintf("%s/accounts/%s/cfd_tunnel/%s", c.baseURL, c.accountID, tunnelID)
	
	httpReq, err := http.NewRequest("DELETE", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.apiToken))

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var deleteResp DeleteTunnelResponse
	if err := json.Unmarshal(body, &deleteResp); err != nil {
		return fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if !deleteResp.Success {
		if len(deleteResp.Errors) > 0 {
			return fmt.Errorf("API error: %s", deleteResp.Errors[0].Message)
		}
		return fmt.Errorf("API request failed")
	}

	return nil
}

// GetTunnel gets a specific tunnel
func (c *APIClient) GetTunnel(tunnelID string) (*Tunnel, error) {
	url := fmt.Sprintf("%s/accounts/%s/cfd_tunnel/%s", c.baseURL, c.accountID, tunnelID)
	
	httpReq, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.apiToken))

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var tunnelResp struct {
		Success bool   `json:"success"`
		Errors  []APIError `json:"errors"`
		Messages []string `json:"messages"`
		Result   Tunnel `json:"result"`
	}
	
	if err := json.Unmarshal(body, &tunnelResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if !tunnelResp.Success {
		if len(tunnelResp.Errors) > 0 {
			return nil, fmt.Errorf("API error: %s", tunnelResp.Errors[0].Message)
		}
		return nil, fmt.Errorf("API request failed")
	}

	return &tunnelResp.Result, nil
}

// DNSRecord represents a DNS record
type DNSRecord struct {
	ID      string `json:"id"`
	Type    string `json:"type"`
	Name    string `json:"name"`
	Content string `json:"content"`
	TTL     int    `json:"ttl"`
	Proxied bool   `json:"proxied"`
}

// CreateDNSRecordRequest represents a request to create a DNS record
type CreateDNSRecordRequest struct {
	Type    string `json:"type"`
	Name    string `json:"name"`
	Content string `json:"content"`
	TTL     int    `json:"ttl"`
	Proxied bool   `json:"proxied"`
}

// CreateDNSRecordResponse represents the response from creating a DNS record
type CreateDNSRecordResponse struct {
	Success bool     `json:"success"`
	Errors  []APIError `json:"errors"`
	Messages []string `json:"messages"`
	Result   DNSRecord `json:"result"`
}

// ListDNSRecordsResponse represents the response from listing DNS records
type ListDNSRecordsResponse struct {
	Success bool       `json:"success"`
	Errors  []APIError `json:"errors"`
	Messages []string `json:"messages"`
	Result   []DNSRecord `json:"result"`
}

// DeleteDNSRecordResponse represents the response from deleting a DNS record
type DeleteDNSRecordResponse struct {
	Success bool     `json:"success"`
	Errors  []APIError `json:"errors"`
	Messages []string `json:"messages"`
	Result   interface{} `json:"result"`
}

// CreateDNSRecord creates a DNS record
func (c *APIClient) CreateDNSRecord(zoneID string, req CreateDNSRecordRequest) (*DNSRecord, error) {
	url := fmt.Sprintf("%s/zones/%s/dns_records", c.baseURL, zoneID)
	
	jsonData, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.apiToken))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var createResp CreateDNSRecordResponse
	if err := json.Unmarshal(body, &createResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if !createResp.Success {
		if len(createResp.Errors) > 0 {
			return nil, fmt.Errorf("API error: %s", createResp.Errors[0].Message)
		}
		return nil, fmt.Errorf("API request failed")
	}

	return &createResp.Result, nil
}

// ListDNSRecords lists DNS records for a zone
func (c *APIClient) ListDNSRecords(zoneID string) ([]DNSRecord, error) {
	url := fmt.Sprintf("%s/zones/%s/dns_records", c.baseURL, zoneID)
	
	httpReq, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.apiToken))

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var listResp ListDNSRecordsResponse
	if err := json.Unmarshal(body, &listResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if !listResp.Success {
		if len(listResp.Errors) > 0 {
			return nil, fmt.Errorf("API error: %s", listResp.Errors[0].Message)
		}
		return nil, fmt.Errorf("API request failed")
	}

	return listResp.Result, nil
}

// DeleteDNSRecord deletes a DNS record
func (c *APIClient) DeleteDNSRecord(zoneID, recordID string) error {
	url := fmt.Sprintf("%s/zones/%s/dns_records/%s", c.baseURL, zoneID, recordID)
	
	httpReq, err := http.NewRequest("DELETE", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.apiToken))

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var deleteResp DeleteDNSRecordResponse
	if err := json.Unmarshal(body, &deleteResp); err != nil {
		return fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if !deleteResp.Success {
		if len(deleteResp.Errors) > 0 {
			return fmt.Errorf("API error: %s", deleteResp.Errors[0].Message)
		}
		return fmt.Errorf("API request failed")
	}

	return nil
}

// Zone represents a Cloudflare zone
type Zone struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// ListZonesResponse represents the response from listing zones
type ListZonesResponse struct {
	Success bool     `json:"success"`
	Errors  []APIError `json:"errors"`
	Messages []string `json:"messages"`
	Result   []Zone `json:"result"`
}

// ListZones lists all zones for the account
func (c *APIClient) ListZones() ([]Zone, error) {
	url := fmt.Sprintf("%s/zones", c.baseURL)
	
	httpReq, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.apiToken))

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var listResp ListZonesResponse
	if err := json.Unmarshal(body, &listResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if !listResp.Success {
		if len(listResp.Errors) > 0 {
			return nil, fmt.Errorf("API error: %s", listResp.Errors[0].Message)
		}
		return nil, fmt.Errorf("API request failed")
	}

	return listResp.Result, nil
}

// GetZoneByName gets a zone by name
func (c *APIClient) GetZoneByName(name string) (*Zone, error) {
	zones, err := c.ListZones()
	if err != nil {
		return nil, err
	}

	for _, zone := range zones {
		if zone.Name == name {
			return &zone, nil
		}
	}

	return nil, fmt.Errorf("zone not found: %s", name)
}

// ErrorType represents different types of API errors
type ErrorType int

const (
	ErrorTypeNetwork ErrorType = iota
	ErrorTypeAuthentication
	ErrorTypeAuthorization
	ErrorTypeRateLimit
	ErrorTypeServer
	ErrorTypeClient
	ErrorTypeUnknown
)

// APIErrorWithType represents an API error with categorization
type APIErrorWithType struct {
	Type    ErrorType
	Message string
	Retryable bool
}

// categorizeError categorizes an error for better handling
func categorizeError(err error, statusCode int) APIErrorWithType {
	if err == nil {
		return APIErrorWithType{Type: ErrorTypeUnknown, Message: "Unknown error", Retryable: false}
	}
	
	message := err.Error()
	
	// Network errors
	if strings.Contains(message, "connection") || strings.Contains(message, "timeout") {
		return APIErrorWithType{Type: ErrorTypeNetwork, Message: message, Retryable: true}
	}
	
	// HTTP status code based categorization
	switch statusCode {
	case 401:
		return APIErrorWithType{Type: ErrorTypeAuthentication, Message: "Authentication failed", Retryable: false}
	case 403:
		return APIErrorWithType{Type: ErrorTypeAuthorization, Message: "Authorization failed", Retryable: false}
	case 429:
		return APIErrorWithType{Type: ErrorTypeRateLimit, Message: "Rate limit exceeded", Retryable: true}
	case 500, 502, 503, 504:
		return APIErrorWithType{Type: ErrorTypeServer, Message: fmt.Sprintf("Server error: %d", statusCode), Retryable: true}
	case 400, 422:
		return APIErrorWithType{Type: ErrorTypeClient, Message: fmt.Sprintf("Client error: %d", statusCode), Retryable: false}
	}
	
	return APIErrorWithType{Type: ErrorTypeUnknown, Message: message, Retryable: false}
}

// executeWithRetry executes an HTTP request with retry logic
func (c *APIClient) executeWithRetry(req *http.Request, maxRetries int) (*http.Response, error) {
	var lastErr error
	
	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			// Exponential backoff
			backoff := time.Duration(attempt) * time.Second
			log.Printf("Retrying API request (attempt %d/%d) after %v", attempt, maxRetries, backoff)
			time.Sleep(backoff)
		}
		
		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		
		// Check if we should retry based on status code
		if resp.StatusCode >= 500 || resp.StatusCode == 429 {
			resp.Body.Close()
			lastErr = fmt.Errorf("HTTP %d", resp.StatusCode)
			continue
		}
		
		return resp, nil
	}
	
	return nil, fmt.Errorf("request failed after %d attempts: %w", maxRetries, lastErr)
}

// logAPIRequest logs API request details
func (c *APIClient) logAPIRequest(method, url string, statusCode int, duration time.Duration, err error) {
	logLevel := "INFO"
	if err != nil || statusCode >= 400 {
		logLevel = "ERROR"
	}
	
	log.Printf("[%s] Cloudflare API %s %s - Status: %d - Duration: %v - Error: %v", 
		logLevel, method, url, statusCode, duration, err)
}

// CreateTunnel creates a new Cloudflare tunnel with enhanced error handling
func (c *APIClient) CreateTunnel(req CreateTunnelRequest) (*Tunnel, error) {
	url := fmt.Sprintf("%s/accounts/%s/cfd_tunnel", c.baseURL, c.accountID)
	
	jsonData, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.apiToken))
	httpReq.Header.Set("Content-Type", "application/json")

	startTime := time.Now()
	resp, err := c.executeWithRetry(httpReq, 3) // 3 retries
	duration := time.Since(startTime)
	
	if err != nil {
		c.logAPIRequest("POST", url, 0, duration, err)
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.logAPIRequest("POST", url, resp.StatusCode, duration, err)
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		apiErr := categorizeError(fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(body)), resp.StatusCode)
		c.logAPIRequest("POST", url, resp.StatusCode, duration, apiErr)
		return nil, fmt.Errorf("API request failed: %s", apiErr.Message)
	}

	var createResp CreateTunnelResponse
	if err := json.Unmarshal(body, &createResp); err != nil {
		c.logAPIRequest("POST", url, resp.StatusCode, duration, err)
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if !createResp.Success {
		if len(createResp.Errors) > 0 {
			apiErr := categorizeError(fmt.Errorf("API error: %s", createResp.Errors[0].Message), resp.StatusCode)
			c.logAPIRequest("POST", url, resp.StatusCode, duration, apiErr)
			return nil, fmt.Errorf("API error: %s", createResp.Errors[0].Message)
		}
		c.logAPIRequest("POST", url, resp.StatusCode, duration, fmt.Errorf("API request failed"))
		return nil, fmt.Errorf("API request failed")
	}

	c.logAPIRequest("POST", url, resp.StatusCode, duration, nil)
	return &createResp.Result, nil
}

// ListTunnels lists all tunnels for the account with enhanced error handling
func (c *APIClient) ListTunnels() ([]Tunnel, error) {
	url := fmt.Sprintf("%s/accounts/%s/cfd_tunnel", c.baseURL, c.accountID)
	
	httpReq, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.apiToken))

	startTime := time.Now()
	resp, err := c.executeWithRetry(httpReq, 2) // 2 retries for list operations
	duration := time.Since(startTime)
	
	if err != nil {
		c.logAPIRequest("GET", url, 0, duration, err)
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.logAPIRequest("GET", url, resp.StatusCode, duration, err)
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		apiErr := categorizeError(fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(body)), resp.StatusCode)
		c.logAPIRequest("GET", url, resp.StatusCode, duration, apiErr)
		return nil, fmt.Errorf("API request failed: %s", apiErr.Message)
	}

	var listResp ListTunnelsResponse
	if err := json.Unmarshal(body, &listResp); err != nil {
		c.logAPIRequest("GET", url, resp.StatusCode, duration, err)
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if !listResp.Success {
		if len(listResp.Errors) > 0 {
			apiErr := categorizeError(fmt.Errorf("API error: %s", listResp.Errors[0].Message), resp.StatusCode)
			c.logAPIRequest("GET", url, resp.StatusCode, duration, apiErr)
			return nil, fmt.Errorf("API error: %s", listResp.Errors[0].Message)
		}
		c.logAPIRequest("GET", url, resp.StatusCode, duration, fmt.Errorf("API request failed"))
		return nil, fmt.Errorf("API request failed")
	}

	c.logAPIRequest("GET", url, resp.StatusCode, duration, nil)
	return listResp.Result, nil
}

// DeleteTunnel deletes a tunnel with enhanced error handling
func (c *APIClient) DeleteTunnel(tunnelID string) error {
	url := fmt.Sprintf("%s/accounts/%s/cfd_tunnel/%s", c.baseURL, c.accountID, tunnelID)
	
	httpReq, err := http.NewRequest("DELETE", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.apiToken))

	startTime := time.Now()
	resp, err := c.executeWithRetry(httpReq, 2) // 2 retries for delete operations
	duration := time.Since(startTime)
	
	if err != nil {
		c.logAPIRequest("DELETE", url, 0, duration, err)
		return fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.logAPIRequest("DELETE", url, resp.StatusCode, duration, err)
		return fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		apiErr := categorizeError(fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(body)), resp.StatusCode)
		c.logAPIRequest("DELETE", url, resp.StatusCode, duration, apiErr)
		return fmt.Errorf("API request failed: %s", apiErr.Message)
	}

	var deleteResp DeleteTunnelResponse
	if err := json.Unmarshal(body, &deleteResp); err != nil {
		c.logAPIRequest("DELETE", url, resp.StatusCode, duration, err)
		return fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if !deleteResp.Success {
		if len(deleteResp.Errors) > 0 {
			apiErr := categorizeError(fmt.Errorf("API error: %s", deleteResp.Errors[0].Message), resp.StatusCode)
			c.logAPIRequest("DELETE", url, resp.StatusCode, duration, apiErr)
			return fmt.Errorf("API error: %s", deleteResp.Errors[0].Message)
		}
		c.logAPIRequest("DELETE", url, resp.StatusCode, duration, fmt.Errorf("API request failed"))
		return fmt.Errorf("API request failed")
	}

	c.logAPIRequest("DELETE", url, resp.StatusCode, duration, nil)
	return nil
}

// CreateDNSRecord creates a DNS record with enhanced error handling
func (c *APIClient) CreateDNSRecord(zoneID string, req CreateDNSRecordRequest) (*DNSRecord, error) {
	url := fmt.Sprintf("%s/zones/%s/dns_records", c.baseURL, zoneID)
	
	jsonData, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.apiToken))
	httpReq.Header.Set("Content-Type", "application/json")

	startTime := time.Now()
	resp, err := c.executeWithRetry(httpReq, 3) // 3 retries for DNS operations
	duration := time.Since(startTime)
	
	if err != nil {
		c.logAPIRequest("POST", url, 0, duration, err)
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.logAPIRequest("POST", url, resp.StatusCode, duration, err)
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		apiErr := categorizeError(fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(body)), resp.StatusCode)
		c.logAPIRequest("POST", url, resp.StatusCode, duration, apiErr)
		return nil, fmt.Errorf("API request failed: %s", apiErr.Message)
	}

	var createResp CreateDNSRecordResponse
	if err := json.Unmarshal(body, &createResp); err != nil {
		c.logAPIRequest("POST", url, resp.StatusCode, duration, err)
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if !createResp.Success {
		if len(createResp.Errors) > 0 {
			apiErr := categorizeError(fmt.Errorf("API error: %s", createResp.Errors[0].Message), resp.StatusCode)
			c.logAPIRequest("POST", url, resp.StatusCode, duration, apiErr)
			return nil, fmt.Errorf("API error: %s", createResp.Errors[0].Message)
		}
		c.logAPIRequest("POST", url, resp.StatusCode, duration, fmt.Errorf("API request failed"))
		return nil, fmt.Errorf("API request failed")
	}

	c.logAPIRequest("POST", url, resp.StatusCode, duration, nil)
	return &createResp.Result, nil
}

// ListDNSRecords lists DNS records for a zone with enhanced error handling
func (c *APIClient) ListDNSRecords(zoneID string) ([]DNSRecord, error) {
	url := fmt.Sprintf("%s/zones/%s/dns_records", c.baseURL, zoneID)
	
	httpReq, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.apiToken))

	startTime := time.Now()
	resp, err := c.executeWithRetry(httpReq, 2) // 2 retries for list operations
	duration := time.Since(startTime)
	
	if err != nil {
		c.logAPIRequest("GET", url, 0, duration, err)
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.logAPIRequest("GET", url, resp.StatusCode, duration, err)
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		apiErr := categorizeError(fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(body)), resp.StatusCode)
		c.logAPIRequest("GET", url, resp.StatusCode, duration, apiErr)
		return nil, fmt.Errorf("API request failed: %s", apiErr.Message)
	}

	var listResp ListDNSRecordsResponse
	if err := json.Unmarshal(body, &listResp); err != nil {
		c.logAPIRequest("GET", url, resp.StatusCode, duration, err)
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if !listResp.Success {
		if len(listResp.Errors) > 0 {
			apiErr := categorizeError(fmt.Errorf("API error: %s", listResp.Errors[0].Message), resp.StatusCode)
			c.logAPIRequest("GET", url, resp.StatusCode, duration, apiErr)
			return nil, fmt.Errorf("API error: %s", listResp.Errors[0].Message)
		}
		c.logAPIRequest("GET", url, resp.StatusCode, duration, fmt.Errorf("API request failed"))
		return nil, fmt.Errorf("API request failed")
	}

	c.logAPIRequest("GET", url, resp.StatusCode, duration, nil)
	return listResp.Result, nil
}

// DeleteDNSRecord deletes a DNS record with enhanced error handling
func (c *APIClient) DeleteDNSRecord(zoneID, recordID string) error {
	url := fmt.Sprintf("%s/zones/%s/dns_records/%s", c.baseURL, zoneID, recordID)
	
	httpReq, err := http.NewRequest("DELETE", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.apiToken))

	startTime := time.Now()
	resp, err := c.executeWithRetry(httpReq, 2) // 2 retries for delete operations
	duration := time.Since(startTime)
	
	if err != nil {
		c.logAPIRequest("DELETE", url, 0, duration, err)
		return fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.logAPIRequest("DELETE", url, resp.StatusCode, duration, err)
		return fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		apiErr := categorizeError(fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(body)), resp.StatusCode)
		c.logAPIRequest("DELETE", url, resp.StatusCode, duration, apiErr)
		return fmt.Errorf("API request failed: %s", apiErr.Message)
	}

	var deleteResp DeleteDNSRecordResponse
	if err := json.Unmarshal(body, &deleteResp); err != nil {
		c.logAPIRequest("DELETE", url, resp.StatusCode, duration, err)
		return fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if !deleteResp.Success {
		if len(deleteResp.Errors) > 0 {
			apiErr := categorizeError(fmt.Errorf("API error: %s", deleteResp.Errors[0].Message), resp.StatusCode)
			c.logAPIRequest("DELETE", url, resp.StatusCode, duration, apiErr)
			return fmt.Errorf("API error: %s", deleteResp.Errors[0].Message)
		}
		c.logAPIRequest("DELETE", url, resp.StatusCode, duration, fmt.Errorf("API request failed"))
		return fmt.Errorf("API request failed")
	}

	c.logAPIRequest("DELETE", url, resp.StatusCode, duration, nil)
	return nil
}
