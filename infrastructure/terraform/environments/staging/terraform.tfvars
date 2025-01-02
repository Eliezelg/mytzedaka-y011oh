# AWS Region Configuration - EU region for global reach with Israel proximity
aws_region = "eu-west-1"

# VPC Configuration - Staging-specific network range
vpc_cidr = "10.1.0.0/16"

# High Availability Configuration - Multi-AZ deployment
availability_zones = [
  "eu-west-1a",
  "eu-west-1b",
  "eu-west-1c"
]

# Domain Configuration - Staging environment subdomain
domain_name = "staging.ijap.org"

# Database Configuration - Staging-appropriate instance sizing
mongodb_instance_type = "db.t3.medium"
redis_node_type      = "cache.t3.medium"

# Monitoring Configuration - Staging retention periods
monitoring_retention_days = 30
log_retention_days       = 30
backup_retention_days    = 7

# ECS Task Configuration - Optimized for staging workloads
ecs_task_cpu    = 256
ecs_task_memory = 512

# Auto Scaling Configuration - Cost-effective scaling limits
min_capacity = 1
max_capacity = 4

# Environment Tag
environment = "staging"

# Monitoring Features - Comprehensive monitoring for staging
enable_performance_insights  = true
enable_enhanced_monitoring  = true