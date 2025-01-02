# Network Infrastructure Outputs
output "vpc_id" {
  description = "ID of the created VPC for network monitoring and security group configuration"
  value       = module.networking.vpc_id
  sensitive   = false
}

output "vpc_cidr_block" {
  description = "VPC CIDR block for network security group configuration and monitoring"
  value       = module.networking.vpc_cidr_block
  sensitive   = false
}

output "public_subnet_ids" {
  description = "List of public subnet IDs for load balancer and NAT gateway deployment"
  value       = module.networking.public_subnet_ids
  sensitive   = false
}

output "private_subnet_ids" {
  description = "List of private subnet IDs for secure application container deployment"
  value       = module.networking.private_subnet_ids
  sensitive   = false
}

output "database_subnet_ids" {
  description = "List of database subnet IDs for secure database deployment with encryption at rest"
  value       = module.networking.database_subnet_ids
  sensitive   = false
}

# Compute Infrastructure Outputs
output "ecs_cluster_id" {
  description = "ID of the ECS cluster for container deployment and monitoring integration"
  value       = module.compute.ecs_cluster_id
  sensitive   = false
}

output "ecs_service_names" {
  description = "List of ECS service names for service discovery and health monitoring"
  value       = module.compute.ecs_service_names
  sensitive   = false
}

output "ecs_task_definitions" {
  description = "List of ECS task definition ARNs for deployment tracking"
  value       = module.compute.ecs_task_definitions
  sensitive   = false
}

output "alb_dns_name" {
  description = "DNS name of the application load balancer for traffic distribution and SSL termination"
  value       = module.compute.alb_dns_name
  sensitive   = false
}

output "cloudwatch_log_groups" {
  description = "Log group names for centralized logging and monitoring integration"
  value       = module.compute.cloudwatch_log_groups
  sensitive   = false
}

# Database Infrastructure Outputs
output "mongodb_connection_string" {
  description = "Sensitive MongoDB Atlas connection string with encryption and access controls"
  value       = module.database.mongodb_connection_string
  sensitive   = true
}

output "mongodb_cluster_id" {
  description = "MongoDB Atlas cluster identifier for monitoring and management"
  value       = module.database.mongodb_cluster_id
  sensitive   = false
}

output "redis_endpoint" {
  description = "Redis cluster endpoint for distributed caching with encryption in transit"
  value       = module.database.redis_endpoint
  sensitive   = true
}

output "redis_cluster_id" {
  description = "Redis cluster identifier for monitoring and management"
  value       = module.database.redis_cluster_id
  sensitive   = false
}