# Environment configuration
variable "environment" {
  description = "Deployment environment (dev/staging/prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# Region configuration
variable "aws_region" {
  description = "AWS region for primary deployment (optimized for Israeli market)"
  type        = string
  default     = "me-south-1" # Middle East (Bahrain) region for optimal latency to Israel
  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-[0-9]{1}$", var.aws_region))
    error_message = "AWS region must be a valid region identifier."
  }
}

# Network configuration
variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block."
  }
}

variable "availability_zones" {
  description = "List of AWS availability zones for high-availability deployment"
  type        = list(string)
  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least 2 availability zones must be specified for high availability."
  }
}

# Domain configuration
variable "domain_name" {
  description = "Primary domain name for the application"
  type        = string
  validation {
    condition     = can(regex("^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\\.[a-zA-Z]{2,}$", var.domain_name))
    error_message = "Domain name must be a valid fully qualified domain name."
  }
}

# Security configuration
variable "enable_waf" {
  description = "Enable AWS WAF protection"
  type        = bool
  default     = true
}

variable "waf_rules" {
  description = "Configuration for WAF rules including rate limiting and security controls"
  type        = map(any)
  default = {
    ip_rate_limit = {
      limit = 2000
      time_window = 300
    }
    geo_match = {
      blacklisted_countries = []
      default_action       = "allow"
    }
    sql_injection_protection = true
    xss_protection          = true
  }
}

# Monitoring configuration
variable "container_insights" {
  description = "Enable ECS container insights for enhanced monitoring"
  type        = bool
  default     = true
}

# Database configuration
variable "mongodb_instance_type" {
  description = "Instance type for MongoDB servers"
  type        = string
  default     = "r5.large"
  validation {
    condition     = can(regex("^[a-z][0-9][.][a-z]+$", var.mongodb_instance_type))
    error_message = "MongoDB instance type must be a valid AWS instance type."
  }
}

variable "redis_node_type" {
  description = "Node type for Redis cache cluster"
  type        = string
  default     = "cache.t3.medium"
  validation {
    condition     = can(regex("^cache[.][a-z0-9]+[.][a-z]+$", var.redis_node_type))
    error_message = "Redis node type must be a valid AWS ElastiCache node type."
  }
}

# Backup configuration
variable "backup_retention_days" {
  description = "Number of days to retain database backups"
  type        = number
  default     = 30
  validation {
    condition     = var.backup_retention_days >= 7
    error_message = "Backup retention must be at least 7 days for compliance requirements."
  }
}

# Encryption configuration
variable "enable_encryption" {
  description = "Enable encryption for data at rest using AWS KMS"
  type        = bool
  default     = true
}

# Resource tagging
variable "tags" {
  description = "Additional resource tags for tracking and compliance"
  type        = map(string)
  default = {
    Project     = "Jewish Association Donation Platform"
    Compliance  = "PCI-DSS"
    DataPrivacy = "GDPR"
  }
  validation {
    condition     = length(var.tags) > 0
    error_message = "At least one tag must be specified for resource tracking."
  }
}

# High Availability configuration
variable "min_capacity" {
  description = "Minimum number of instances in auto-scaling group"
  type        = number
  default     = 2
  validation {
    condition     = var.min_capacity >= 2
    error_message = "Minimum capacity must be at least 2 for high availability."
  }
}

variable "max_capacity" {
  description = "Maximum number of instances in auto-scaling group"
  type        = number
  default     = 10
  validation {
    condition     = var.max_capacity >= var.min_capacity
    error_message = "Maximum capacity must be greater than or equal to minimum capacity."
  }
}

# SSL/TLS configuration
variable "ssl_certificate_arn" {
  description = "ARN of SSL/TLS certificate in AWS Certificate Manager"
  type        = string
  validation {
    condition     = can(regex("^arn:aws:acm:", var.ssl_certificate_arn))
    error_message = "SSL certificate ARN must be a valid ACM certificate ARN."
  }
}