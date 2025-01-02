# Environment Configuration
environment = "prod"
aws_region = "eu-central-1"

# Network Configuration
vpc_cidr = "10.0.0.0/16"
availability_zones = [
  "eu-central-1a",
  "eu-central-1b",
  "eu-central-1c"
]

# Domain Configuration
domain_name = "ijap.org"

# Security Configuration
enable_waf = true
waf_rules = {
  ip_rate_limit = {
    limit       = 2000
    time_window = 300
  }
  geo_match = {
    blacklisted_countries = []
    default_action       = "allow"
  }
  sql_injection_protection = true
  xss_protection          = true
}

# Monitoring Configuration
container_insights = true

# Database Configuration
mongodb_instance_type = "M30"  # MongoDB Atlas instance type for production
redis_node_type      = "cache.r6g.xlarge"
backup_retention_days = 30

# High Availability Configuration
min_capacity = 3
max_capacity = 10

# Encryption Configuration
enable_encryption = true

# Resource Tags
tags = {
  Environment   = "production"
  Project       = "IJAP"
  ManagedBy     = "Terraform"
  Compliance    = "PCI-DSS"
  SecurityLevel = "High"
  BackupPolicy  = "Daily"
  CostCenter    = "PROD-IJAP-001"
  DataPrivacy   = "GDPR"
  Region        = "EU-Central"
  Service       = "Donation-Platform"
}

# SSL/TLS Configuration
ssl_certificate_arn = "arn:aws:acm:eu-central-1:ACCOUNT_ID:certificate/CERTIFICATE_ID"