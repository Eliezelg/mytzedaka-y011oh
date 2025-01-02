# Development environment-specific variables for the International Jewish Association Donation Platform

# AWS Region Configuration
variable "aws_region" {
  description = "AWS region for development environment deployment"
  type        = string
  default     = "me-south-1" # Middle East (Bahrain) region for Israeli market proximity
  validation {
    condition     = contains(["me-south-1", "eu-west-1", "eu-central-1"], var.aws_region)
    error_message = "Development environment must be deployed in supported regions close to Israeli market."
  }
}

# Network Configuration
variable "vpc_cidr" {
  description = "CIDR block for development VPC"
  type        = string
  default     = "10.10.0.0/16" # Development environment specific CIDR range
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0)) && split(".", var.vpc_cidr)[0] == "10"
    error_message = "Development VPC CIDR must be in the 10.x.x.x range."
  }
}

variable "availability_zones" {
  description = "List of availability zones for development environment"
  type        = list(string)
  default     = ["me-south-1a", "me-south-1b"] # Minimum 2 AZs for development
  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least 2 availability zones required for development environment."
  }
}

# Database Configuration
variable "mongodb_instance_type" {
  description = "Instance type for development MongoDB servers"
  type        = string
  default     = "t3.medium" # Cost-optimized for development
  validation {
    condition     = can(regex("^t3\\.|^t4g\\.", var.mongodb_instance_type))
    error_message = "Development MongoDB must use t3 or t4g instance types for cost optimization."
  }
}

variable "redis_node_type" {
  description = "Node type for development Redis cache cluster"
  type        = string
  default     = "cache.t3.small" # Development-appropriate cache size
  validation {
    condition     = can(regex("^cache\\.t3\\.", var.redis_node_type))
    error_message = "Development Redis must use t3 cache node types."
  }
}

# Monitoring Configuration
variable "container_insights" {
  description = "Enable ECS container insights for development monitoring"
  type        = bool
  default     = true
}

variable "monitoring_retention_days" {
  description = "CloudWatch log retention period for development environment"
  type        = number
  default     = 14 # Extended retention for development troubleshooting
  validation {
    condition     = var.monitoring_retention_days >= 14 && var.monitoring_retention_days <= 30
    error_message = "Development log retention must be between 14 and 30 days."
  }
}

# Security Configuration
variable "enable_waf" {
  description = "Enable WAF protection for development environment"
  type        = bool
  default     = true
}

# Development-specific Configuration
variable "auto_shutdown_schedule" {
  description = "Cron schedule for automatic resource shutdown in development"
  type        = string
  default     = "cron(0 20 ? * MON-FRI *)" # 8 PM shutdown on weekdays
  validation {
    condition     = can(regex("^cron\\(", var.auto_shutdown_schedule))
    error_message = "Auto shutdown schedule must be a valid cron expression."
  }
}

variable "log_level" {
  description = "Logging level for development environment"
  type        = string
  default     = "DEBUG"
  validation {
    condition     = contains(["DEBUG", "INFO", "WARN", "ERROR"], var.log_level)
    error_message = "Log level must be one of: DEBUG, INFO, WARN, ERROR."
  }
}

# Development Tags
variable "environment_tags" {
  description = "Additional tags for development environment resources"
  type        = map(string)
  default = {
    Environment = "development"
    CostCenter  = "dev-ops"
    AutoShutdown = "enabled"
  }
}