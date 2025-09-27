/**
 * Cloudflare Custom Domain E2E Tests
 * 
 * Complete end-to-end testing for cloudflared tunnel custom domain functionality.
 * These tests cover the full user journey from setup to teardown.
 * 
 * Prerequisites:
 * - Cloudflare API token with tunnel and DNS permissions
 * - Valid Cloudflare zone for testing
 * - Test domain configured in Cloudflare
 * 
 * Environment Variables:
 * - CLOUDFLARE_API_TOKEN: API token for testing
 * - CLOUDFLARE_ACCOUNT_ID: Cloudflare account ID
 * - CLOUDFLARE_ZONE_ID: Zone ID for test domain
 * - TEST_DOMAIN: Test domain (e.g., test.example.com)
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import { CloudflareTestHelper } from '../test-helpers/cloudflare-helper';

// Test configuration
const TEST_CONFIG = {
  baseURL: 'http://localhost:1420', // Tauri dev server
  timeout: 60000, // Extended timeout for tunnel operations
  tunnelStartTimeout: 30000,
  dnsValidationTimeout: 60000,
};

// Skip tests if required environment variables are missing
const requiredEnvVars = [
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID', 
  'CLOUDFLARE_ZONE_ID',
  'TEST_DOMAIN'
];

const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.warn(`⚠️ Skipping Cloudflare E2E tests - Missing environment variables: ${missingVars.join(', ')}`);
}

test.describe.configure({ mode: 'serial' }); // Run tests in sequence to avoid conflicts

test.describe('Cloudflare Custom Domain E2E Tests', () => {
  let cloudflareHelper: CloudflareTestHelper;
  let testTunnelId: string;
  let testDnsRecordId: string;

  test.beforeAll(async () => {
    // Skip all tests if env vars missing
    test.skip(missingVars.length > 0, 'Missing required environment variables');
    
    cloudflareHelper = new CloudflareTestHelper({
      apiToken: process.env.CLOUDFLARE_API_TOKEN!,
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
      zoneId: process.env.CLOUDFLARE_ZONE_ID!,
      testDomain: process.env.TEST_DOMAIN!
    });

    // Cleanup any existing test resources
    await cloudflareHelper.cleanupTestResources();
  });

  test.afterAll(async () => {
    // Cleanup test resources
    if (cloudflareHelper) {
      await cloudflareHelper.cleanupTestResources();
    }
  });

  test.beforeEach(async ({ page }) => {
    // Set longer timeout for tunnel operations
    test.setTimeout(TEST_CONFIG.timeout);
    
    // Navigate to TunnelForge settings
    await page.goto(TEST_CONFIG.baseURL);
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    
    // Navigate to integrations/cloudflare section
    await page.click('[data-testid="settings-button"]');
    await page.click('text=Integrations');
    await page.click('text=Cloudflare');
  });

  test.describe('Cloudflare Configuration Setup', () => {
    test('should allow user to configure Cloudflare API credentials', async ({ page }) => {
      // Check if credentials section exists
      await expect(page.locator('[data-testid="cloudflare-config-section"]')).toBeVisible();
      
      // Fill API credentials
      await page.fill('[data-testid="cf-api-token"]', process.env.CLOUDFLARE_API_TOKEN!);
      await page.fill('[data-testid="cf-account-id"]', process.env.CLOUDFLARE_ACCOUNT_ID!);
      await page.fill('[data-testid="cf-zone-id"]', process.env.CLOUDFLARE_ZONE_ID!);
      
      // Save credentials
      await page.click('[data-testid="save-cf-credentials"]');
      
      // Should show success message
      await expect(page.locator('.success-message')).toContainText('Credentials saved successfully');
      
      // Should validate API token
      await expect(page.locator('[data-testid="cf-token-status"]')).toContainText('Valid', { timeout: 10000 });
    });

    test('should validate API token permissions', async ({ page }) => {
      // Configure credentials first
      await page.fill('[data-testid="cf-api-token"]', process.env.CLOUDFLARE_API_TOKEN!);
      await page.fill('[data-testid="cf-account-id"]', process.env.CLOUDFLARE_ACCOUNT_ID!);
      
      // Trigger validation
      await page.click('[data-testid="validate-token"]');
      
      // Should show permission check results
      await expect(page.locator('[data-testid="tunnel-permission"]')).toContainText('✓ Tunnel management');
      await expect(page.locator('[data-testid="dns-permission"]')).toContainText('✓ DNS record management');
      await expect(page.locator('[data-testid="zone-permission"]')).toContainText('✓ Zone access');
    });

    test('should handle invalid API credentials gracefully', async ({ page }) => {
      // Fill invalid credentials
      await page.fill('[data-testid="cf-api-token"]', 'invalid-token-12345');
      await page.fill('[data-testid="cf-account-id"]', 'invalid-account-id');
      
      // Try to save
      await page.click('[data-testid="save-cf-credentials"]');
      
      // Should show error message
      await expect(page.locator('.error-message')).toContainText('Invalid API credentials');
      await expect(page.locator('[data-testid="cf-token-status"]')).toContainText('Invalid');
    });
  });

  test.describe('Custom Domain Configuration', () => {
    test.beforeEach(async ({ page }) => {
      // Configure valid credentials for domain tests
      await page.fill('[data-testid="cf-api-token"]', process.env.CLOUDFLARE_API_TOKEN!);
      await page.fill('[data-testid="cf-account-id"]', process.env.CLOUDFLARE_ACCOUNT_ID!);
      await page.fill('[data-testid="cf-zone-id"]', process.env.CLOUDFLARE_ZONE_ID!);
      await page.click('[data-testid="save-cf-credentials"]');
      await expect(page.locator('.success-message')).toBeVisible();
    });

    test('should validate domain format', async ({ page }) => {
      // Navigate to domain configuration
      await page.click('[data-testid="configure-domain"]');
      
      const invalidDomains = [
        'invalid-domain',
        'http://example.com',
        'ftp://test.com',
        '.example.com',
        'example..com',
        'toolong.'.repeat(100) + 'com'
      ];

      for (const domain of invalidDomains) {
        await page.fill('[data-testid="custom-domain-input"]', domain);
        await page.click('[data-testid="validate-domain"]');
        
        await expect(page.locator('.domain-validation-error')).toContainText('Invalid domain format');
      }
    });

    test('should validate domain ownership', async ({ page }) => {
      // Navigate to domain configuration
      await page.click('[data-testid="configure-domain"]');
      
      // Enter test domain
      await page.fill('[data-testid="custom-domain-input"]', process.env.TEST_DOMAIN!);
      
      // Validate domain
      await page.click('[data-testid="validate-domain"]');
      
      // Should show ownership validation
      await expect(page.locator('[data-testid="domain-ownership-status"]')).toContainText('Validating ownership...', { timeout: 10000 });
      await expect(page.locator('[data-testid="domain-ownership-status"]')).toContainText('✓ Domain ownership verified', { timeout: 30000 });
      
      // Should show zone information
      await expect(page.locator('[data-testid="domain-zone-info"]')).toContainText(process.env.CLOUDFLARE_ZONE_ID!);
    });

    test('should handle domain not in Cloudflare account', async ({ page }) => {
      // Navigate to domain configuration
      await page.click('[data-testid="configure-domain"]');
      
      // Enter domain not in account
      await page.fill('[data-testid="custom-domain-input"]', 'notmydomain.example');
      await page.click('[data-testid="validate-domain"]');
      
      // Should show error
      await expect(page.locator('.domain-validation-error')).toContainText('Domain not found in your Cloudflare account');
    });
  });

  test.describe('Tunnel Creation with Custom Domain', () => {
    test.beforeEach(async ({ page }) => {
      // Setup credentials and domain
      await page.fill('[data-testid="cf-api-token"]', process.env.CLOUDFLARE_API_TOKEN!);
      await page.fill('[data-testid="cf-account-id"]', process.env.CLOUDFLARE_ACCOUNT_ID!);
      await page.fill('[data-testid="cf-zone-id"]', process.env.CLOUDFLARE_ZONE_ID!);
      await page.click('[data-testid="save-cf-credentials"]');
      await expect(page.locator('.success-message')).toBeVisible();
      
      // Configure domain
      await page.click('[data-testid="configure-domain"]');
      await page.fill('[data-testid="custom-domain-input"]', process.env.TEST_DOMAIN!);
      await page.click('[data-testid="validate-domain"]');
      await expect(page.locator('[data-testid="domain-ownership-status"]')).toContainText('✓ Domain ownership verified', { timeout: 30000 });
    });

    test('should create tunnel with custom domain successfully', async ({ page }) => {
      // Create tunnel with custom domain
      await page.click('[data-testid="create-custom-tunnel"]');
      
      // Fill tunnel configuration
      await page.fill('[data-testid="tunnel-name"]', `test-tunnel-${Date.now()}`);
      await page.fill('[data-testid="local-port"]', '4021');
      await page.fill('[data-testid="tunnel-domain"]', process.env.TEST_DOMAIN!);
      
      // Create tunnel
      await page.click('[data-testid="create-tunnel-submit"]');
      
      // Should show creation progress
      await expect(page.locator('[data-testid="tunnel-creation-status"]')).toContainText('Creating tunnel...', { timeout: 5000 });
      await expect(page.locator('[data-testid="tunnel-creation-status"]')).toContainText('Creating DNS record...', { timeout: 15000 });
      await expect(page.locator('[data-testid="tunnel-creation-status"]')).toContainText('Tunnel created successfully!', { timeout: TEST_CONFIG.tunnelStartTimeout });
      
      // Should display tunnel information
      await expect(page.locator('[data-testid="tunnel-id"]')).toBeVisible();
      await expect(page.locator('[data-testid="tunnel-url"]')).toContainText(process.env.TEST_DOMAIN!);
      await expect(page.locator('[data-testid="tunnel-status"]')).toContainText('Active');
      
      // Store tunnel ID for cleanup
      testTunnelId = await page.locator('[data-testid="tunnel-id"]').textContent() || '';
    });

    test('should handle tunnel creation failure gracefully', async ({ page }) => {
      // Mock API failure by using invalid port
      await page.click('[data-testid="create-custom-tunnel"]');
      
      await page.fill('[data-testid="tunnel-name"]', 'fail-test-tunnel');
      await page.fill('[data-testid="local-port"]', '99999'); // Invalid port
      await page.fill('[data-testid="tunnel-domain"]', process.env.TEST_DOMAIN!);
      
      await page.click('[data-testid="create-tunnel-submit"]');
      
      // Should show error message
      await expect(page.locator('.tunnel-creation-error')).toContainText('Failed to create tunnel');
      await expect(page.locator('[data-testid="tunnel-status"]')).toContainText('Failed');
      
      // Should provide troubleshooting guidance
      await expect(page.locator('[data-testid="troubleshooting-help"]')).toBeVisible();
    });

    test('should prevent duplicate domain assignment', async ({ page }) => {
      // First, create a tunnel with the domain
      await page.click('[data-testid="create-custom-tunnel"]');
      await page.fill('[data-testid="tunnel-name"]', `tunnel1-${Date.now()}`);
      await page.fill('[data-testid="local-port"]', '4021');
      await page.fill('[data-testid="tunnel-domain"]', process.env.TEST_DOMAIN!);
      await page.click('[data-testid="create-tunnel-submit"]');
      await expect(page.locator('[data-testid="tunnel-creation-status"]')).toContainText('Tunnel created successfully!', { timeout: TEST_CONFIG.tunnelStartTimeout });
      
      // Try to create another tunnel with same domain
      await page.click('[data-testid="create-another-tunnel"]');
      await page.fill('[data-testid="tunnel-name"]', `tunnel2-${Date.now()}`);
      await page.fill('[data-testid="local-port"]', '4022');
      await page.fill('[data-testid="tunnel-domain"]', process.env.TEST_DOMAIN!);
      await page.click('[data-testid="create-tunnel-submit"]');
      
      // Should show error about domain already in use
      await expect(page.locator('.tunnel-creation-error')).toContainText('Domain already assigned to another tunnel');
    });
  });

  test.describe('Tunnel Management', () => {
    test.beforeEach(async ({ page, context }) => {
      // Setup and create a test tunnel
      await page.fill('[data-testid="cf-api-token"]', process.env.CLOUDFLARE_API_TOKEN!);
      await page.fill('[data-testid="cf-account-id"]', process.env.CLOUDFLARE_ACCOUNT_ID!);
      await page.fill('[data-testid="cf-zone-id"]', process.env.CLOUDFLARE_ZONE_ID!);
      await page.click('[data-testid="save-cf-credentials"]');
      
      // Create test tunnel via API (faster setup)
      testTunnelId = await cloudflareHelper.createTestTunnel(`e2e-test-${Date.now()}`, process.env.TEST_DOMAIN!);
    });

    test('should display tunnel list with status information', async ({ page }) => {
      // Navigate to tunnels list
      await page.click('[data-testid="view-tunnels"]');
      
      // Should show tunnel list
      await expect(page.locator('[data-testid="tunnels-list"]')).toBeVisible();
      await expect(page.locator(`[data-tunnel-id="${testTunnelId}"]`)).toBeVisible();
      
      // Should show tunnel details
      const tunnelCard = page.locator(`[data-tunnel-id="${testTunnelId}"]`);
      await expect(tunnelCard.locator('[data-testid="tunnel-name"]')).toBeVisible();
      await expect(tunnelCard.locator('[data-testid="tunnel-domain"]')).toContainText(process.env.TEST_DOMAIN!);
      await expect(tunnelCard.locator('[data-testid="tunnel-status"]')).toContainText('Active');
    });

    test('should start and stop tunnel successfully', async ({ page }) => {
      await page.click('[data-testid="view-tunnels"]');
      const tunnelCard = page.locator(`[data-tunnel-id="${testTunnelId}"]`);
      
      // Stop tunnel
      await tunnelCard.locator('[data-testid="stop-tunnel"]').click();
      await expect(tunnelCard.locator('[data-testid="tunnel-status"]')).toContainText('Stopped', { timeout: 15000 });
      
      // Start tunnel
      await tunnelCard.locator('[data-testid="start-tunnel"]').click();
      await expect(tunnelCard.locator('[data-testid="tunnel-status"]')).toContainText('Starting...', { timeout: 5000 });
      await expect(tunnelCard.locator('[data-testid="tunnel-status"]')).toContainText('Active', { timeout: TEST_CONFIG.tunnelStartTimeout });
    });

    test('should show tunnel logs and metrics', async ({ page }) => {
      await page.click('[data-testid="view-tunnels"]');
      const tunnelCard = page.locator(`[data-tunnel-id="${testTunnelId}"]`);
      
      // View tunnel details
      await tunnelCard.click();
      
      // Should show logs section
      await expect(page.locator('[data-testid="tunnel-logs"]')).toBeVisible();
      await expect(page.locator('[data-testid="log-entries"]')).toBeVisible();
      
      // Should show metrics
      await page.click('[data-testid="metrics-tab"]');
      await expect(page.locator('[data-testid="tunnel-metrics"]')).toBeVisible();
      await expect(page.locator('[data-testid="connections-count"]')).toBeVisible();
      await expect(page.locator('[data-testid="requests-count"]')).toBeVisible();
    });

    test('should update tunnel configuration', async ({ page }) => {
      await page.click('[data-testid="view-tunnels"]');
      const tunnelCard = page.locator(`[data-tunnel-id="${testTunnelId}"]`);
      
      // Edit tunnel
      await tunnelCard.locator('[data-testid="edit-tunnel"]').click();
      
      // Update configuration
      await page.fill('[data-testid="edit-local-port"]', '4022');
      await page.click('[data-testid="save-tunnel-config"]');
      
      // Should show update success
      await expect(page.locator('.config-update-success')).toContainText('Tunnel configuration updated');
      
      // Should restart tunnel automatically
      await expect(tunnelCard.locator('[data-testid="tunnel-status"]')).toContainText('Restarting...', { timeout: 5000 });
      await expect(tunnelCard.locator('[data-testid="tunnel-status"]')).toContainText('Active', { timeout: TEST_CONFIG.tunnelStartTimeout });
    });

    test('should delete tunnel and cleanup DNS records', async ({ page }) => {
      await page.click('[data-testid="view-tunnels"]');
      const tunnelCard = page.locator(`[data-tunnel-id="${testTunnelId}"]`);
      
      // Delete tunnel
      await tunnelCard.locator('[data-testid="delete-tunnel"]').click();
      
      // Confirm deletion
      await page.click('[data-testid="confirm-delete-tunnel"]');
      
      // Should show deletion progress
      await expect(page.locator('[data-testid="deletion-status"]')).toContainText('Stopping tunnel...', { timeout: 5000 });
      await expect(page.locator('[data-testid="deletion-status"]')).toContainText('Removing DNS record...', { timeout: 15000 });
      await expect(page.locator('[data-testid="deletion-status"]')).toContainText('Tunnel deleted successfully', { timeout: 30000 });
      
      // Tunnel should be removed from list
      await expect(page.locator(`[data-tunnel-id="${testTunnelId}"]`)).not.toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('DNS Integration and Validation', () => {
    test('should verify DNS record creation', async ({ page }) => {
      // Create tunnel and verify DNS
      testTunnelId = await cloudflareHelper.createTestTunnel(`dns-test-${Date.now()}`, process.env.TEST_DOMAIN!);
      
      // Check DNS record via API
      const dnsRecord = await cloudflareHelper.findDnsRecord(process.env.TEST_DOMAIN!);
      expect(dnsRecord).toBeTruthy();
      expect(dnsRecord?.type).toBe('CNAME');
      expect(dnsRecord?.content).toContain('cfargotunnel.com');
    });

    test('should handle DNS propagation validation', async ({ page }) => {
      await page.click('[data-testid="view-tunnels"]');
      const tunnelCard = page.locator(`[data-tunnel-id="${testTunnelId}"]`);
      
      // Check DNS propagation
      await tunnelCard.locator('[data-testid="check-dns"]').click();
      
      // Should show DNS check progress
      await expect(page.locator('[data-testid="dns-check-status"]')).toContainText('Checking DNS propagation...', { timeout: 5000 });
      await expect(page.locator('[data-testid="dns-check-status"]')).toContainText('DNS propagated successfully', { timeout: TEST_CONFIG.dnsValidationTimeout });
      
      // Should show propagation details
      await expect(page.locator('[data-testid="dns-servers-checked"]')).toBeVisible();
      await expect(page.locator('[data-testid="dns-response-time"]')).toBeVisible();
    });

    test('should handle DNS conflicts', async ({ page }) => {
      // Create conflicting DNS record via API
      testDnsRecordId = await cloudflareHelper.createConflictingDnsRecord(process.env.TEST_DOMAIN!);
      
      // Try to create tunnel with same domain
      await page.fill('[data-testid="cf-api-token"]', process.env.CLOUDFLARE_API_TOKEN!);
      await page.fill('[data-testid="cf-account-id"]', process.env.CLOUDFLARE_ACCOUNT_ID!);
      await page.fill('[data-testid="cf-zone-id"]', process.env.CLOUDFLARE_ZONE_ID!);
      await page.click('[data-testid="save-cf-credentials"]');
      
      await page.click('[data-testid="create-custom-tunnel"]');
      await page.fill('[data-testid="tunnel-name"]', 'conflict-test');
      await page.fill('[data-testid="tunnel-domain"]', process.env.TEST_DOMAIN!);
      await page.click('[data-testid="create-tunnel-submit"]');
      
      // Should detect and handle DNS conflict
      await expect(page.locator('.dns-conflict-error')).toContainText('DNS record already exists for this domain');
      await expect(page.locator('[data-testid="resolve-conflict-options"]')).toBeVisible();
      
      // Should offer to replace existing record
      await page.click('[data-testid="replace-existing-record"]');
      await expect(page.locator('[data-testid="tunnel-creation-status"]')).toContainText('Tunnel created successfully!', { timeout: TEST_CONFIG.tunnelStartTimeout });
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle Cloudflare API rate limiting', async ({ page }) => {
      // Configure credentials
      await page.fill('[data-testid="cf-api-token"]', process.env.CLOUDFLARE_API_TOKEN!);
      await page.fill('[data-testid="cf-account-id"]', process.env.CLOUDFLARE_ACCOUNT_ID!);
      await page.click('[data-testid="save-cf-credentials"]');
      
      // Create multiple tunnels rapidly to trigger rate limiting
      const tunnelPromises = [];
      for (let i = 0; i < 10; i++) {
        tunnelPromises.push((async () => {
          await page.click('[data-testid="create-custom-tunnel"]');
          await page.fill('[data-testid="tunnel-name"]', `rate-limit-test-${i}`);
          await page.fill('[data-testid="tunnel-domain"]', `test${i}.${process.env.TEST_DOMAIN!}`);
          await page.click('[data-testid="create-tunnel-submit"]');
        })());
      }
      
      // Should handle rate limiting gracefully
      await expect(page.locator('.rate-limit-warning')).toContainText('Rate limit exceeded. Please wait before creating more tunnels.');
      await expect(page.locator('[data-testid="retry-after-timer"]')).toBeVisible();
    });

    test('should handle network connectivity issues', async ({ page, context }) => {
      // Configure credentials first
      await page.fill('[data-testid="cf-api-token"]', process.env.CLOUDFLARE_API_TOKEN!);
      await page.fill('[data-testid="cf-account-id"]', process.env.CLOUDFLARE_ACCOUNT_ID!);
      await page.click('[data-testid="save-cf-credentials"]');
      
      // Simulate network offline
      await context.setOffline(true);
      
      // Try to create tunnel
      await page.click('[data-testid="create-custom-tunnel"]');
      await page.fill('[data-testid="tunnel-name"]', 'offline-test');
      await page.click('[data-testid="create-tunnel-submit"]');
      
      // Should show network error
      await expect(page.locator('.network-error')).toContainText('Unable to connect to Cloudflare API');
      
      // Restore connectivity
      await context.setOffline(false);
      
      // Should allow retry
      await page.click('[data-testid="retry-tunnel-creation"]');
      await expect(page.locator('[data-testid="tunnel-creation-status"]')).toContainText('Tunnel created successfully!', { timeout: TEST_CONFIG.tunnelStartTimeout });
    });

    test('should handle invalid tunnel configurations', async ({ page }) => {
      await page.fill('[data-testid="cf-api-token"]', process.env.CLOUDFLARE_API_TOKEN!);
      await page.fill('[data-testid="cf-account-id"]', process.env.CLOUDFLARE_ACCOUNT_ID!);
      await page.click('[data-testid="save-cf-credentials"]');
      
      // Test various invalid configurations
      const invalidConfigs = [
        { name: '', port: '4021', domain: process.env.TEST_DOMAIN!, error: 'Tunnel name is required' },
        { name: 'test', port: '0', domain: process.env.TEST_DOMAIN!, error: 'Invalid port number' },
        { name: 'test', port: '99999', domain: process.env.TEST_DOMAIN!, error: 'Port must be between 1 and 65535' },
        { name: 'test', port: '4021', domain: '', error: 'Domain is required' },
        { name: 'test', port: '4021', domain: 'invalid..domain', error: 'Invalid domain format' },
      ];

      for (const config of invalidConfigs) {
        await page.click('[data-testid="create-custom-tunnel"]');
        
        await page.fill('[data-testid="tunnel-name"]', config.name);
        await page.fill('[data-testid="local-port"]', config.port);
        await page.fill('[data-testid="tunnel-domain"]', config.domain);
        
        await page.click('[data-testid="create-tunnel-submit"]');
        
        await expect(page.locator('.validation-error')).toContainText(config.error);
        
        // Close modal
        await page.click('[data-testid="cancel-tunnel-creation"]');
      }
    });

    test('should handle tunnel cleanup on app shutdown', async ({ page, context }) => {
      // Create a tunnel
      testTunnelId = await cloudflareHelper.createTestTunnel(`cleanup-test-${Date.now()}`, process.env.TEST_DOMAIN!);
      
      // Navigate to tunnels
      await page.click('[data-testid="view-tunnels"]');
      await expect(page.locator(`[data-tunnel-id="${testTunnelId}"]`)).toBeVisible();
      
      // Simulate app close
      await page.close();
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Verify tunnel was properly stopped (but not deleted)
      const tunnelStatus = await cloudflareHelper.getTunnelStatus(testTunnelId);
      expect(tunnelStatus).toBe('inactive');
    });
  });

  test.describe('Performance and Load Testing', () => {
    test('should handle multiple concurrent tunnel operations', async ({ browser }) => {
      const contexts = await Promise.all(
        Array.from({ length: 5 }, () => browser.newContext())
      );
      
      const pages = await Promise.all(
        contexts.map(context => context.newPage())
      );

      try {
        // Setup each page with credentials
        await Promise.all(pages.map(async (page, index) => {
          await page.goto(TEST_CONFIG.baseURL);
          await page.click('[data-testid="settings-button"]');
          await page.click('text=Integrations');
          await page.click('text=Cloudflare');
          
          await page.fill('[data-testid="cf-api-token"]', process.env.CLOUDFLARE_API_TOKEN!);
          await page.fill('[data-testid="cf-account-id"]', process.env.CLOUDFLARE_ACCOUNT_ID!);
          await page.fill('[data-testid="cf-zone-id"]', process.env.CLOUDFLARE_ZONE_ID!);
          await page.click('[data-testid="save-cf-credentials"]');
          
          // Create tunnel with unique subdomain
          await page.click('[data-testid="create-custom-tunnel"]');
          await page.fill('[data-testid="tunnel-name"]', `concurrent-test-${index}`);
          await page.fill('[data-testid="local-port"]', `${4021 + index}`);
          await page.fill('[data-testid="tunnel-domain"]', `test${index}.${process.env.TEST_DOMAIN!}`);
          await page.click('[data-testid="create-tunnel-submit"]');
        }));

        // All tunnels should be created successfully
        await Promise.all(pages.map(page => 
          expect(page.locator('[data-testid="tunnel-creation-status"]')).toContainText(
            'Tunnel created successfully!', 
            { timeout: TEST_CONFIG.tunnelStartTimeout }
          )
        ));

      } finally {
        // Cleanup
        await Promise.all(contexts.map(context => context.close()));
      }
    });

    test('should handle rapid tunnel status updates', async ({ page }) => {
      testTunnelId = await cloudflareHelper.createTestTunnel(`status-test-${Date.now()}`, process.env.TEST_DOMAIN!);
      
      await page.click('[data-testid="view-tunnels"]');
      const tunnelCard = page.locator(`[data-tunnel-id="${testTunnelId}"]`);
      
      // Rapidly start/stop tunnel multiple times
      for (let i = 0; i < 10; i++) {
        await tunnelCard.locator('[data-testid="stop-tunnel"]').click();
        await expect(tunnelCard.locator('[data-testid="tunnel-status"]')).toContainText('Stopped', { timeout: 15000 });
        
        await tunnelCard.locator('[data-testid="start-tunnel"]').click();
        await expect(tunnelCard.locator('[data-testid="tunnel-status"]')).toContainText('Active', { timeout: TEST_CONFIG.tunnelStartTimeout });
      }
      
      // Final state should be consistent
      await expect(tunnelCard.locator('[data-testid="tunnel-status"]')).toContainText('Active');
    });
  });

  test.describe('Accessibility and Usability', () => {
    test('should be fully keyboard navigable', async ({ page }) => {
      await page.goto(TEST_CONFIG.baseURL);
      
      // Navigate through cloudflare settings using keyboard only
      await page.keyboard.press('Tab'); // Settings button
      await page.keyboard.press('Enter');
      
      await page.keyboard.press('Tab'); // Integrations tab
      await page.keyboard.press('Enter');
      
      await page.keyboard.press('Tab'); // Cloudflare section
      await page.keyboard.press('Enter');
      
      // Fill credentials using keyboard
      await page.keyboard.press('Tab'); // API token field
      await page.keyboard.type(process.env.CLOUDFLARE_API_TOKEN!);
      
      await page.keyboard.press('Tab'); // Account ID field  
      await page.keyboard.type(process.env.CLOUDFLARE_ACCOUNT_ID!);
      
      await page.keyboard.press('Tab'); // Zone ID field
      await page.keyboard.type(process.env.CLOUDFLARE_ZONE_ID!);
      
      await page.keyboard.press('Tab'); // Save button
      await page.keyboard.press('Enter');
      
      // Should save successfully via keyboard navigation
      await expect(page.locator('.success-message')).toBeVisible();
    });

    test('should provide screen reader accessible content', async ({ page }) => {
      await page.goto(TEST_CONFIG.baseURL);
      await page.click('[data-testid="settings-button"]');
      await page.click('text=Integrations');
      await page.click('text=Cloudflare');
      
      // Check ARIA labels and screen reader content
      await expect(page.locator('[aria-label="Cloudflare API token input"]')).toBeVisible();
      await expect(page.locator('[aria-label="Cloudflare account ID input"]')).toBeVisible();
      await expect(page.locator('[aria-describedby="cf-token-help"]')).toBeVisible();
      
      // Check live regions for status updates
      await expect(page.locator('[aria-live="polite"]')).toBeVisible();
      await expect(page.locator('[role="status"]')).toBeVisible();
    });

    test('should provide helpful error messages and guidance', async ({ page }) => {
      await page.goto(TEST_CONFIG.baseURL);
      await page.click('[data-testid="settings-button"]');
      await page.click('text=Integrations');
      await page.click('text=Cloudflare');
      
      // Try to create tunnel without credentials
      await page.click('[data-testid="create-custom-tunnel"]');
      
      // Should show helpful error with guidance
      await expect(page.locator('.credentials-required-error')).toContainText('Cloudflare API credentials are required');
      await expect(page.locator('[data-testid="credentials-help-link"]')).toContainText('How to get API credentials');
      
      // Click help link should show guidance
      await page.click('[data-testid="credentials-help-link"]');
      await expect(page.locator('[data-testid="api-credentials-guide"]')).toBeVisible();
      await expect(page.locator('[data-testid="api-credentials-guide"]')).toContainText('Step 1: Log into Cloudflare Dashboard');
    });
  });
});

// Test hooks for cleanup
test.afterEach(async () => {
  // Cleanup any test tunnels created during the test
  if (testTunnelId && cloudflareHelper) {
    await cloudflareHelper.cleanupTunnel(testTunnelId);
    testTunnelId = '';
  }
  
  if (testDnsRecordId && cloudflareHelper) {
    await cloudflareHelper.cleanupDnsRecord(testDnsRecordId);
    testDnsRecordId = '';
  }
});