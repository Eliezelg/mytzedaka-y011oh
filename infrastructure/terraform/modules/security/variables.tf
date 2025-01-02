# Required variables with validation
variable "environment" {
  description = "Deployment environment (dev/staging/prod) for applying appropriate security controls"
  type        = string
  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be dev, staging, or prod"
  }
}

variable "vpc_id" {
  description = "ID of the VPC where security resources will be created and security groups applied"
  type        = string
  validation {
    condition     = can(regex("^vpc-", var.vpc_id))
    error_message = "VPC ID must be valid AWS VPC identifier"
  }
}

# WAF configuration
variable "waf_configuration" {
  description = "Comprehensive WAF configuration including rules, rate limits, and IP restrictions"
  type = object({
    enabled                = bool
    rate_limit            = number
    block_known_bad_inputs = bool
    sql_injection_protection = bool
    xss_protection         = bool
    ip_rate_based_rule = object({
      limit                = number
      block_period_seconds = number
    })
  })
  default = {
    enabled                = true
    rate_limit            = 2000
    block_known_bad_inputs = true
    sql_injection_protection = true
    xss_protection         = true
    ip_rate_based_rule = {
      limit                = 2000
      block_period_seconds = 300
    }
  }
}

# DDoS protection configuration
variable "ddos_protection" {
  description = "DDoS protection settings including Shield Advanced configuration"
  type = object({
    enable_shield                    = bool
    enable_automatic_response        = bool
    shield_advanced_protection_groups = list(string)
  })
  default = {
    enable_shield                    = true
    enable_automatic_response        = true
    shield_advanced_protection_groups = ["APPLICATION_LAYER", "NETWORK_LAYER"]
  }
}

# KMS configuration
variable "kms_configuration" {
  description = "KMS key configuration for data encryption"
  type = object({
    enable_key_rotation          = bool
    deletion_window_days         = number
    enable_key_admin_permissions = bool
    key_usage                   = string
    customer_master_key_spec    = string
  })
  default = {
    enable_key_rotation          = true
    deletion_window_days         = 30
    enable_key_admin_permissions = false
    key_usage                   = "ENCRYPT_DECRYPT"
    customer_master_key_spec    = "SYMMETRIC_DEFAULT"
  }
  validation {
    condition     = var.kms_configuration.deletion_window_days >= 7 && var.kms_configuration.deletion_window_days <= 30
    error_message = "KMS key deletion window must be between 7 and 30 days"
  }
}

# Security group rules
variable "security_group_rules" {
  description = "List of security group rules for controlling network access"
  type = list(object({
    type        = string
    from_port   = number
    to_port     = number
    protocol    = string
    cidr_blocks = list(string)
    description = string
  }))
  default = []
  validation {
    condition     = alltrue([for rule in var.security_group_rules : contains(["ingress", "egress"], rule.type)])
    error_message = "Security group rules must be either ingress or egress"
  }
}

# SSL/TLS configuration
variable "ssl_configuration" {
  description = "SSL/TLS configuration for secure communications"
  type = object({
    policy                           = string
    certificate_arn                  = string
    enable_http2                     = bool
    enable_cross_zone_load_balancing = bool
  })
  default = {
    policy                           = "ELBSecurityPolicy-TLS13-1-2-2021-06"
    certificate_arn                  = ""
    enable_http2                     = true
    enable_cross_zone_load_balancing = true
  }
}

# IAM boundary policy
variable "iam_boundary_policy" {
  description = "ARN of the IAM permissions boundary to be applied to all created roles"
  type        = string
  default     = ""
}

# Security monitoring configuration
variable "monitoring_configuration" {
  description = "Security monitoring and alerting configuration"
  type = object({
    enable_guardduty    = bool
    enable_security_hub = bool
    enable_config       = bool
    enable_cloudtrail   = bool
    log_retention_days  = number
  })
  default = {
    enable_guardduty    = true
    enable_security_hub = true
    enable_config       = true
    enable_cloudtrail   = true
    log_retention_days  = 365
  }
}