# Provider configuration for MongoDB Atlas and AWS
terraform {
  required_providers {
    mongodbatlas = {
      source  = "mongodb/mongodbatlas"
      version = "~> 1.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# MongoDB Atlas Cluster Configuration
resource "mongodbatlas_cluster" "main" {
  project_id   = var.mongodb_project_id
  name         = var.mongodb_cluster_name
  cluster_type = "REPLICASET"
  
  # MongoDB version and provider settings
  mongo_db_major_version = "6.0"
  provider_name         = "AWS"
  provider_instance_size_name = var.mongodb_instance_size
  provider_region_name  = "EU_CENTRAL_1"

  # Backup configuration for compliance
  backup_enabled = true
  pit_enabled    = true
  provider_backup_enabled = true
  
  # Storage and performance configuration
  provider_disk_iops = 3000
  provider_volume_type = "PROVISIONED"
  
  # Encryption configuration
  provider_encrypt_ebs_volume = true
  encryption_at_rest_provider = "AWS"
  encryption_key_id = var.mongodb_encryption_key_id

  # Replication configuration for high availability
  replication_specs {
    num_shards = 1
    regions_config {
      region_name     = "EU_CENTRAL_1"
      electable_nodes = 3
      priority        = 7
      read_only_nodes = 1
    }
    regions_config {
      region_name     = "EU_WEST_1"
      electable_nodes = 2
      priority        = 6
      read_only_nodes = 1
    }
  }

  # Advanced security configuration
  advanced_configuration {
    javascript_enabled           = false
    minimum_enabled_tls_protocol = "TLS1_2"
    no_table_scan              = false
    oplog_size_mb             = 2048
    sample_size_bi_connector  = 5000
  }

  tags = var.tags
}

# Redis ElastiCache Parameter Group
resource "aws_elasticache_parameter_group" "redis_params" {
  family = "redis6.x"
  name   = "${var.redis_cluster_name}-params"
  
  parameter {
    name  = "maxmemory-policy"
    value = "volatile-lru"
  }
  
  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"
  }

  tags = var.tags
}

# Redis ElastiCache Subnet Group
resource "aws_elasticache_subnet_group" "redis_subnet_group" {
  name       = "${var.redis_cluster_name}-subnet-group"
  subnet_ids = data.aws_vpc.selected.subnet_ids

  tags = var.tags
}

# Redis ElastiCache Replication Group
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id          = var.redis_cluster_name
  replication_group_description = "Redis cluster for International Jewish Association Donation Platform"
  
  # Engine configuration
  engine               = "redis"
  engine_version       = "6.x"
  port                = 6379
  node_type           = var.redis_node_type
  num_cache_clusters  = var.redis_num_cache_nodes
  
  # Network configuration
  subnet_group_name    = aws_elasticache_subnet_group.redis_subnet_group.name
  security_group_ids   = [data.aws_vpc.selected.security_group_ids]
  
  # Parameter and maintenance configuration
  parameter_group_name = aws_elasticache_parameter_group.redis_params.name
  maintenance_window   = "mon:10:00-mon:14:00"
  snapshot_window     = "05:00-09:00"
  
  # Backup configuration
  snapshot_retention_limit = var.redis_snapshot_retention_limit
  auto_minor_version_upgrade = true
  
  # Security configuration
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  
  # High availability configuration
  automatic_failover_enabled = true
  multi_az_enabled          = true
  
  tags = var.tags
}

# Outputs for database connections
output "mongodb_connection_strings" {
  description = "MongoDB Atlas cluster connection strings"
  value       = mongodbatlas_cluster.main.connection_strings
  sensitive   = true
}

output "mongodb_cluster_id" {
  description = "MongoDB Atlas cluster identifier"
  value       = mongodbatlas_cluster.main.cluster_id
}

output "redis_primary_endpoint" {
  description = "Redis ElastiCache primary endpoint address"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive   = true
}

output "redis_reader_endpoint" {
  description = "Redis ElastiCache reader endpoint address"
  value       = aws_elasticache_replication_group.redis.reader_endpoint_address
  sensitive   = true
}