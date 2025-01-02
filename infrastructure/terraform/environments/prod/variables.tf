# Production environment identifier
variable "environment" {
  description = "Production environment identifier"
  type        = string
  default     = "prod"
  validation {
    condition     = var.environment == "prod"
    error_message = "Environment must be 'prod' for production environment."
  }
}

# Primary AWS region configuration
variable "aws_region" {
  description = "Primary AWS region for production deployment"
  type        = string
  default     = "me-south-1" # Middle East (Bahrain) for optimal Israeli market latency
  validation {
    condition     = contains(["me-south-1", "eu-west-1", "us-east-1"], var.aws_region)
    error_message = "Production region must be one of: me-south-1 (Bahrain), eu-west-1 (Ireland), us-east-1 (N. Virginia)."
  }
}

# Secondary regions for disaster recovery and global distribution
variable "secondary_regions" {
  description = "Secondary AWS regions for disaster recovery and global distribution"
  type        = list(string)
  default     = ["eu-west-1", "us-east-1"]
  validation {
    condition     = length(var.secondary_regions) >= 1
    error_message = "At least one secondary region must be specified for disaster recovery."
  }
}

# Production VPC configuration
variable "vpc_cidr" {
  description = "Production VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0)) && split("/", var.vpc_cidr)[1] <= "16"
    error_message = "Production VPC CIDR must be a valid IPv4 CIDR block with mask /16 or larger."
  }
}

# High availability configuration
variable "availability_zones" {
  description = "List of AWS availability zones for production deployment"
  type        = list(string)
  validation {
    condition     = length(var.availability_zones) >= 3
    error_message = "Production environment requires at least 3 availability zones for high availability."
  }
}

# Domain configuration
variable "domain_name" {
  description = "Production domain name"
  type        = string
  validation {
    condition     = can(regex("^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\\.[a-zA-Z]{2,}$", var.domain_name))
    error_message = "Domain name must be a valid fully qualified domain name."
  }
}

# Security configurations
variable "enable_waf" {
  description = "Enable AWS WAF protection for production"
  type        = bool
  default     = true
  validation {
    condition     = var.enable_waf == true
    error_message = "WAF must be enabled in production environment."
  }
}

variable "waf_rule_groups" {
  description = "WAF rule groups for production environment"
  type        = list(string)
  default     = ["AWSManagedRulesCommonRuleSet", "AWSManagedRulesKnownBadInputsRuleSet", "AWSManagedRulesSQLiRuleSet"]
}

variable "enable_shield" {
  description = "Enable AWS Shield Advanced for DDoS protection"
  type        = bool
  default     = true
  validation {
    condition     = var.enable_shield == true
    error_message = "AWS Shield Advanced must be enabled in production environment."
  }
}

variable "enable_guardduty" {
  description = "Enable AWS GuardDuty for threat detection"
  type        = bool
  default     = true
  validation {
    condition     = var.enable_guardduty == true
    error_message = "GuardDuty must be enabled in production environment."
  }
}

# Monitoring configuration
variable "container_insights" {
  description = "Enable ECS container insights for production monitoring"
  type        = bool
  default     = true
  validation {
    condition     = var.container_insights == true
    error_message = "Container insights must be enabled in production environment."
  }
}

# Database configuration
variable "mongodb_instance_type" {
  description = "MongoDB Atlas instance type for production"
  type        = string
  default     = "M40"
  validation {
    condition     = can(regex("^M(30|40|50|60|80)", var.mongodb_instance_type))
    error_message = "Production MongoDB instance type must be M30 or larger for adequate performance."
  }
}

variable "redis_node_type" {
  description = "Redis node type for production cache cluster"
  type        = string
  default     = "cache.r6g.xlarge"
  validation {
    condition     = can(regex("^cache[.]r[456]g[.](large|xlarge|2xlarge)", var.redis_node_type))
    error_message = "Production Redis node type must be r4g.large or larger for adequate performance."
  }
}

# Scaling configuration
variable "api_min_capacity" {
  description = "Minimum API task count for high availability"
  type        = number
  default     = 3
  validation {
    condition     = var.api_min_capacity >= 3
    error_message = "Production environment requires minimum of 3 API tasks for high availability."
  }
}

variable "api_max_capacity" {
  description = "Maximum API task count for scalability"
  type        = number
  default     = 20
  validation {
    condition     = var.api_max_capacity >= var.api_min_capacity && var.api_max_capacity <= 50
    error_message = "Maximum capacity must be between minimum capacity and 50 tasks."
  }
}

# Backup configuration
variable "backup_retention_days" {
  description = "Number of days to retain backups in production"
  type        = number
  default     = 90
  validation {
    condition     = var.backup_retention_days >= 90
    error_message = "Production backup retention must be at least 90 days for compliance requirements."
  }
}

# Resource tagging
variable "tags" {
  description = "Production resource tags for compliance and cost allocation"
  type        = map(string)
  default = {
    Environment  = "production"
    Project      = "Jewish Association Donation Platform"
    Compliance   = "PCI-DSS"
    DataPrivacy  = "GDPR"
    CostCenter   = "PROD-001"
    BackupPolicy = "90-days"
  }
  validation {
    condition     = contains(keys(var.tags), "Compliance") && contains(keys(var.tags), "DataPrivacy")
    error_message = "Production tags must include Compliance and DataPrivacy tags."
  }
}