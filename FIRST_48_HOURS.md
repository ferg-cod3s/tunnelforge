# Phase 5: First 48 Hours Action Plan
**Date**: 2025-10-18 (Friday)  
**Goal**: Get infrastructure and monitoring provisioned so we can deploy to staging  
**Success Criteria**: By Sunday EOD, deployment to staging should be possible

---

## 📋 Hour-by-Hour Breakdown

### HOUR 1 (NOW - Team Kickoff)
**Duration**: 15-30 minutes  
**Participants**: All team leads

**Actions**:
1. [ ] Review this document and PHASE_5_EXECUTION_PLAN.md
2. [ ] Assign team members (copy table below and fill in names)
3. [ ] Confirm communication channels (Slack, Discord, GitHub)
4. [ ] Identify blocker decisions needed from stakeholders

**Decision Required Now**:
- [ ] Cloud Provider: **AWS** / GCP / Azure / Self-hosted?
- [ ] Database: **PostgreSQL on RDS** / Aurora / Self-managed?
- [ ] Monitoring: **CloudWatch** / Prometheus+Grafana / DataDog?
- [ ] Budget approval: **$5,000** for infrastructure?

**If Approved**: Proceed to Hour 2  
**If Not**: Schedule stakeholder call immediately

---

### HOURS 2-3 (Today 10 AM - Infrastructure Kickoff)
**Duration**: 2 hours  
**Owner**: DevOps Lead  
**Objective**: Infrastructure code written and provisioned

**Tasks**:
1. [ ] **Choose Infrastructure-as-Code Tool**
   - Option A: Terraform (recommended)
   - Option B: CloudFormation (AWS native)
   - Option C: Docker Compose (simpler, less robust)

2. [ ] **Create IaC Repository** (if using Terraform)
   ```bash
   # Quick start
   git init infrastructure-as-code
   cd infrastructure-as-code
   
   # Create main.tf for VPC, RDS, ElastiCache, ALB, etc.
   touch main.tf variables.tf outputs.tf terraform.tfvars
   
   # Initialize Terraform
   terraform init
   ```

3. [ ] **Plan Infrastructure**
   ```
   Required Resources:
   - VPC with public/private subnets (2 AZs for HA)
   - RDS PostgreSQL (t3.medium, 100GB storage, multi-AZ)
   - ElastiCache Redis (t3.micro, single node OK for beta)
   - Application Load Balancer (with HTTPS)
   - ECS Cluster for app (or EC2 instances)
   - Security Groups (SSH, HTTP, HTTPS, internal)
   - CloudFront CDN (optional, for static assets)
   - Estimated Cost: $300-500/month for beta scale
   ```

4. [ ] **Provision Infrastructure**
   ```bash
   # Commands
   terraform plan
   terraform apply
   
   # Save outputs
   terraform output > infrastructure-outputs.txt
   ```

5. [ ] **Verify Access**
   - [ ] SSH to bastion host
   - [ ] Connect to RDS
   - [ ] Test ALB
   - [ ] Verify security groups

**Success Criteria**:
- ✅ Infrastructure code committed
- ✅ Resources provisioned in AWS
- ✅ Can SSH to app servers
- ✅ Database is accessible
- ✅ Load balancer responds
- ✅ Estimated costs approved

---

### HOURS 4-5 (Today 1-3 PM - Monitoring Setup)
**Duration**: 2 hours  
**Owner**: Platform/DevOps Engineer  
**Objective**: Monitoring pipeline operational

**Quick Monitoring Setup**:

1. [ ] **CloudWatch Metrics** (AWS native, immediate)
   ```
   Enable:
   - ALB request count & latency
   - RDS CPU, connections, storage
   - ECS CPU & memory
   - Application error rates
   - Log groups for centralized logging
   ```

2. [ ] **Sentry Setup** (error tracking)
   ```bash
   # Create account: https://sentry.io
   
   # Get DSN, add to server config:
   SENTRY_DSN=https://xxx@sentry.io/1234
   
   # Test:
   curl -X POST http://localhost:4021/api/health
   ```

3. [ ] **Grafana Dashboard** (optional but nice)
   ```
   Option A: CloudWatch Dashboards (free, native)
   Option B: Install Grafana (30 min setup)
   Option C: Datadog trial (7 days free)
   
   Recommended for Week 1: CloudWatch native
   ```

4. [ ] **Basic Alerting**
   ```
   CloudWatch Alarms:
   - App Error Rate > 5% → PagerDuty/Email
   - Response Time p95 > 200ms → Email
   - RDS CPU > 80% → Email
   - RDS Storage > 90% → Email
   ```

**Success Criteria**:
- ✅ Sentry errors flowing
- ✅ CloudWatch logs visible
- ✅ Alerts configured
- ✅ Dashboard accessible
- ✅ Team can see metrics

---

### HOURS 6-8 (Today 3-5 PM - Deployment Script Setup)
**Duration**: 2-3 hours  
**Owner**: DevOps Lead  
**Objective**: Able to deploy app to staging with one command

**Create Deployment Script**:

1. [ ] **GitHub Actions Workflow** (or manual script)
   ```yaml
   # .github/workflows/deploy-staging.yml
   
   name: Deploy to Staging
   on:
     workflow_dispatch:  # Manual trigger
   
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         
         - name: Build Docker image
           run: |
             docker build -t tunnelforge:${{ github.sha }} .
         
         - name: Push to ECR
           run: |
             aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_REGISTRY
             docker tag tunnelforge:${{ github.sha }} $ECR_REGISTRY/tunnelforge:${{ github.sha }}
             docker push $ECR_REGISTRY/tunnelforge:${{ github.sha }}
         
         - name: Deploy to ECS
           run: |
             aws ecs update-service \
               --cluster staging \
               --service tunnelforge \
               --force-new-deployment
         
         - name: Smoke tests
           run: |
             ./scripts/smoke-tests.sh
   ```

2. [ ] **Create Deployment Runbook**
   ```
   File: DEPLOYMENT_RUNBOOK.md
   
   Sections:
   - Prerequisites checklist
   - Step-by-step deployment
   - Post-deployment validation
   - Rollback procedures
   - Emergency contacts
   ```

3. [ ] **Test Deployment to Staging**
   - [ ] Trigger deployment
   - [ ] Wait for completion (10-15 min)
   - [ ] Verify app is running
   - [ ] Check logs for errors
   - [ ] Run basic health check

**Success Criteria**:
- ✅ Deployment script working
- ✅ App deployed to staging
- ✅ Staging app is accessible
- ✅ Logs are visible
- ✅ Team can deploy

---

### HOURS 9-24 (Today Evening through Tomorrow)
**Duration**: Rest of today + overnight  
**Owner**: Full team  
**Objective**: Ensure infrastructure is stable overnight

**Monitoring Tasks**:
- [ ] Leave monitoring dashboards open
- [ ] Check infrastructure health every 1-2 hours
- [ ] Verify database backups are running
- [ ] Check disk usage on storage volumes
- [ ] Monitor traffic patterns
- [ ] Document any issues

**Parallel: Preparation for Staging Tests**:
- [ ] Create smoke test scripts (can run manually or automated)
- [ ] Set up test data (user accounts, sample terminals)
- [ ] Prepare performance test framework
- [ ] Document all test procedures

---

### DAY 2 (Saturday - Staging Validation)
**Duration**: Full day  
**Owner**: QA Lead, Performance Engineer, Security Engineer  
**Objective**: All systems validated, ready for production deployment

#### Morning (6 hours - Saturday 9 AM-3 PM)

**1. Smoke Tests** (1-2 hours)
```bash
./scripts/smoke-tests.sh

Expected output:
✅ App health check passing
✅ Database connected
✅ Redis cache connected
✅ Authentication working
✅ Create session
✅ Send command to terminal
✅ WebSocket connection
```

**2. Performance Tests** (2-3 hours)
```bash
# Load testing: 500 concurrent users
Artillery quick --count 500 --num 100 http://staging.tunnelforge.com

# Expected results:
# p95 latency: < 100ms
# Error rate: < 0.1%
# Throughput: > 1000 req/s
```

**3. Security Scanning** (1-2 hours)
```bash
# OWASP ZAP scan
docker run -t owasp/zap2docker-stable \
  zap-baseline.py -t https://staging.tunnelforge.com

# Manual checks:
# ✅ HTTPS enabled
# ✅ Security headers present
# ✅ CORS configured correctly
# ✅ SQL injection tests
# ✅ XSS tests
```

**4. Browser Testing** (1-2 hours)
```
✅ Chrome latest
✅ Firefox latest
✅ Safari latest
✅ Edge latest
✅ Mobile (iOS Safari, Chrome Mobile)
```

#### Afternoon (3 hours - Saturday 3-6 PM)

**5. Go/No-Go Review**
```
Decision Matrix:

PASS if:
✅ All smoke tests passing
✅ Performance p95 < 100ms
✅ Error rate < 0.1%
✅ No critical security issues
✅ All browsers working
✅ Monitoring alerts working

FAIL if:
❌ Any smoke test failing
❌ Performance p95 > 200ms
❌ Error rate > 1%
❌ Critical security vulnerability
❌ Major browser broken
```

**6. Document Findings**
- [ ] Create staging test report (STAGING_TEST_REPORT.md)
- [ ] Document any issues found and fixes applied
- [ ] Confirm all fixes verified
- [ ] Get sign-off from QA lead

---

### DAY 3 (Sunday - Production Readiness)
**Duration**: Morning only (3-4 hours)  
**Owner**: Release Manager, DevOps Lead  
**Objective**: Production deployment ready

#### Early Morning (Sunday 8 AM-12 PM)

**1. Production Environment Setup** (1-2 hours)
- [ ] Replicate staging infrastructure to production
- [ ] Verify all resources are available
- [ ] Test backup and restore procedures
- [ ] Verify DNS and SSL ready
- [ ] Load balancer is healthy

**2. Pre-Flight Checks** (1 hour)
- [ ] Code review of any changes since staging
- [ ] Verify all environment variables configured
- [ ] Confirm backup strategy is working
- [ ] Test rollback procedure
- [ ] Brief on-call team

**3. Finalize Deployment Plan** (30 min)
- [ ] Deployment procedure document finalized
- [ ] All team members trained on procedure
- [ ] Communication plan confirmed
- [ ] Incident response procedures reviewed

**Success**: Sunday evening, ready for Monday production deployment

---

## 🎯 Decision Checkpoints

### Checkpoint 1: Hour 1 (Today)
**Stakeholder Decision Needed**:
- Cloud provider choice
- Database approach
- Monitoring tool selection
- Budget approval

**Decision Deadline**: ASAP (can't proceed without this)

### Checkpoint 2: End of Today
**Technical Team Decision**:
- Infrastructure provisioned successfully
- Monitoring pipeline working
- Deployment script ready
- Infrastructure stable overnight

**Decision**: Can we proceed to staging tests tomorrow?

### Checkpoint 3: Saturday Evening
**QA/Security Decision**:
- All tests passing
- No critical issues
- Performance meets targets
- GO/NO-GO for production

### Checkpoint 4: Sunday AM
**Release Manager Decision**:
- Production ready
- Team trained
- Incident procedures ready
- FINAL GO for Monday deployment

---

## 📱 Communication Plan

### Daily Standups (Until Deployment)
- **Time**: 9 AM daily
- **Duration**: 15 minutes
- **Format**: Status, blockers, escalations
- **Location**: Slack #deployment

### Escalation Path
1. **Issue Found**: Report in Slack immediately
2. **Blocker Identified**: Escalate to Release Manager
3. **Decision Needed**: Escalate to Stakeholder within 30 min

### Success Signals
- ✅ Infrastructure code committed
- ✅ Tests passing in staging
- ✅ Performance meets SLA
- ✅ No critical security issues
- ✅ Team confident

---

## ⚠️ Risk Mitigations

### Risk: AWS provisioning takes too long
**Mitigation**: Have backup providers ready
- [ ] Check if we have existing AWS account
- [ ] Have DigitalOcean/Heroku as backup
- **Impact**: Only 2-4 hours delay if switched

### Risk: Database migration issues
**Mitigation**: Database team on standby
- [ ] Test connection pooling
- [ ] Have restore from backup ready
- **Impact**: 1-2 hours to resolve

### Risk: Performance degradation found
**Mitigation**: Caching and optimization ready
- [ ] Redis cache pre-configured
- [ ] Database query optimization scripts ready
- **Impact**: 2-4 hours to optimize

### Risk: Security vulnerabilities found
**Mitigation**: Patches and workarounds ready
- [ ] Security team on call
- [ ] Common vulnerabilities documented
- **Impact**: 1-2 hours to patch

---

## 📊 Success Metrics

### By End of Today (Saturday)
- ✅ Infrastructure provisioned
- ✅ Deployment script ready
- ✅ Staging tests passing
- ✅ Performance baseline established

### By End of Tomorrow (Sunday)
- ✅ Production ready
- ✅ Team trained
- ✅ Deployment plan finalized
- ✅ GO/NO-GO decision made

### By Monday
- ✅ Production deployed
- ✅ Beta release live
- ✅ Monitoring shows healthy metrics
- ✅ Initial users testing

---

## 🚀 Next Steps

### RIGHT NOW (Before You Leave Today)
1. [ ] Review this document
2. [ ] Make stakeholder decisions
3. [ ] Assign team members
4. [ ] Start infrastructure provisioning
5. [ ] Commit this document to git

### BY END OF WORKDAY TODAY
1. [ ] Infrastructure provisioned
2. [ ] Monitoring pipeline working
3. [ ] Deployment script tested
4. [ ] First automated tests running

### BY SUNDAY EVENING
1. [ ] Production ready
2. [ ] Team trained
3. [ ] GO/NO-GO decision made
4. [ ] Monday deployment confirmed

---

**Current Time**: 2025-10-18 Friday  
**Beta Release Target**: 2025-10-24 Friday (6 days away)  
**Confidence**: 97%

**Status**: 🔴 EXECUTION PHASE - STARTING NOW

---

*This is a tactical, time-boxed plan. Do not deviate without explicit approval.*
