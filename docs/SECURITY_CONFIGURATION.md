# TunnelForge Security Configuration Guide

## ⚠️ Critical Security Notice

**TunnelForge ships with INSECURE DEFAULTS for development convenience.**

Before deploying to production or exposing to any network, you **MUST** enable authentication and configure security settings.

---

## Table of Contents

1. [Security Architecture](#security-architecture)
2. [Authentication System](#authentication-system)
3. [Environment Variables](#environment-variables)
4. [Configuration Profiles](#configuration-profiles)
5. [Security Checklist](#security-checklist)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Security Architecture

TunnelForge implements a three-layer security model:

### Layer 1: JWT Authentication (`ENABLE_AUTH`)
- Token-based authentication using HMAC-SHA256
- Secure token generation and validation
- Automatic token refresh
- Admin-level privileges for authenticated users

### Layer 2: API Access Control (`AUTH_REQUIRED`)
- Enforces authentication on all API endpoints
- Protects WebSocket connections
- Validates tokens on every request

### Layer 3: Local Bypass (`ALLOW_LOCAL_BYPASS`)
- **Development feature only**
- Allows localhost requests with `X-TunnelForge-Local` header to bypass auth
- Automatically grants admin privileges
- **Must be disabled in production**

### Additional Security Features

- **Rate Limiting**: Configurable per-minute request limits
- **CSRF Protection**: Token-based CSRF validation
- **IP Whitelisting**: Restrict access to specific IP ranges
- **Request Logging**: Comprehensive audit trail
- **CORS Control**: Configurable allowed origins

---

## Authentication System

### How It Works

```
1. Client requests authentication
   ↓
2. Server validates credentials
   ↓
3. Server generates JWT token (expires in 24h)
   ↓
4. Client includes token in Authorization header
   ↓
5. Middleware validates token on each request
```

### Authentication Flow

**Without Local Bypass (Production):**
```
Request → Auth Middleware → Validate JWT → Allow/Deny
```

**With Local Bypass (Development):**
```
Localhost Request → Check X-TunnelForge-Local header → Bypass Auth (Admin)
Network Request   → Auth Middleware → Validate JWT → Allow/Deny
```

### Token Management

**Default Token Expiry**: 24 hours  
**Token Format**: `Bearer <token>`  
**Header**: `Authorization: Bearer eyJhbGc...`

---

## Environment Variables

### Authentication Configuration

| Variable | Default | Production | Description |
|----------|---------|------------|-------------|
| `ENABLE_AUTH` | `false` | `true` | Enable JWT authentication middleware |
| `AUTH_REQUIRED` | `false` | `true` | Require authentication on all API endpoints |
| `ALLOW_LOCAL_BYPASS` | `true` | `false` | Allow localhost to bypass auth with header |
| `JWT_SECRET` | (generated) | **REQUIRED** | Secret key for JWT signing (256+ bits) |

### Rate Limiting

| Variable | Default | Production | Description |
|----------|---------|------------|-------------|
| `ENABLE_RATE_LIMIT` | `true` | `true` | Enable rate limiting |
| `RATE_LIMIT_PER_MIN` | `100` | `60` | Maximum requests per minute per IP |

### CSRF Protection

| Variable | Default | Production | Description |
|----------|---------|------------|-------------|
| `ENABLE_CSRF` | `false` | `true` | Enable CSRF token validation |
| `CSRF_SECRET` | (default) | **REQUIRED** | Secret key for CSRF tokens (256+ bits) |

### IP Whitelisting

| Variable | Default | Production | Description |
|----------|---------|------------|-------------|
| `ENABLE_IP_WHITELIST` | `false` | `optional` | Restrict access to specific IPs |
| `ALLOWED_IPS` | `127.0.0.1/8,::1/128` | varies | Comma-separated CIDR ranges |

### CORS Configuration

| Variable | Default | Production | Description |
|----------|---------|------------|-------------|
| `ALLOWED_ORIGINS` | `*` | **REQUIRED** | Comma-separated list of allowed origins |

### Logging & Monitoring

| Variable | Default | Production | Description |
|----------|---------|------------|-------------|
| `ENABLE_REQUEST_LOG` | `true` | `true` | Log all HTTP requests |
| `LOG_LEVEL` | `info` | `warn` | Logging verbosity (debug/info/warn/error) |

---

## Configuration Profiles

### 🔓 Development Configuration (INSECURE)

**Use Case**: Local development only  
**Network Exposure**: NEVER expose to network

```bash
# .env.development
ENABLE_AUTH=false
AUTH_REQUIRED=false
ALLOW_LOCAL_BYPASS=true
ENABLE_RATE_LIMIT=true
RATE_LIMIT_PER_MIN=100
ENABLE_CSRF=false
ENABLE_IP_WHITELIST=false
ALLOWED_ORIGINS=*
LOG_LEVEL=debug
```

**⚠️ Warning**: This configuration allows unauthenticated access. Only use on trusted localhost.

---

### 🔒 Production Configuration (SECURE)

**Use Case**: Production deployment, public/network exposure  
**Network Exposure**: Safe for internet-facing deployment

```bash
# .env.production
# Authentication - REQUIRED
ENABLE_AUTH=true
AUTH_REQUIRED=true
ALLOW_LOCAL_BYPASS=false
JWT_SECRET=<generate-random-256-bit-key>

# Rate Limiting
ENABLE_RATE_LIMIT=true
RATE_LIMIT_PER_MIN=60

# CSRF Protection
ENABLE_CSRF=true
CSRF_SECRET=<generate-random-256-bit-key>

# IP Whitelisting (optional)
ENABLE_IP_WHITELIST=false
# ALLOWED_IPS=10.0.0.0/8,192.168.0.0/16

# CORS - Restrict to your domains
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Logging
ENABLE_REQUEST_LOG=true
LOG_LEVEL=warn
```

**🔑 Generate Secrets:**
```bash
# Generate JWT_SECRET
openssl rand -base64 32

# Generate CSRF_SECRET
openssl rand -base64 32
```

---

### 🧪 Testing Configuration (BALANCED)

**Use Case**: CI/CD, integration testing, staging  
**Network Exposure**: Limited network exposure acceptable

```bash
# .env.testing
ENABLE_AUTH=true
AUTH_REQUIRED=false
ALLOW_LOCAL_BYPASS=true
ENABLE_RATE_LIMIT=true
RATE_LIMIT_PER_MIN=200
ENABLE_CSRF=false
ENABLE_IP_WHITELIST=false
JWT_SECRET=test-secret-do-not-use-in-production
LOG_LEVEL=info
```

---

### 🏢 Enterprise Configuration (MAXIMUM SECURITY)

**Use Case**: Enterprise deployment with strict security requirements  
**Network Exposure**: Fully hardened for hostile networks

```bash
# .env.enterprise
# Authentication - MANDATORY
ENABLE_AUTH=true
AUTH_REQUIRED=true
ALLOW_LOCAL_BYPASS=false
JWT_SECRET=<enterprise-key-management-system>

# Aggressive Rate Limiting
ENABLE_RATE_LIMIT=true
RATE_LIMIT_PER_MIN=30

# Full CSRF Protection
ENABLE_CSRF=true
CSRF_SECRET=<enterprise-key-management-system>

# IP Whitelisting - REQUIRED
ENABLE_IP_WHITELIST=true
ALLOWED_IPS=10.0.0.0/8

# Strict CORS
ALLOWED_ORIGINS=https://internal.enterprise.com

# Maximum Logging
ENABLE_REQUEST_LOG=true
LOG_LEVEL=info

# Cloudflare Tunnel (recommended)
ENABLE_CLOUDFLARE_TUNNELS=true
CLOUDFLARE_API_TOKEN=<token>
```

---

## Security Checklist

### Before Production Deployment

- [ ] **Authentication enabled**: `ENABLE_AUTH=true`
- [ ] **Auth required**: `AUTH_REQUIRED=true`
- [ ] **Local bypass disabled**: `ALLOW_LOCAL_BYPASS=false`
- [ ] **JWT secret set**: Strong random 256-bit key
- [ ] **CSRF enabled**: `ENABLE_CSRF=true`
- [ ] **CSRF secret set**: Strong random 256-bit key
- [ ] **CORS restricted**: No wildcards (`*`)
- [ ] **Rate limiting enabled**: `ENABLE_RATE_LIMIT=true`
- [ ] **Rate limits tuned**: Appropriate for your use case
- [ ] **Logging enabled**: `ENABLE_REQUEST_LOG=true`
- [ ] **Log level set**: `warn` or `error` for production
- [ ] **IP whitelisting configured**: If required by your environment
- [ ] **HTTPS enabled**: Reverse proxy with valid SSL certificate
- [ ] **Secrets secured**: Never commit to version control
- [ ] **Firewall configured**: Block unnecessary ports
- [ ] **Updates automated**: Security patch monitoring

---

## Best Practices

### 1. Secret Management

**❌ DON'T:**
```bash
# Committed to git
JWT_SECRET=my-secret-key
```

**✅ DO:**
```bash
# Load from secure vault
JWT_SECRET=$(aws secretsmanager get-secret-value --secret-id prod/jwt)

# Or use environment injection
docker run -e JWT_SECRET="$JWT_SECRET" tunnelforge
```

### 2. Network Segmentation

**Development:**
- Bind to `127.0.0.1` only
- Use firewall to block external access

**Production:**
- Place behind reverse proxy (nginx, Caddy)
- Use Cloudflare Tunnel or VPN
- Enable IP whitelisting if possible

### 3. Token Rotation

- Rotate JWT secrets quarterly
- Rotate CSRF secrets quarterly
- Invalidate all tokens on secret rotation
- Monitor for suspicious token usage

### 4. Rate Limiting Strategy

**Public API:**
- `RATE_LIMIT_PER_MIN=30-60`

**Internal API:**
- `RATE_LIMIT_PER_MIN=100-200`

**Development:**
- `RATE_LIMIT_PER_MIN=unlimited` (or high value)

### 5. Logging & Monitoring

**Production:**
```bash
ENABLE_REQUEST_LOG=true
LOG_LEVEL=warn
```

**Monitor for:**
- Repeated authentication failures
- Rate limit violations
- Unusual access patterns
- Token validation errors

### 6. HTTPS/TLS

**Never run production without HTTPS:**

```nginx
# nginx reverse proxy
server {
    listen 443 ssl http2;
    server_name tunnelforge.example.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://127.0.0.1:4021;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Troubleshooting

### Authentication Not Working

**Problem**: Getting 401 Unauthorized errors

**Check:**
1. `ENABLE_AUTH=true` and `AUTH_REQUIRED=true`
2. JWT token is being sent in `Authorization` header
3. Token format: `Bearer <token>`
4. Token hasn't expired (24h default)
5. JWT_SECRET matches between token generation and validation

### Local Bypass Not Working

**Problem**: Localhost requests being denied

**Check:**
1. `ALLOW_LOCAL_BYPASS=true`
2. Request includes `X-TunnelForge-Local: true` header
3. Request is coming from `127.0.0.1` or `::1`
4. Not being proxied through external IP

### Rate Limiting Too Aggressive

**Problem**: Legitimate requests being rate limited

**Solutions:**
1. Increase `RATE_LIMIT_PER_MIN`
2. Implement token bucket algorithm (future)
3. Whitelist specific IPs
4. Use authenticated sessions (higher limits)

### CSRF Errors

**Problem**: Getting 403 CSRF validation failed

**Check:**
1. Frontend is fetching and including CSRF token
2. `CSRF_SECRET` is set and consistent
3. Cookies are enabled and being sent
4. SameSite cookie policy is appropriate

### CORS Errors

**Problem**: Browser blocking requests

**Check:**
1. `ALLOWED_ORIGINS` includes your frontend domain
2. Protocol matches (http vs https)
3. Port is included if non-standard
4. Credentials mode matches configuration

---

## Security Incident Response

### If You Suspect a Breach

1. **Immediately rotate all secrets:**
   ```bash
   JWT_SECRET=<new-secret> CSRF_SECRET=<new-secret> restart
   ```

2. **Review logs:**
   ```bash
   grep "401\|403\|429" /var/log/tunnelforge/access.log
   ```

3. **Enable IP whitelisting:**
   ```bash
   ENABLE_IP_WHITELIST=true ALLOWED_IPS=<trusted-ips>
   ```

4. **Increase logging:**
   ```bash
   LOG_LEVEL=debug
   ```

5. **Notify users** if credentials may be compromised

---

## Additional Resources

- **JWT Best Practices**: https://tools.ietf.org/html/rfc8725
- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **Rate Limiting Strategies**: https://cloud.google.com/architecture/rate-limiting-strategies
- **CSRF Protection**: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html

---

## Support

For security issues, please email: **security@tunnelforge.dev**  
For general questions: **support@tunnelforge.dev**

**Please do NOT disclose security vulnerabilities publicly.**
