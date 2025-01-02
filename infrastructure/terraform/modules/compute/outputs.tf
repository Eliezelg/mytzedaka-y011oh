# ECS Cluster outputs for cross-module integration and service deployment
output "cluster_id" {
  description = "The ID of the ECS cluster"
  value       = aws_ecs_cluster.main.id
}

output "cluster_name" {
  description = "The name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

output "cluster_arn" {
  description = "The ARN of the ECS cluster"
  value       = aws_ecs_cluster.main.arn
}

# API Service outputs for load balancer and monitoring integration
output "api_service_id" {
  description = "The ID of the API ECS service"
  value       = aws_ecs_service.api.id
}

output "api_service_name" {
  description = "The name of the API ECS service"
  value       = aws_ecs_service.api.name
}

output "api_task_definition" {
  description = "The task definition ARN of the API service"
  value       = aws_ecs_service.api.task_definition
}

# Web Frontend Service outputs for load balancer and monitoring integration
output "web_service_id" {
  description = "The ID of the Web Frontend ECS service"
  value       = aws_ecs_service.web.id
}

output "web_service_name" {
  description = "The name of the Web Frontend ECS service"
  value       = aws_ecs_service.web.name
}

output "web_task_definition" {
  description = "The task definition ARN of the Web Frontend service"
  value       = aws_ecs_service.web.task_definition
}