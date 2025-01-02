# MongoDB Atlas Cluster Outputs
output "mongodb_cluster_id" {
  description = "MongoDB Atlas cluster identifier for infrastructure reference"
  value       = mongodb_cluster.main.cluster_id
}

output "mongodb_connection_string" {
  description = "MongoDB connection string with read preference and replica set configuration"
  value       = mongodb_cluster.main.connection_strings.standard_srv
  sensitive   = true
}

output "mongodb_replica_set" {
  description = "MongoDB replica set name for high availability configuration"
  value       = mongodb_cluster.main.replica_set_name
}

output "mongodb_monitoring_endpoint" {
  description = "MongoDB monitoring endpoint for health checks and metrics collection"
  value       = format("https://cloud.mongodb.com/v2/%s/clusters/%s/metrics", 
                      var.mongodb_project_id,
                      mongodb_cluster.main.cluster_id)
}

# Redis ElastiCache Cluster Outputs
output "redis_cluster_id" {
  description = "Redis ElastiCache cluster identifier for infrastructure reference"
  value       = redis_cluster.redis.id
}

output "redis_primary_endpoint" {
  description = "Redis primary endpoint for write operations"
  value       = redis_cluster.redis.configuration_endpoint
  sensitive   = true
}

output "redis_reader_endpoint" {
  description = "Redis reader endpoint for read operations and load balancing"
  value       = redis_cluster.redis.reader_endpoint_address
  sensitive   = true
}

output "redis_port" {
  description = "Redis cluster port number for connection configuration"
  value       = redis_cluster.redis.port
}

output "redis_monitoring_endpoint" {
  description = "Redis monitoring endpoint for health checks and metrics collection"
  value       = format("https://%s.console.aws.amazon.com/elasticache/home?region=%s#redis-group/%s",
                      data.aws_region.current.name,
                      data.aws_region.current.name,
                      redis_cluster.redis.id)
}

# High Availability Status Outputs
output "mongodb_ha_status" {
  description = "MongoDB high availability configuration status"
  value = {
    replication_factor = length(mongodb_cluster.main.replication_specs[0].regions_config)
    multi_region      = length(mongodb_cluster.main.replication_specs[0].regions_config) > 1
    backup_enabled    = mongodb_cluster.main.backup_enabled
  }
}

output "redis_ha_status" {
  description = "Redis high availability configuration status"
  value = {
    multi_az_enabled         = redis_cluster.redis.multi_az_enabled
    automatic_failover       = redis_cluster.redis.automatic_failover_enabled
    num_cache_nodes         = redis_cluster.redis.num_cache_clusters
    snapshot_retention_days = redis_cluster.redis.snapshot_retention_limit
  }
}

# Security Configuration Outputs
output "mongodb_security_config" {
  description = "MongoDB security configuration status"
  value = {
    tls_enabled             = true
    encryption_at_rest      = mongodb_cluster.main.encryption_at_rest_provider
    min_tls_version        = mongodb_cluster.main.advanced_configuration[0].minimum_enabled_tls_protocol
    javascript_disabled    = !mongodb_cluster.main.advanced_configuration[0].javascript_enabled
  }
}

output "redis_security_config" {
  description = "Redis security configuration status"
  value = {
    transit_encryption     = redis_cluster.redis.transit_encryption_enabled
    at_rest_encryption    = redis_cluster.redis.at_rest_encryption_enabled
    auth_token_enabled    = redis_cluster.redis.auth_token != null
  }
}