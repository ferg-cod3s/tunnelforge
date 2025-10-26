# Cloudflare Custom Domains for TunnelForge

**Guide**: Setting up custom domains for your TunnelForge instance using Cloudflare Tunnel

## Overview

TunnelForge supports two types of Cloudflare tunnels:
1. **Quick Tunnel** - Temporary, random subdomain (e.g., `abc-123.trycloudflare.com`)
2. **Custom Domain** - Your own domain (e.g., `tunnelforge.yourdomain.com`)

This guide covers setting up custom domains for a professional, permanent URL.

## Prerequisites

- Cloudflare account (free tier works)
- Domain registered with Cloudflare (or DNS managed by Cloudflare)
- `cloudflared` CLI installed
- TunnelForge server running

## Quick Setup (5 Minutes)

```bash
# 1. Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
sudo mv cloudflared /usr/local/bin/
sudo chmod +x /usr/local/bin/cloudflared

# 2. Login to Cloudflare
cloudflared tunnel login

# 3. Create tunnel
cloudflared tunnel create tunnelforge

# 4. Configure DNS (replace with your domain)
cloudflared tunnel route dns tunnelforge tunnelforge.yourdomain.com

# 5. Start via TunnelForge (see API section below)
```

## Detailed Setup

### Step 1: Install Cloudflared

**Linux (Debian/Ubuntu)**:
```bash
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

**macOS**:
```bash
brew install cloudflare/cloudflare/cloudflared
```

**Windows**:
Download from: https://github.com/cloudflare/cloudflared/releases/latest

**Verify**:
```bash
cloudflared --version
```

### Step 2: Authenticate with Cloudflare

```bash
cloudflared tunnel login
```

This opens your browser. Select the domain you want to use.

### Step 3: Create Named Tunnel

```bash
cloudflared tunnel create tunnelforge
```

**Output**:
```
Tunnel credentials written to /home/user/.cloudflared/<TUNNEL-ID>.json
Created tunnel tunnelforge with id <TUNNEL-ID>
```

**⚠️ Important**: Save the tunnel ID and credentials path!

### Step 4: Configure DNS

**Via CLI** (recommended):
```bash
cloudflared tunnel route dns tunnelforge tunnelforge.yourdomain.com
```

**Via Cloudflare Dashboard**:
1. Go to DNS → Records → Add record
2. Type: `CNAME`
3. Name: `tunnelforge`
4. Target: `<TUNNEL-ID>.cfargotunnel.com`
5. Proxy: Enabled (orange cloud)

### Step 5: Start Tunnel via TunnelForge

**Option A: Web UI** (Coming Soon)
1. Settings → Network Access
2. Enable "Cloudflare Tunnel"
3. Select "Custom Domain"
4. Enter tunnel details
5. Click "Start"

**Option B: API**:
```bash
curl -X POST http://localhost:4021/api/tunnels/cloudflare/start \
  -H "Content-Type: application/json" \
  -d '{
    "tunnelId": "<TUNNEL-ID>",
    "hostname": "tunnelforge.yourdomain.com",
    "credPath": "/home/user/.cloudflared/<TUNNEL-ID>.json"
  }'
```

### Step 6: Verify

```bash
# Check tunnel status
curl http://localhost:4021/api/tunnels/status

# Test your domain
curl https://tunnelforge.yourdomain.com/health
```

Expected response: `{"status":"ok"}`

## Configuration Details

TunnelForge automatically creates:
```yaml
# /tmp/cloudflared-<TUNNEL-ID>.yml
tunnel: <TUNNEL-ID>
credentials-file: /home/user/.cloudflared/<TUNNEL-ID>.json

ingress:
  - hostname: tunnelforge.yourdomain.com
    service: http://localhost:4021
  - service: http_status:404
```

## Auto-Start (Optional)

### Linux Systemd Service

Create `/etc/systemd/system/cloudflared-tunnelforge.service`:
```ini
[Unit]
Description=Cloudflare Tunnel for TunnelForge
After=network.target

[Service]
Type=simple
User=tunnelforge
ExecStart=/usr/local/bin/cloudflared tunnel --config /etc/cloudflared/config.yml run tunnelforge
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl enable cloudflared-tunnelforge
sudo systemctl start cloudflared-tunnelforge
```

## Troubleshooting

### Tunnel Not Starting
```bash
# Verify cloudflared installed
cloudflared --version

# List tunnels
cloudflared tunnel list

# Check credentials
ls -la ~/.cloudflared/<TUNNEL-ID>.json
```

### DNS Not Resolving
```bash
# Check DNS
dig tunnelforge.yourdomain.com

# Should show CNAME to *.cfargotunnel.com
```

### Wrong Public URL
1. Stop tunnel
2. Clear cache: `rm /tmp/cloudflared-*.yml`
3. Restart with correct hostname

## Security Best Practices

1. **Protect credentials**:
   ```bash
   chmod 600 ~/.cloudflared/<TUNNEL-ID>.json
   ```

2. **Enable Cloudflare Access** for authentication

3. **Use firewall rules** to restrict access

4. **Monitor tunnel** status and uptime

## Advanced: Multiple Domains

```yaml
tunnel: <TUNNEL-ID>
credentials-file: ~/.cloudflared/<TUNNEL-ID>.json

ingress:
  - hostname: tunnelforge.yourdomain.com
    service: http://localhost:4021
  - hostname: api.yourdomain.com
    service: http://localhost:8080
  - service: http_status:404
```

## Cost

- Quick Tunnel: **Free** (temporary)
- Named Tunnel: **Free** (unlimited traffic)
- Cloudflare Access: **Free** (up to 50 users)

## Support

- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [TunnelForge Issues](https://github.com/ferg-cod3s/tunnelforge/issues)

---

**Next**: [Session Persistence Guide](./session-persistence.md) | [User Guide](./USER_GUIDE.md)
