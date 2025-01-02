# Environment Configuration
environment = "dev"
aws_region = "us-east-1"
vpc_cidr   = "10.0.0.0/16"

# Availability Zones Configuration
availability_zones = [
  "us-east-1a",
  "us-east-1b"
]

# Domain Configuration
domain_name = "dev.ijap.org"

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
monitoring_retention_days = 30

# Database Configuration
mongodb_instance_type = "t3.medium"  # Development-appropriate instance size
redis_node_type      = "cache.t3.micro"  # Development-appropriate cache size

# High Availability Configuration
min_capacity = 2
max_capacity = 4

# Resource Tags
tags = {
  Environment       = "Development"
  Project          = "IJAP"
  ManagedBy        = "Terraform"
  SecurityLevel    = "Enhanced"
  MonitoringEnabled = "True"
  BackupRetention  = "30Days"
  CostCenter       = "DevOps"
  DataClassification = "Sensitive"
}

# Backup Configuration
backup_retention_days = 30

# Encryption Configuration
enable_encryption = true

# SSL/TLS Configuration
ssl_certificate_arn = "arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERTIFICATE_ID"

# Development-specific overrides
enable_detailed_monitoring = true
enable_debug_logging      = true
development_access_ips    = ["10.0.0.0/24"]  # Development team VPN CIDR