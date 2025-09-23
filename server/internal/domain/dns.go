package domain

import (
	"fmt"
	"log"
	"net"
	"time"

	"github.com/ferg-cod3s/tunnelforge/go-server/internal/cloudflare"
)

// DNSManager handles DNS-related operations
type DNSManager struct {
	cloudflareAPI *cloudflare.APIClient
}

// NewDNSManager creates a new DNS manager
func NewDNSManager(apiClient *cloudflare.APIClient) *DNSManager {
	return &DNSManager{
		cloudflareAPI: apiClient,
	}
}

// DNSCheckResult represents the result of a DNS check
type DNSCheckResult struct {
	Domain     string    `json:"domain"`
	RecordType string    `json:"record_type"`
	Expected   string    `json:"expected"`
	Actual     string    `json:"actual"`
	Status     string    `json:"status"` // "ok", "missing", "mismatch", "error"
	Error      string    `json:"error,omitempty"`
	CheckedAt  time.Time `json:"checked_at"`
}

// CheckDNSRecord checks if a DNS record exists and matches expected value
func (dm *DNSManager) CheckDNSRecord(domain, recordType, expectedValue string) (*DNSCheckResult, error) {
	log.Printf("Checking DNS record for %s (%s)", domain, recordType)
	
	result := &DNSCheckResult{
		Domain:     domain,
		RecordType: recordType,
		Expected:   expectedValue,
		CheckedAt:  time.Now(),
	}
	
	// Perform DNS lookup
	records, err := net.LookupCNAME(domain)
	if err != nil {
		result.Status = "error"
		result.Error = err.Error()
		log.Printf("DNS lookup failed for %s: %v", domain, err)
		return result, nil
	}
	
	// Check if the record matches expected value
	actualValue := records
	if len(actualValue) > 0 && actualValue[len(actualValue)-1] == '.' {
		actualValue = actualValue[:len(actualValue)-1] // Remove trailing dot
	}
	
	if actualValue == expectedValue {
		result.Status = "ok"
		result.Actual = actualValue
	} else {
		result.Status = "mismatch"
		result.Actual = actualValue
	}
	
	log.Printf("DNS check result for %s: %s (expected: %s, actual: %s)", domain, result.Status, expectedValue, actualValue)
	return result, nil
}

// WaitForDNSPropagation waits for DNS changes to propagate
func (dm *DNSManager) WaitForDNSPropagation(domain, recordType, expectedValue string, timeout time.Duration) (*DNSCheckResult, error) {
	log.Printf("Waiting for DNS propagation for %s (timeout: %v)", domain, timeout)
	
	startTime := time.Now()
	checkInterval := 10 * time.Second
	
	for time.Since(startTime) < timeout {
		result, err := dm.CheckDNSRecord(domain, recordType, expectedValue)
		if err != nil {
			return nil, fmt.Errorf("DNS check failed: %w", err)
		}
		
		if result.Status == "ok" {
			log.Printf("DNS propagation completed for %s", domain)
			return result, nil
		}
		
		log.Printf("DNS not yet propagated for %s, waiting %v before next check", domain, checkInterval)
		time.Sleep(checkInterval)
	}
	
	// Final check after timeout
	result, err := dm.CheckDNSRecord(domain, recordType, expectedValue)
	if err != nil {
		return nil, fmt.Errorf("final DNS check failed: %w", err)
	}
	
	if result.Status != "ok" {
		result.Status = "timeout"
		result.Error = fmt.Sprintf("DNS propagation timeout after %v", timeout)
	}
	
	return result, nil
}

// ValidateDomainDNS validates that a domain has proper DNS configuration
func (dm *DNSManager) ValidateDomainDNS(domain string) ([]DNSCheckResult, error) {
	log.Printf("Validating DNS configuration for %s", domain)
	
	var results []DNSCheckResult
	
	// Check if domain resolves (basic connectivity test)
	_, err := net.LookupIP(domain)
	if err != nil {
		result := DNSCheckResult{
			Domain:    domain,
			Status:    "error",
			Error:     fmt.Sprintf("Domain does not resolve: %v", err),
			CheckedAt: time.Now(),
		}
		results = append(results, result)
		return results, nil
	}
	
	// Additional DNS validation checks can be added here
	// For example, checking MX records, SPF, DKIM, etc.
	
	log.Printf("DNS validation completed for %s", domain)
	return results, nil
}

// GetDNSRecordInfo gets information about DNS records for a domain
func (dm *DNSManager) GetDNSRecordInfo(domain string) (map[string]interface{}, error) {
	log.Printf("Getting DNS record info for %s", domain)
	
	info := make(map[string]interface{})
	
	// Get A records
	if ips, err := net.LookupIP(domain); err == nil {
		info["a_records"] = ips
	} else {
		info["a_records"] = []string{}
		info["a_records_error"] = err.Error()
	}
	
	// Get CNAME record
	if cname, err := net.LookupCNAME(domain); err == nil {
		info["cname"] = cname
	} else {
		info["cname"] = ""
		info["cname_error"] = err.Error()
	}
	
	// Get MX records
	if mxRecords, err := net.LookupMX(domain); err == nil {
		var mxList []string
		for _, mx := range mxRecords {
			mxList = append(mxList, mx.Host)
		}
		info["mx_records"] = mxList
	} else {
		info["mx_records"] = []string{}
		info["mx_records_error"] = err.Error()
	}
	
	// Get TXT records
	if txtRecords, err := net.LookupTXT(domain); err == nil {
		info["txt_records"] = txtRecords
	} else {
		info["txt_records"] = []string{}
		info["txt_records_error"] = err.Error()
	}
	
	log.Printf("DNS record info retrieved for %s", domain)
	return info, nil
}
