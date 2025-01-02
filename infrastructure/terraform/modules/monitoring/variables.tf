# Core Terraform configuration
terraform {
  required_version = ">= 1.0.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
  }
}

# Kubernetes namespace for monitoring components
variable "monitoring_namespace" {
  description = "Kubernetes namespace for monitoring components"
  type        = string
  default     = "monitoring"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.monitoring_namespace))
    error_message = "Namespace must consist of lowercase alphanumeric characters or hyphens"
  }
}

# Environment specification
variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

# Grafana admin credentials
variable "grafana_admin_password" {
  description = "Admin password for Grafana dashboard access"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.grafana_admin_password) >= 16 && can(regex("[A-Z]", var.grafana_admin_password)) && can(regex("[a-z]", var.grafana_admin_password)) && can(regex("[0-9]", var.grafana_admin_password)) && can(regex("[^A-Za-z0-9]", var.grafana_admin_password))
    error_message = "Grafana admin password must be at least 16 characters and include uppercase, lowercase, numbers, and special characters"
  }
}

# Retention periods for monitoring components
variable "prometheus_retention_days" {
  description = "Number of days to retain Prometheus metrics"
  type        = number
  default     = 30

  validation {
    condition     = var.prometheus_retention_days >= 15
    error_message = "Prometheus retention period must be at least 15 days for compliance"
  }
}

variable "elasticsearch_retention_days" {
  description = "Number of days to retain Elasticsearch logs"
  type        = number
  default     = 90

  validation {
    condition     = var.elasticsearch_retention_days >= 30
    error_message = "Elasticsearch retention period must be at least 30 days for audit requirements"
  }
}

variable "jaeger_retention_days" {
  description = "Number of days to retain Jaeger traces"
  type        = number
  default     = 15

  validation {
    condition     = var.jaeger_retention_days >= 7
    error_message = "Jaeger retention period must be at least 7 days for troubleshooting"
  }
}

# Alerting configuration
variable "enable_alerting" {
  description = "Enable Prometheus alerting and AlertManager with PagerDuty integration"
  type        = bool
  default     = true
}

# Infrastructure specifications
variable "monitoring_instance_type" {
  description = "EC2 instance type for monitoring components"
  type        = string
  default     = "m5.xlarge"

  validation {
    condition     = can(regex("^m5\\.(large|xlarge|2xlarge)|^r5\\.(large|xlarge|2xlarge)", var.monitoring_instance_type))
    error_message = "Instance type must be m5 or r5 family with size large, xlarge, or 2xlarge for production workloads"
  }
}

variable "elasticsearch_volume_size" {
  description = "Size in GB for Elasticsearch data volume"
  type        = number
  default     = 500

  validation {
    condition     = var.elasticsearch_volume_size >= 200
    error_message = "Elasticsearch volume size must be at least 200 GB for production workloads"
  }
}

# Grafana configuration
variable "grafana_plugins" {
  description = "List of Grafana plugins to install"
  type        = list(string)
  default = [
    "grafana-piechart-panel",
    "grafana-worldmap-panel",
    "grafana-clock-panel",
    "grafana-polystat-panel",
    "grafana-kubernetes-app"
  ]
}