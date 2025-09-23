package domain

import (
	"fmt"
	"log"
	"regexp"
	"strings"
	"time"

	"github.com/ferg-cod3s/tunnelforge/go-server/internal/cloudflare"
)

// DomainManager manages custom domain operations
type DomainManager struct {
	cloudflareAPI *cloudflare.APIClient
}

// NewDomainManager creates a new domain manager
func NewDomainManager(apiClient *cloudflare.APIClient) *DomainManager {
	return &DomainManager{
		cloudflareAPI: apiClient,
	}
}

// DomainAssignment represents a domain assignment to a tunnel
type DomainAssignment struct {
	ID          string    `json:"id"`
	Domain      string    `json:"domain"`
	TunnelID    string    `json:"tunnel_id"`
	TunnelName  string    `json:"tunnel_name"`
	ZoneID      string    `json:"zone_id"`
	ZoneName    string    `json:"zone_name"`
	RecordID    string    `json:"record_id"`
	CreatedAt   time.Time `json:"created_at"`
	Status      string    `json:"status"`
}

// AssignDomainRequest represents a request to assign a domain to a tunnel
type AssignDomainRequest struct {
	Domain   string `json:"domain"`
	TunnelID string `json:"tunnel_id"`
}

// AssignDomain assigns a custom domain to a Cloudflare tunnel
func (dm *DomainManager) AssignDomain(req AssignDomainRequest) (*DomainAssignment, error) {
	log.Printf("Assigning domain %s to tunnel %s", req.Domain, req.TunnelID)
	
	// Validate domain
	if err := dm.ValidateDomain(req.Domain); err != nil {
		return nil, fmt.Errorf("invalid domain: %w", err)
	}
	
	// Get zone for the domain
	zone, err := dm.getZoneForDomain(req.Domain)
	if err != nil {
		return nil, fmt.Errorf("failed to get zone for domain: %w", err)
	}
	
	// Get tunnel info
	tunnel, err := dm.cloudflareAPI.GetTunnel(req.TunnelID)
	if err != nil {
		return nil, fmt.Errorf("failed to get tunnel: %w", err)
	}
	
	// Create DNS record
	record, err := dm.createDNSRecord(zone.ID, req.Domain, tunnel.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to create DNS record: %w", err)
	}
	
	// Create domain assignment
	assignment := &DomainAssignment{
		ID:         fmt.Sprintf("%s-%s", req.Domain, req.TunnelID),
		Domain:     req.Domain,
		TunnelID:   req.TunnelID,
		TunnelName: tunnel.Name,
		ZoneID:     zone.ID,
		ZoneName:   zone.Name,
		RecordID:   record.ID,
		CreatedAt:  time.Now(),
		Status:     "pending",
	}
	
	log.Printf("Successfully assigned domain %s to tunnel %s", req.Domain, req.TunnelID)
	return assignment, nil
}

// ListDomainAssignments lists all domain assignments
func (dm *DomainManager) ListDomainAssignments() ([]DomainAssignment, error) {
	log.Printf("Listing domain assignments")
	
	// For now, return empty list - in a real implementation, this would be stored in a database
	// This is a placeholder until we implement persistent storage
	return []DomainAssignment{}, nil
}

// GetDomainAssignment gets a specific domain assignment
func (dm *DomainManager) GetDomainAssignment(domain string) (*DomainAssignment, error) {
	assignments, err := dm.ListDomainAssignments()
	if err != nil {
		return nil, err
	}
	
	for _, assignment := range assignments {
		if assignment.Domain == domain {
			return &assignment, nil
		}
	}
	
	return nil, fmt.Errorf("domain assignment not found: %s", domain)
}

// RemoveDomainAssignment removes a domain assignment
func (dm *DomainManager) RemoveDomainAssignment(domain string) error {
	log.Printf("Removing domain assignment: %s", domain)
	
	assignment, err := dm.GetDomainAssignment(domain)
	if err != nil {
		return fmt.Errorf("failed to get domain assignment: %w", err)
	}
	
	// Delete DNS record
	err = dm.cloudflareAPI.DeleteDNSRecord(assignment.ZoneID, assignment.RecordID)
	if err != nil {
		log.Printf("Failed to delete DNS record: %v", err)
		// Continue with cleanup even if DNS deletion fails
	}
	
	log.Printf("Successfully removed domain assignment: %s", domain)
	return nil
}

// ValidateDomain validates a domain name
func (dm *DomainManager) ValidateDomain(domain string) error {
	if domain == "" {
		return fmt.Errorf("domain cannot be empty")
	}
	
	// Remove protocol if present
	if strings.HasPrefix(domain, "http://") || strings.HasPrefix(domain, "https://") {
		return fmt.Errorf("domain should not include protocol")
	}
	
	// Basic domain validation regex
	domainRegex := regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$`)
	if !domainRegex.MatchString(domain) {
		return fmt.Errorf("invalid domain format")
	}
	
	// Check for valid TLD
	parts := strings.Split(domain, ".")
	if len(parts) < 2 {
		return fmt.Errorf("domain must have at least one subdomain and a TLD")
	}
	
	tld := parts[len(parts)-1]
	if len(tld) < 2 {
		return fmt.Errorf("TLD must be at least 2 characters")
	}
	
	return nil
}

// getZoneForDomain gets the Cloudflare zone for a domain
func (dm *DomainManager) getZoneForDomain(domain string) (*cloudflare.Zone, error) {
	// Extract the root domain (e.g., example.com from sub.example.com)
	parts := strings.Split(domain, ".")
	if len(parts) < 2 {
		return nil, fmt.Errorf("invalid domain format")
	}
	
	rootDomain := parts[len(parts)-2] + "." + parts[len(parts)-1]
	
	zone, err := dm.cloudflareAPI.GetZoneByName(rootDomain)
	if err != nil {
		return nil, fmt.Errorf("zone not found for domain %s: %w", rootDomain, err)
	}
	
	return zone, nil
}

// createDNSRecord creates a DNS record for the tunnel
func (dm *DomainManager) createDNSRecord(zoneID, domain, tunnelID string) (*cloudflare.DNSRecord, error) {
	// Create CNAME record pointing to the tunnel
	recordReq := cloudflare.CreateDNSRecordRequest{
		Type:    "CNAME",
		Name:    domain,
		Content: fmt.Sprintf("%s.cfargotunnel.com", tunnelID),
		TTL:     1, // Auto TTL
		Proxied: false, // Don't proxy through Cloudflare for tunnel
	}
	
	record, err := dm.cloudflareAPI.CreateDNSRecord(zoneID, recordReq)
	if err != nil {
		return nil, fmt.Errorf("failed to create DNS record: %w", err)
	}
	
	return record, nil
}

// CheckDomainStatus checks the status of a domain assignment
func (dm *DomainManager) CheckDomainStatus(domain string) (string, error) {
	assignment, err := dm.GetDomainAssignment(domain)
	if err != nil {
		return "", fmt.Errorf("failed to get domain assignment: %w", err)
	}
	
	// Get tunnel status
	tunnelStatus, err := dm.cloudflareAPI.GetTunnel(assignment.TunnelID)
	if err != nil {
		return "", fmt.Errorf("failed to get tunnel status: %w", err)
	}
	
	// Determine overall status
	status := "unknown"
	if tunnelStatus.Status == "active" {
		status = "active"
	} else if tunnelStatus.Status == "inactive" {
		status = "inactive"
	} else {
		status = "pending"
	}
	
	return status, nil
}
