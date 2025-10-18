# Infrastructure Provisioning Runbook

**Purpose**: Step-by-step guide for provisioning TunnelForge infrastructure on AWS  
**Target**: Post-stakeholder approval execution (within 6-10 hours)  
**Audience**: DevOps Lead, Backend Lead  
**Duration**: 6-10 hours (depending on parallelization)

---

## 🔍 Pre-Flight Checklist (30 minutes)

### Prerequisites
- [ ] AWS account created and verified
- [ ] AWS CLI installed locally (`aws --version`)
- [ ] Terraform installed (`terraform --version` ≥ v1.5.0)
- [ ] AWS credentials configured (`aws sts get-caller-identity` succeeds)
- [ ] GitHub personal access token ready (for GitHub Actions)
- [ ] Domain name registered (for SSL certificates)
- [ ] Budget approved ($5,000+)
- [ ] All 5 stakeholder decisions finalized

### Configuration Files Ready
- [ ] `terraform-template.tf` reviewed and customized
- [ ] `terraform.tfvars` with custom values created
- [ ] `docker-compose-beta.yml` for backup plan ready
- [ ] `nginx.conf` reviewed for SSL settings
- [ ] `deploy.sh` reviewed for environment specifics

### Access & Permissions
- [ ] AWS IAM user has required permissions (EC2, RDS, VPC, IAM, CloudWatch)
- [ ] GitHub organization access confirmed
- [ ] Container registry access configured (ECR or Docker Hub)
- [ ] Slack webhook ready (for notifications)

---

## ⏱️ Phase 1: AWS VPC & Networking (45 minutes)

### Step 1.1: Initialize Terraform (5 min)

```bash
cd infrastructure/terraform
terraform init
# Expected output: Terraform has been successfully initialized!
```

**Verify**: Check `.terraform` directory exists

### Step 1.2: Customize Terraform Variables (10 min)

Create `terraform.tfvars`:

```hcl
# terraform.tfvars
aws_region          = "us-east-1"  # Change if needed
environment          = "beta"
app_name             = "tunnelforge"
vpc_cidr             = "10.0.0.0/16"
instance_type        = "t3.medium"
db_instance_class    = "db.t3.small"
db_allocated_storage = 20

# Domain
domain_name = "tunnelforge.example.com"  # Update with actual domain

# Tags
tags = {
  Project     = "TunnelForge"
  Environment = "beta"
  ManagedBy   = "Terraform"
  CreatedAt   = timestamp()
}
```

**Verify**: Run `terraform validate`
```bash
terraform validate
# Expected: Success! The configuration is valid.
```

### Step 1.3: Plan Infrastructure (10 min)

```bash
terraform plan -out=tfplan
# Review output for 50-60 resources to be created
```

**Important**: Review the plan carefully. Look for:
- VPC with 2 public + 2 private subnets ✓
- RDS PostgreSQL database ✓
- ElastiCache Redis ✓
- Application Load Balancer ✓
- Security groups ✓

### Step 1.4: Create Infrastructure (20 min)

```bash
terraform apply tfplan
# Watch progress... should complete in 15-20 minutes

# Capture output
terraform output > ../infrastructure-outputs.json
```

**What's Happening**:
- VPC creation (2 min)
- Subnet creation (1 min)
- Internet Gateway setup (1 min)
- Route table configuration (2 min)
- Security groups (2 min)
- ALB creation (5 min)
- RDS database (5-7 min) ← Longest step
- ElastiCache cluster (3 min)
- IAM roles (2 min)

**Verify Completion**:
```bash
terraform output
# Should show all resource IDs, endpoints, security group IDs
```

**Critical Outputs to Save**:
- `alb_dns_name` → Load balancer endpoint
- `rds_endpoint` → Database connection string
- `redis_endpoint` → Cache endpoint
- `security_group_id` → For application configuration

---

## 🗄️ Phase 2: Database Initialization (30 minutes)

### Step 2.1: Get RDS Endpoint

```bash
RDS_ENDPOINT=$(terraform output -raw rds_endpoint)
echo "RDS Endpoint: $RDS_ENDPOINT"
```

### Step 2.2: Install PostgreSQL Client

```bash
# macOS
brew install postgresql

# Linux
sudo apt-get install postgresql-client

# Verify
psql --version
```

### Step 2.3: Connect to Database

```bash
# Get master username and password from secrets
MASTER_USER="postgres"
MASTER_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id tunnelforge/db/master \
  --query SecretString --output text | jq -r '.password')

# Test connection
psql -h "$RDS_ENDPOINT" -U "$MASTER_USER" -d "postgres" \
  -c "SELECT version();"
```

**Expected**: PostgreSQL version information displays

### Step 2.4: Create Application Database

```bash
# Create database
psql -h "$RDS_ENDPOINT" -U "$MASTER_USER" << 'EOSQL'
CREATE DATABASE tunnelforge_beta;
CREATE USER tunnelforge_app WITH PASSWORD 'GENERATED_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON DATABASE tunnelforge_beta TO tunnelforge_app;
EOSQL

# Verify
psql -h "$RDS_ENDPOINT" -U "$MASTER_USER" -d tunnelforge_beta \
  -c "\dt"  # Should return empty (migrations not run yet)
```

### Step 2.5: Store Credentials in Secrets Manager

```bash
aws secretsmanager create-secret \
  --name tunnelforge/db/app \
  --description "TunnelForge application database credentials" \
  --secret-string '{
    "host": "'$RDS_ENDPOINT'",
    "port": 5432,
    "username": "tunnelforge_app",
    "password": "GENERATED_PASSWORD_HERE",
    "database": "tunnelforge_beta"
  }'
```

**Verify**: Credentials stored in AWS Secrets Manager

---

## 🚀 Phase 3: Docker Image Build & Push (45 minutes)

### Step 3.1: Prepare Docker Image

```bash
cd /path/to/tunnelforge/server

# Build Docker image
docker build -t tunnelforge:latest \
  -t tunnelforge:beta-$(date +%Y%m%d) \
  .

# Verify image
docker images | grep tunnelforge
```

**Expected**: Image size ~200-300MB, tagged with beta date

### Step 3.2: Push to Container Registry

**Option A: Amazon ECR**

```bash
# Create ECR repository
aws ecr create-repository \
  --repository-name tunnelforge \
  --region us-east-1

# Get login token and push
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Tag and push
docker tag tunnelforge:latest \
  ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/tunnelforge:latest

docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/tunnelforge:latest
```

**Option B: Docker Hub**

```bash
# Login
docker login

# Tag
docker tag tunnelforge:latest USERNAME/tunnelforge:latest

# Push
docker push USERNAME/tunnelforge:latest
```

**Verify**: Image appears in registry dashboard

---

## 📊 Phase 4: Monitoring Stack Setup (45 minutes)

### Step 4.1: CloudWatch Dashboard

```bash
# Create dashboard
aws cloudwatch put-dashboard \
  --dashboard-name TunnelForge-Beta \
  --dashboard-body file://cloudwatch-dashboard.json
```

**What to Monitor**:
- ALB request count
- ALB target health
- RDS CPU utilization
- RDS connections
- RDS storage usage
- ElastiCache CPU
- ElastiCache memory

### Step 4.2: CloudWatch Alarms

```bash
# High CPU alarm
aws cloudwatch put-metric-alarm \
  --alarm-name tunnelforge-high-cpu \
  --alarm-description "Alert when CPU exceeds 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/RDS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:ACCOUNT:alert-topic

# Database connection alarm
aws cloudwatch put-metric-alarm \
  --alarm-name tunnelforge-db-connections \
  --alarm-description "Alert when connections exceed 80 of 100" \
  --metric-name DatabaseConnections \
  --namespace AWS/RDS \
  --statistic Average \
  --period 60 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:ACCOUNT:alert-topic
```

### Step 4.3: Sentry Error Tracking

```bash
# Create Sentry project
# 1. Go to https://sentry.io (or self-hosted instance)
# 2. Create new project: "TunnelForge Beta"
# 3. Select platform: "Go"
# 4. Copy DSN

# Save DSN to AWS Secrets Manager
aws secretsmanager create-secret \
  --name tunnelforge/sentry/dsn \
  --secret-string 'https://KEY@sentry.io/PROJECT_ID'
```

### Step 4.4: Log Aggregation

```bash
# Configure CloudWatch Logs agent on EC2 (if using EC2)
# Or configure ECS service to send logs to CloudWatch

# View logs
aws logs create-log-group --log-group-name /tunnelforge/application
aws logs create-log-stream \
  --log-group-name /tunnelforge/application \
  --log-stream-name beta
```

---

## 🔧 Phase 5: Deployment Automation (1 hour)

### Step 5.1: Create GitHub Actions Workflow

Create `.github/workflows/deploy-beta.yml`:

```yaml
name: Deploy to Beta

on:
  push:
    branches: [main]
    paths:
      - 'server/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build and Push Docker
        run: |
          docker build -t tunnelforge:latest server/
          # Push to registry
      
      - name: Deploy to AWS
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        run: |
          # Update ECS service with new image
          aws ecs update-service \
            --cluster tunnelforge-beta \
            --service tunnelforge-api \
            --force-new-deployment
      
      - name: Verify Deployment
        run: |
          # Wait for service to stabilize
          sleep 30
          curl https://tunnelforge.example.com/api/health
```

### Step 5.2: Configure Secrets

```bash
# Add to GitHub repository secrets:
# AWS_ACCESS_KEY_ID
# AWS_SECRET_ACCESS_KEY
# DOCKER_HUB_USERNAME
# DOCKER_HUB_PASSWORD
# SENTRY_DSN
```

### Step 5.3: Test Deployment

```bash
# Manually trigger workflow
gh workflow run deploy-beta.yml

# Monitor
gh run list
gh run view <run-id> --log
```

---

## ✅ Phase 6: Verification & Testing (30 minutes)

### Step 6.1: Health Checks

```bash
# Get ALB endpoint
ALB_DNS=$(terraform output -raw alb_dns_name)

# Test API
curl -I https://$ALB_DNS/api/health

# Expected:
# HTTP/1.1 200 OK
# Content-Type: application/json
# {"status":"ok","uptime":"0m"}
```

### Step 6.2: Database Verification

```bash
# Connect and verify schema
psql -h "$RDS_ENDPOINT" -U tunnelforge_app -d tunnelforge_beta << 'EOSQL'
SELECT * FROM pg_tables WHERE schemaname = 'public';
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';
EOSQL
```

### Step 6.3: Performance Baseline

```bash
# Run load test (low volume)
ab -n 100 -c 10 https://$ALB_DNS/api/health

# Expected: <100ms response time, <2% errors
```

### Step 6.4: Security Verification

```bash
# Check SSL certificate
echo | openssl s_client -connect $(echo $ALB_DNS | cut -d: -f1):443 2>/dev/null | \
  openssl x509 -noout -dates

# Check security headers
curl -I https://$ALB_DNS/api/health | grep -E "X-Frame-Options|X-Content-Type|Strict-Transport"
```

---

## 🎯 Completion Checklist

- [ ] Terraform applied successfully (all resources created)
- [ ] RDS database online and verified
- [ ] ElastiCache Redis online
- [ ] ALB responding to health checks
- [ ] Security groups configured correctly
- [ ] CloudWatch monitoring active
- [ ] Sentry integration confirmed
- [ ] Docker image pushed to registry
- [ ] GitHub Actions workflow ready
- [ ] All credentials stored in AWS Secrets Manager
- [ ] Health check returns 200 OK
- [ ] SSL certificate valid
- [ ] Performance within baseline (<100ms)
- [ ] Documentation updated

---

## 🚨 Troubleshooting

### RDS Connection Failed
```bash
# Check security group
aws ec2 describe-security-groups \
  --group-ids sg-xxxxx \
  --query 'SecurityGroups[0].IpPermissions'

# Verify connectivity
telnet $RDS_ENDPOINT 5432
```

### Docker Push Failed
```bash
# Check ECR login
aws ecr get-login-password --region us-east-1 | docker login ...

# Verify ECR repository exists
aws ecr describe-repositories --repository-names tunnelforge
```

### Health Check Failing
```bash
# Check ALB logs
aws s3 ls s3://tunnelforge-alb-logs/

# Check target group
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:...
```

---

## 📞 Rollback Procedure

If critical issues found:

```bash
# Option 1: Destroy and recreate
terraform destroy -auto-approve
# Fix issues, then re-run

# Option 2: Scale down to minimal
terraform apply -var='instance_count=0'
# Keeps infrastructure, but stops app

# Option 3: Failover to Docker Compose
# Use docker-compose-beta.yml as backup
docker-compose -f docker-compose-beta.yml up -d
```

---

## ✨ Next Steps (After Provisioning Complete)

1. **Database Migrations** → Run server migrations
2. **Staging Deployment** → Deploy to staging environment
3. **Smoke Tests** → Run critical path tests
4. **Load Testing** → Performance validation (500 concurrent)
5. **Security Scanning** → OWASP ZAP scan
6. **Production Promotion** → Deploy to production

---

**Status**: Ready for execution upon stakeholder approval  
**Estimated Duration**: 6-10 hours (with parallelization, 4-6 hours possible)  
**Next Review**: After Phase 1 completion

