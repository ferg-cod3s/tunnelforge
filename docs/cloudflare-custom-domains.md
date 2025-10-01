# Cloudflare Custom Domains

## Overview

TunnelForge supports custom domains for Cloudflare tunnels, allowing you to use your own domain names instead of randomly generated Cloudflare URLs. This feature provides more professional and branded tunnel URLs.

## Prerequisites

1. **Cloudflare Account**: You need a Cloudflare account with a registered domain
2. **cloudflared CLI**: Install cloudflared on your system
3. **Domain Setup**: Your domain must be configured in Cloudflare's DNS

## Configuration

### Environment Variables

Set the following environment variables for custom domain support:

```bash
# Cloudflare API credentials (required for custom domains)
export CLOUDFLARE_API_TOKEN="your-cloudflare-api-token"
export CLOUDFLARE_ACCOUNT_ID="your-cloudflare-account-id"

# Optional: Custom domain configuration
export CLOUDFLARE_CUSTOM_DOMAIN="tunnel.example.com"
```

### macOS App Configuration

In the TunnelForge macOS app:

1. Go to Settings → Remote Access → Cloudflare
2. Enable "Custom Domain Configuration"
3. Enter your custom domain (e.g., `tunnel.example.com`)
4. Start the tunnel

The app will automatically:
- Create a named tunnel with your custom domain
- Configure DNS records in Cloudflare
- Set up the tunnel to use your domain

### Web Interface Configuration

In the TunnelForge web interface:

1. Navigate to Settings → Integrations → Cloudflare
2. Enter your custom domain in the "Custom Domain" field
3. Click "Start Tunnel"

## How It Works

### Named Tunnels vs Quick Tunnels

- **Quick Tunnels**: Generate random URLs like `https://random-words.trycloudflare.com`
- **Named Tunnels**: Use your custom domain like `https://tunnel.example.com`

### DNS Configuration

When you use a custom domain, TunnelForge automatically:

1. Creates a CNAME record pointing to your tunnel
2. Configures Cloudflare to route traffic through the tunnel
3. Handles SSL/TLS certificates automatically

### Tunnel Management

Named tunnels are persistent and can be managed through:

- Cloudflare Dashboard
- `cloudflared` CLI commands
- TunnelForge interface

## Troubleshooting

### Common Issues

#### Domain Not Resolving
- Ensure your domain is properly configured in Cloudflare DNS
- Check that the CNAME record points to the correct tunnel
- Wait for DNS propagation (can take up to 24 hours)

#### SSL Certificate Issues
- Cloudflare handles SSL certificates automatically
- Ensure your domain uses Cloudflare's nameservers
- Check the Cloudflare dashboard for certificate status

#### Tunnel Connection Issues
- Verify that the tunnel is running (`cloudflared tunnel list`)
- Check firewall settings
- Ensure the local server is accessible on the specified port

### Debugging

#### Check Tunnel Status
```bash
cloudflared tunnel list
cloudflared tunnel info <tunnel-name>
```

#### View Tunnel Logs
```bash
cloudflared tunnel logs <tunnel-name>
```

#### Test DNS Resolution
```bash
nslookup tunnel.example.com
```

## Security Considerations

### API Token Permissions

Your Cloudflare API token should have minimal permissions:

- **Zone**: Read, Edit (for DNS management)
- **Account**: Read (for tunnel management)

### Domain Security

- Use HTTPS for all custom domain tunnels
- Configure appropriate firewall rules
- Monitor tunnel access logs in Cloudflare

## Advanced Configuration

### Multiple Domains

You can configure multiple domains for a single tunnel:

```bash
# In the app interface, add multiple domains
tunnel.example.com
api.example.com
```

### Subdomain Routing

Configure different subdomains to route to different local services:

- `api.example.com` → `localhost:3000`
- `app.example.com` → `localhost:8080`

### Load Balancing

For high availability, configure multiple tunnels:

```bash
# Create multiple tunnels for the same domain
cloudflared tunnel create tunnel-1
cloudflared tunnel create tunnel-2
```

## Migration from Quick Tunnels

To migrate from quick tunnels to custom domains:

1. Stop any running quick tunnels
2. Configure your custom domain in TunnelForge
3. Start the named tunnel
4. Update your applications to use the new domain
5. Remove old quick tunnel configurations

## Best Practices

1. **Use Descriptive Names**: Name your tunnels clearly (e.g., `production-tunnel`, `staging-tunnel`)
2. **Monitor Usage**: Set up Cloudflare analytics to monitor tunnel usage
3. **Regular Updates**: Keep cloudflared updated for security patches
4. **Backup Configuration**: Save tunnel configurations for disaster recovery
5. **Test Failover**: Test tunnel failover scenarios

## Support

For issues with custom domains:

1. Check the TunnelForge logs for error messages
2. Verify Cloudflare dashboard for DNS and tunnel status
3. Test DNS resolution and connectivity
4. Review cloudflared logs for detailed error information

## API Reference

### Backend Commands

- `create_named_cloudflare_tunnel`: Create a named tunnel with custom domain
- `setup_custom_domain`: Configure DNS for custom domain
- `list_cloudflare_tunnels`: List available tunnels
- `delete_cloudflare_tunnel`: Delete a named tunnel

### Configuration Options

```typescript
interface CustomDomainConfig {
  domain: string;
  tunnelName: string;
  accountId: string;
  apiToken: string;
}
```

This feature enhances TunnelForge's tunneling capabilities by providing professional, branded URLs for your applications.