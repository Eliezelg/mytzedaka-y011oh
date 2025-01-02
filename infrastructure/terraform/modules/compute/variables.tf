# Common Variables
variable "environment" {
  type        = string
  description = "Environment name (dev/staging/prod) for resource tagging"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "project_name" {
  type        = string
  description = "Project name for resource tagging and naming"
  default     = "jewish-donation-platform"
}

# Network Configuration
variable "vpc_id" {
  type        = string
  description = "VPC ID for ECS cluster placement"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "Private subnet IDs for container placement"
  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "At least 2 private subnets must be specified for high availability."
  }
}

# Container Images
variable "api_container_image" {
  type        = string
  description = "API service container image URI"
}

variable "web_container_image" {
  type        = string
  description = "Web frontend container image URI"
}

# Service Configuration
variable "api_desired_count" {
  type        = number
  description = "Desired number of API service tasks"
  default     = 2
  validation {
    condition     = var.api_desired_count >= 2
    error_message = "At least 2 API tasks must be specified for high availability."
  }
}

variable "web_desired_count" {
  type        = number
  description = "Desired number of web frontend tasks"
  default     = 2
  validation {
    condition     = var.web_desired_count >= 2
    error_message = "At least 2 web tasks must be specified for high availability."
  }
}

# Resource Allocation
variable "api_cpu" {
  type        = number
  description = "CPU units for API service tasks (1 vCPU = 1024 units)"
  default     = 1024
}

variable "api_memory" {
  type        = number
  description = "Memory allocation for API service tasks in MiB"
  default     = 2048
}

variable "web_cpu" {
  type        = number
  description = "CPU units for web frontend tasks (1 vCPU = 1024 units)"
  default     = 512
}

variable "web_memory" {
  type        = number
  description = "Memory allocation for web frontend tasks in MiB"
  default     = 1024
}

# Monitoring Configuration
variable "enable_container_insights" {
  type        = bool
  description = "Enable CloudWatch Container Insights for monitoring"
  default     = true
}

# Capacity Provider Strategy
variable "capacity_provider_strategy" {
  type = map(object({
    base              = number
    weight           = number
    maximum_scaling  = number
  }))
  description = "ECS capacity provider configuration for FARGATE and FARGATE_SPOT"
  default = {
    FARGATE = {
      base             = 1
      weight          = 60
      maximum_scaling = 300
    }
    FARGATE_SPOT = {
      base             = 0
      weight          = 40
      maximum_scaling = 300
    }
  }
}

# Service Discovery
variable "service_discovery_namespace" {
  type        = string
  description = "Service discovery namespace for container service discovery"
  default     = "internal"
}

variable "health_check_grace_period" {
  type        = number
  description = "Grace period for container health checks in seconds"
  default     = 60
}

# Auto Scaling Configuration
variable "autoscaling_config" {
  type = map(object({
    min_capacity       = number
    max_capacity      = number
    target_cpu_value  = number
    target_mem_value  = number
    scale_in_cooldown = number
    scale_out_cooldown = number
  }))
  description = "Auto-scaling configuration for ECS services"
  default = {
    api = {
      min_capacity       = 2
      max_capacity      = 10
      target_cpu_value  = 70
      target_mem_value  = 80
      scale_in_cooldown = 300
      scale_out_cooldown = 60
    }
    web = {
      min_capacity       = 2
      max_capacity      = 10
      target_cpu_value  = 70
      target_mem_value  = 80
      scale_in_cooldown = 300
      scale_out_cooldown = 60
    }
  }
  validation {
    condition     = alltrue([for k, v in var.autoscaling_config : v.min_capacity >= 2])
    error_message = "Minimum capacity must be at least 2 for high availability."
  }
}