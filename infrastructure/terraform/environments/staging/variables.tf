# AWS Region Configuration
variable "aws_region" {
  description = "AWS region for staging environment deployment"
  type        = string
  default     = "us-east-1"

  validation {
    condition     = can(regex("^(us|eu|ap|me|il)-(east|west|central|south|north|southeast|northeast)-[1-3]$", var.aws_region))
    error_message = "AWS region must be a valid region identifier (e.g., us-east-1, eu-west-1, il-central-1)."
  }
}

# VPC Configuration
variable "vpc_cidr" {
  description = "CIDR block for staging VPC"
  type        = string
  default     = "10.1.0.0/16"  # Staging-specific CIDR range

  validation {
    condition     = can(regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}/[0-9]{1,2}$", var.vpc_cidr))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block."
  }
}

# Availability Zones Configuration
variable "availability_zones" {
  description = "List of AWS availability zones for high availability in staging"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]  # Minimum 2 AZs for staging HA

  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least 2 availability zones are required for high availability in staging."
  }
}

# Domain Configuration
variable "domain_name" {
  description = "Domain name for staging environment"
  type        = string
  default     = "staging.jewishdonations.org"

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-.]*(staging|dev|test)[a-z0-9-.]*\\.[a-z]{2,}$", var.domain_name))
    error_message = "Domain name must be a valid staging domain format and include 'staging', 'dev', or 'test'."
  }
}

# MongoDB Configuration
variable "mongodb_instance_type" {
  description = "Instance type for MongoDB servers in staging"
  type        = string
  default     = "db.t3.medium"  # Staging-appropriate size

  validation {
    condition     = can(regex("^db\\.(t3|t4g|m5|m6g)\\.(medium|large)$", var.mongodb_instance_type))
    error_message = "MongoDB instance type must be a valid staging-appropriate instance type."
  }
}

# Redis Configuration
variable "redis_node_type" {
  description = "Node type for Redis cache cluster in staging"
  type        = string
  default     = "cache.t3.medium"  # Staging-appropriate size

  validation {
    condition     = can(regex("^cache\\.(t3|t4g)\\.(micro|small|medium)$", var.redis_node_type))
    error_message = "Redis node type must be a valid staging-appropriate cache node type."
  }
}

# Monitoring Configuration
variable "monitoring_retention_days" {
  description = "Number of days to retain monitoring data in staging"
  type        = number
  default     = 30  # Staging retention period

  validation {
    condition     = var.monitoring_retention_days >= 7 && var.monitoring_retention_days <= 90
    error_message = "Monitoring retention days must be between 7 and 90 days for staging environment."
  }
}

# ECS Task Configuration
variable "ecs_task_cpu" {
  description = "CPU units for ECS tasks in staging (1 vCPU = 1024 units)"
  type        = number
  default     = 512  # Staging-appropriate CPU allocation

  validation {
    condition     = var.ecs_task_cpu >= 256 && var.ecs_task_cpu <= 1024
    error_message = "ECS task CPU must be between 256 and 1024 units for staging environment."
  }
}

variable "ecs_task_memory" {
  description = "Memory (MiB) for ECS tasks in staging"
  type        = number
  default     = 1024  # Staging-appropriate memory allocation

  validation {
    condition     = var.ecs_task_memory >= 512 && var.ecs_task_memory <= 2048
    error_message = "ECS task memory must be between 512 and 2048 MiB for staging environment."
  }
}

# Auto Scaling Configuration
variable "min_capacity" {
  description = "Minimum number of ECS tasks in staging"
  type        = number
  default     = 1  # Minimum tasks for staging

  validation {
    condition     = var.min_capacity >= 1 && var.min_capacity <= 5
    error_message = "Minimum capacity must be between 1 and 5 tasks for staging environment."
  }
}

variable "max_capacity" {
  description = "Maximum number of ECS tasks in staging"
  type        = number
  default     = 5  # Maximum tasks for staging cost control

  validation {
    condition     = var.max_capacity >= 2 && var.max_capacity <= 10
    error_message = "Maximum capacity must be between 2 and 10 tasks for staging environment."
  }
}