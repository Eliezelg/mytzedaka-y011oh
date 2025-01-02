# MongoDB Atlas Configuration Variables
variable "mongodb_project_id" {
  type        = string
  description = "MongoDB Atlas project identifier for resource organization and access control"
}

variable "mongodb_cluster_name" {
  type        = string
  description = "Name identifier for the MongoDB Atlas cluster deployment used for the donation platform"
}

variable "mongodb_instance_size" {
  type        = string
  description = "MongoDB Atlas instance size specification supporting horizontal scaling requirements"
  validation {
    condition     = can(regex("^(M10|M20|M30|M40|M50|M60|M80|M140|M200|M300)$", var.mongodb_instance_size))
    error_message = "Instance size must be a valid MongoDB Atlas tier (M10 through M300)."
  }
}

variable "mongodb_backup_retention_days" {
  type        = number
  description = "Retention period in days for MongoDB backups, minimum 7 years (2555 days) for financial data compliance"
  default     = 2555  # 7 years retention for financial data
  validation {
    condition     = var.mongodb_backup_retention_days >= 2555
    error_message = "Backup retention must be at least 2555 days (7 years) for financial data compliance."
  }
}

variable "mongodb_sharding_enabled" {
  type        = bool
  description = "Enable sharding for MongoDB Atlas cluster to support horizontal scaling and data distribution"
  default     = true
}

# Redis ElastiCache Configuration Variables
variable "redis_cluster_name" {
  type        = string
  description = "Name identifier for the Redis ElastiCache cluster used for session management and caching"
}

variable "redis_node_type" {
  type        = string
  description = "Redis ElastiCache node instance type for performance configuration"
  validation {
    condition     = can(regex("^cache\\.[a-z0-9]+\\.(micro|small|medium|large|xlarge|[2-9]?xlarge)$", var.redis_node_type))
    error_message = "Node type must be a valid Redis ElastiCache instance type (e.g., cache.t3.medium)."
  }
}

variable "redis_num_cache_nodes" {
  type        = number
  description = "Number of cache nodes in Redis cluster for horizontal scaling"
  default     = 3
  validation {
    condition     = var.redis_num_cache_nodes >= 2 && var.redis_num_cache_nodes <= 6
    error_message = "Number of cache nodes must be between 2 and 6 for high availability."
  }
}

variable "redis_snapshot_retention_limit" {
  type        = number
  description = "Number of days to retain Redis snapshots for recovery purposes"
  default     = 7
}

variable "redis_multi_az_enabled" {
  type        = bool
  description = "Enable multi-AZ deployment for Redis ElastiCache high availability"
  default     = true
}

# Common Resource Tags
variable "tags" {
  type        = map(string)
  description = "Resource tags for cost allocation and compliance tracking"
  default = {
    Environment = "production"
    Project     = "jewish-donation-platform"
    Terraform   = "true"
  }
}